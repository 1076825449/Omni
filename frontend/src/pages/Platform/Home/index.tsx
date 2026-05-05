import { Card, Row, Col, Statistic, Button, Space, Typography, Alert, Tag, Input, Upload, Progress, Descriptions, Skeleton } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../../stores/auth'
import type { ImportHistoryItem, ImportJob, Module, PlatformStatsOverview } from '../../../services/api'
import { infoQueryApi, modulesApi, platformStatsApi, taxOfficerWorkbenchApi } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Title, Text, Paragraph } = Typography

const roleLabels: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
  viewer: '访客（只读）',
}

export default function Home() {
  const [modules, setModules] = useState<Module[]>([])
  const [stats, setStats] = useState<PlatformStatsOverview | null>(null)
  const [riskSummary, setRiskSummary] = useState<Record<string, number>>({})
  const [taxpayerId, setTaxpayerId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importStartedAt, setImportStartedAt] = useState<number | null>(null)
  const [importElapsed, setImportElapsed] = useState(0)
  const [importFileName, setImportFileName] = useState('')
  const [importJob, setImportJob] = useState<ImportJob | null>(null)
  const [lastImportResult, setLastImportResult] = useState<ImportHistoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const message = useAppMessage()
  const { user } = useAuthStore()

  useEffect(() => {
    Promise.all([
      modulesApi.list(),
      platformStatsApi.overview(),
      taxOfficerWorkbenchApi.taxpayerRecords({ limit: 1 }),
      infoQueryApi.importHistory(1),
    ]).then(([moduleData, statsData, riskData, historyData]) => {
      setModules(moduleData.modules.filter((m: Module) => m.status === 'active'))
      setStats(statsData)
      setRiskSummary(riskData.summary)
      setLastImportResult(historyData.items[0] || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!importing || !importStartedAt) {
      setImportElapsed(0)
      return
    }
    const timer = window.setInterval(() => {
      setImportElapsed(Math.max(1, Math.floor((Date.now() - importStartedAt) / 1000)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [importing, importStartedAt])

  const handleSourceUpload = async (file: File) => {
    setImportFileName(file.name)
    setImportStartedAt(Date.now())
    setImportJob(null)
    setImporting(true)
    try {
      let job = await infoQueryApi.startImportJob(file)
      setImportJob(job)
      while (job.status === 'queued' || job.status === 'running') {
        await new Promise(resolve => window.setTimeout(resolve, 1000))
        job = await infoQueryApi.getImportJob(job.job_id)
        setImportJob(job)
      }
      if (job.status === 'failed') {
        throw new Error(job.error || job.message)
      }
      message.success(job.message)
      const [statsData, riskData, historyData] = await Promise.all([
        platformStatsApi.overview(),
        taxOfficerWorkbenchApi.taxpayerRecords({ limit: 1 }),
        infoQueryApi.importHistory(1),
      ])
      setStats(statsData)
      setRiskSummary(riskData.summary)
      setLastImportResult(historyData.items[0] || {
        batch: job.batch,
        filename: job.filename || file.name,
        imported: job.imported,
        updated: job.updated,
        skipped: job.skipped,
        total_processed: job.imported + job.updated + job.skipped,
        created_at: new Date().toISOString(),
        detail: job.message,
      })
    } catch {
      message.error('导入失败：请确认文件为税务登记信息查询表，且包含纳税人识别号、纳税人名称等字段')
    } finally {
      setImporting(false)
    }
    return false
  }

  const goSearch = (value: string) => {
    const keyword = value.trim()
    if (!keyword) return
    navigate(`/taxpayer-workbench?taxpayer_id=${encodeURIComponent(keyword)}`)
  }

  const actionCards = [
    { path: '/taxpayer-workbench', key: 'taxpayer-workbench', title: '信息查询', desc: '按税号、名称、法人或管理员查企业', color: '#1677ff' },
    { path: '/modules/info-query', key: 'info-query', title: '管户分配', desc: '查看全部管户、行业标签和地址标签', color: '#13a8a8' },
    { path: '/modules/risk-ledger', key: 'risk-ledger', title: '管户记录', desc: '记录风险、核实结论和整改情况', color: '#fa8c16' },
    { path: '/modules/analysis-workbench', key: 'analysis-workbench', title: '案头分析', desc: '上传资料，识别疑点并生成文书', color: '#cf1322' },
    { path: '/document-reports', key: 'document-reports', title: '文书报告', desc: '查看和下载通知书、核实报告', color: '#722ed1' },
    { path: '/modules/learning-lab', key: 'learning-lab', title: '刷题程序', desc: '业务题库练习和错题复盘', color: '#389e0d' },
  ].filter(action => action.key === 'taxpayer-workbench' || action.key === 'document-reports' || modules.some(module => module.key === action.key))

  return (
    <div className="omni-page">
      <div className="omni-page-header" style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
          <Space direction="vertical" size={4}>
            <Title level={4} style={{ margin: 0 }}>税务风险工作助手</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              先查企业，再开展案头分析、记录风险、跟踪整改。
            </Paragraph>
          </Space>
          <Space>
            <Text type="secondary">当前账号：{user?.nickname || user?.username}</Text>
            <Tag color={user?.role === 'admin' ? 'red' : user?.role === 'viewer' ? 'orange' : 'blue'}>
              {roleLabels[user?.role || ''] || user?.role}
            </Tag>
          </Space>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic title="我的管户数" value={riskSummary.taxpayer_total ?? 0} loading={loading} suffix="户" />
            <Text type="secondary" style={{ fontSize: 12 }}>来自统一数据源</Text>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic title="待核实风险" value={riskSummary.pending_count ?? 0} loading={loading} suffix="户" />
            <Text type="secondary" style={{ fontSize: 12 }}>需要进一步核实</Text>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic title="整改中企业" value={riskSummary.rectifying_count ?? 0} loading={loading} suffix="户" valueStyle={{ color: '#1677ff' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>需要跟踪整改</Text>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic title="资料和任务" value={(stats?.file_total ?? 0) + (stats?.task_total ?? 0)} loading={loading} suffix="项" />
            <Text type="secondary" style={{ fontSize: 12 }}>已留存资料和分析任务</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            style={{
              minHeight: 260,
              background: 'linear-gradient(135deg, #f7fbff 0%, #ffffff 58%, #fff7e6 100%)',
              border: '1px solid #d9e8ff',
            }}
          >
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Space direction="vertical" size={4}>
                <Title level={3} style={{ margin: 0 }}>先查一户企业</Title>
                <Text type="secondary">输入税号、纳税人名称、法定代表人或税收管理员，进入该户完整工作台。</Text>
              </Space>
              <Input.Search
                size="large"
                placeholder="例如：柳大、企业名称、法人姓名、管理员姓名或纳税人识别号"
                allowClear
                enterButton="查询"
                value={taxpayerId}
                onChange={(event) => setTaxpayerId(event.target.value)}
                onSearch={goSearch}
              />
              <Space wrap>
                <Button type="primary" onClick={() => goSearch(taxpayerId)}>查询企业</Button>
                <Button onClick={() => navigate('/modules/risk-ledger')}>打开管户记录</Button>
                <Button onClick={() => navigate('/modules/analysis-workbench')}>发起案头分析</Button>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="统一数据源" size="small" style={{ minHeight: 260 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Alert
                type={lastImportResult ? 'success' : 'info'}
                showIcon
                message={lastImportResult ? '数据源已导入' : '请先导入税务登记信息查询表'}
                description={lastImportResult
                  ? `最近版本：${lastImportResult.filename || '未记录文件名'}，处理 ${lastImportResult.total_processed} 户`
                  : '导入后，信息查询、管户分配、管户记录和案头分析都会自动带出企业基础信息。'}
              />
              <Upload.Dragger accept=".xls,.xlsx,.csv,.json" customRequest={({ file }) => handleSourceUpload(file as File)} disabled={importing} showUploadList={false}>
                <p><UploadOutlined style={{ fontSize: 26 }} /></p>
                <p>{importing ? `正在导入：${importFileName || '数据源文件'}` : '上传或更新数据源'}</p>
                <Text type="secondary" style={{ fontSize: 12 }}>支持 XLS、XLSX、CSV、JSON</Text>
              </Upload.Dragger>
              {importing && (
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  <Progress percent={importJob?.progress_percent || 1} status="active" />
                  <Text strong style={{ fontSize: 12 }}>
                    {importJob?.phase || '上传文件'}：{importJob?.message || '正在上传文件并准备解析'}
                  </Text>
                  {importJob?.total_rows ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      已处理 {importJob.processed_rows} / {importJob.total_rows} 行；新增 {importJob.imported}，更新 {importJob.updated}，跳过 {importJob.skipped}
                    </Text>
                  ) : null}
                  <Text type="secondary" style={{ fontSize: 12 }}>已等待约 {importElapsed} 秒，请不要重复上传。</Text>
                </Space>
              )}
              {lastImportResult && !importing && (
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="导入时间">{new Date(lastImportResult.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
                  <Descriptions.Item label="处理结果">
                    <Space wrap>
                      <Tag color="green">新增 {lastImportResult.imported}</Tag>
                      <Tag color="blue">更新 {lastImportResult.updated}</Tag>
                      <Tag color={lastImportResult.skipped > 0 ? 'orange' : 'default'}>跳过 {lastImportResult.skipped}</Tag>
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="业务入口" size="small">
        {loading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <Row gutter={[12, 12]}>
            {actionCards.map(action => (
              <Col xs={24} sm={12} lg={8} key={action.key}>
                <Link to={action.path}>
                  <Card hoverable size="small" style={{ height: '100%' }}>
                    <Space align="start">
                      <span style={{ width: 8, height: 40, borderRadius: 4, background: action.color, display: 'inline-block' }} />
                      <Space direction="vertical" size={2}>
                        <Text strong>{action.title}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{action.desc}</Text>
                      </Space>
                    </Space>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  )
}
