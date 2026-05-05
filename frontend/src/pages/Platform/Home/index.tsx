// 平台首页
import { Card, Row, Col, Statistic, Button, Space, Typography, List, Skeleton, Empty, Alert, Tag, Input, Upload, Progress, Descriptions } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../../stores/auth'
import { useNotificationStore } from '../../../stores/notification'
import type { ImportHistoryItem, Module, PlatformStatsOverview, Task, WorkbenchTodoData } from '../../../services/api'
import { infoQueryApi, modulesApi, platformStatsApi, riskLedgerApi, tasksApi, taxOfficerWorkbenchApi } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Title, Text, Paragraph } = Typography

const roleLabels: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
  viewer: '访客（只读）',
}

const roleDescriptions: Record<string, string> = {
  admin: '可管理用户、角色、功能入口、备份恢复和系统设置',
  user: '可使用业务功能（查户、案头分析、信息查询、风险台账、文书报告），不能管理系统配置',
  viewer: '只可查看，不能新增、编辑、删除、导入或执行任何操作',
}

const taskStatusMap: Record<string, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'default' },
  running: { label: '进行中', color: 'processing' },
  succeeded: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
}

export default function Home() {
  const [modules, setModules] = useState<Module[]>([])
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<PlatformStatsOverview | null>(null)
  const [riskSummary, setRiskSummary] = useState<Record<string, number>>({})
  const [todos, setTodos] = useState<WorkbenchTodoData>({ items: [], summary: {} })
  const [taxpayerId, setTaxpayerId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importStartedAt, setImportStartedAt] = useState<number | null>(null)
  const [importElapsed, setImportElapsed] = useState(0)
  const [importFileName, setImportFileName] = useState('')
  const [lastImportResult, setLastImportResult] = useState<ImportHistoryItem | null>(null)
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const message = useAppMessage()
  const { user } = useAuthStore()
  const notificationStore = useNotificationStore()

  useEffect(() => {
    Promise.all([
      modulesApi.list(),
      tasksApi.list({ limit: 5, offset: 0 }),
      platformStatsApi.overview(),
      taxOfficerWorkbenchApi.taxpayerRecords({ limit: 1 }),
      taxOfficerWorkbenchApi.todos({ limit: 8 }),
      infoQueryApi.importHistory(6),
    ]).then(([moduleData, taskData, statsData, riskData, todoData, historyData]) => {
      setModules(moduleData.modules.filter((m: Module) => m.status === 'active'))
      setRecentTasks(taskData.tasks)
      setStats(statsData)
      setRiskSummary(riskData.summary)
      setTodos(todoData)
      setImportHistory(historyData.items)
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

  const refreshTodos = async () => {
    const [riskData, todoData] = await Promise.all([
      taxOfficerWorkbenchApi.taxpayerRecords({ limit: 1 }),
      taxOfficerWorkbenchApi.todos({ limit: 8 }),
    ])
    setRiskSummary(riskData.summary)
    setTodos(todoData)
  }

  const handleMark = async (taxpayer_id: string, entry_status: '已排除' | '已整改') => {
    try {
      await riskLedgerApi.batchStatus({
        taxpayer_ids: [taxpayer_id],
        entry_status,
        content: `首页待办处理：标记为${entry_status}`,
      })
      message.success('处理状态已记录')
      await refreshTodos()
    } catch {
      message.error('处理状态记录失败，请稍后重试或进入风险台账手工记录')
    }
  }

  const handleSourceUpload = async (file: File) => {
    setImportFileName(file.name)
    setImportStartedAt(Date.now())
    setLastImportResult(null)
    setImporting(true)
    try {
      const result = await infoQueryApi.importFile(file)
      message.success(result.message)
      const [statsData, riskData, todoData, historyData] = await Promise.all([
        platformStatsApi.overview(),
        taxOfficerWorkbenchApi.taxpayerRecords({ limit: 1 }),
        taxOfficerWorkbenchApi.todos({ limit: 8 }),
        infoQueryApi.importHistory(6),
      ])
      setStats(statsData)
      setRiskSummary(riskData.summary)
      setTodos(todoData)
      setImportHistory(historyData.items)
      setLastImportResult(historyData.items[0] || {
        batch: result.batch,
        filename: file.name,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        total_processed: result.imported + result.updated + result.skipped,
        created_at: new Date().toISOString(),
        detail: result.message,
      })
    } catch {
      message.error('导入失败：请确认文件为税务登记信息查询表，且包含纳税人识别号、纳税人名称等字段')
    } finally {
      setImporting(false)
    }
    return false
  }

  const quickActions = [
    { path: '/taxpayer-workbench', key: 'taxpayer-workbench', label: '信息查询', desc: '按税号、名称、法人、管理员查企业', primary: true },
    { path: '/modules/info-query', key: 'info-query', label: '管户分配', desc: '查看全部管户和自动标签', primary: false },
    { path: '/modules/risk-ledger', key: 'risk-ledger', label: '管户记录', desc: '记录风险、排除和整改过程', primary: false },
    { path: '/modules/learning-lab', key: 'learning-lab', label: '刷题程序', desc: '业务题库练习和错题复盘', primary: false },
  ].filter(action => action.key === 'taxpayer-workbench' || modules.some(module => module.key === action.key))

  const hasData = stats && (stats.task_total > 0 || stats.file_total > 0)

  return (
    <div className="omni-page">
      {/* 欢迎区域 */}
      <div className="omni-page-header" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            税源管理员今日工作台
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            从这里导入数据源、查询企业、记录风险、跟踪整改进展。
          </Paragraph>
        </Space>
      </div>

      {/* 用户角色信息 */}
      <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            <Text strong>当前账号：{user?.nickname || user?.username}</Text>
            <Tag color={user?.role === 'admin' ? 'red' : user?.role === 'viewer' ? 'orange' : 'blue'}>
              {roleLabels[user?.role || ''] || user?.role}
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {roleDescriptions[user?.role || '']}
          </Text>
        </Space>
      </Card>

      {/* 新手引导（仅当没有数据时显示） */}
      {!hasData && !loading && (
        <Alert
          type="info"
          showIcon
          icon={<span style={{ fontSize: 18 }}>🚀</span>}
          message="第一次使用？"
          description={
            <Space direction="vertical" size={4}>
              <Text>建议按以下顺序开始：</Text>
              <Space wrap>
                <Button size="small" type="primary" onClick={() => navigate('/modules/info-query')}>
                  第1步：导入数据源
                </Button>
                <Button size="small" type="primary" onClick={() => navigate('/modules/analysis-workbench')}>
                  第2步：开展案头分析
                </Button>
                <Button size="small" onClick={() => navigate('/help/getting-started')}>
                  查看3分钟上手指南 →
                </Button>
              </Space>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 今日概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="待核实风险"
              value={riskSummary.pending_count ?? 0}
              loading={loading}
              suffix="户"
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              需要进一步核实
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="整改中企业"
              value={riskSummary.rectifying_count ?? 0}
              loading={loading}
              suffix="户"
              valueStyle={{ color: '#1677ff' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              需要跟踪整改
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="逾期未整改"
              value={todos.summary.overdue_count ?? 0}
              loading={loading}
              suffix="户"
              valueStyle={{ color: '#cf1322' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              需优先催办
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="我的管户数"
              value={riskSummary.taxpayer_total ?? riskSummary.dossier_total ?? 0}
              loading={loading}
              suffix="户"
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              来自统一数据源
            </Text>
          </Card>
        </Col>
      </Row>

      <Card
        title="今日应处理"
        size="small"
        style={{ marginBottom: 16 }}
        extra={<Link to="/modules/risk-ledger"><Text type="secondary" style={{ fontSize: 12 }}>查看全部管户记录 →</Text></Link>}
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : todos.items.length === 0 ? (
          <Empty description="当前没有临近到期、逾期或今日新增待核实事项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={todos.items}
            renderItem={(item) => (
              <List.Item>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                    <Space wrap>
                      <Tag color={item.todo_type === 'overdue' ? 'red' : item.todo_type === 'due_soon' ? 'orange' : 'blue'}>
                        {item.todo_label}
                      </Tag>
                      <Text strong>{item.company_name || item.taxpayer_id}</Text>
                      <Text type="secondary">{item.taxpayer_id}</Text>
                      <Text type="secondary">状态：{item.latest_entry_status}</Text>
                      {item.latest_rectification_deadline && (
                        <Text type="secondary">整改期限：{new Date(item.latest_rectification_deadline).toLocaleDateString('zh-CN')}</Text>
                      )}
                      {item.latest_contact_person && (
                        <Text type="secondary">联系人：{item.latest_contact_person}</Text>
                      )}
                    </Space>
                    <Space wrap>
                      <Button size="small" onClick={() => navigate(`/taxpayer-workbench?taxpayer_id=${encodeURIComponent(item.taxpayer_id)}`)}>
                        查看信息
                      </Button>
                      <Button size="small" onClick={() => navigate(`/modules/risk-ledger?taxpayer_id=${encodeURIComponent(item.taxpayer_id)}`)}>
                        记录整改情况
                      </Button>
                      <Button size="small" onClick={() => handleMark(item.taxpayer_id, '已排除')}>
                        标记已排除
                      </Button>
                      <Button size="small" type="primary" onClick={() => handleMark(item.taxpayer_id, '已整改')}>
                        标记已整改
                      </Button>
                    </Space>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.latest_content || '暂无风险内容'}</Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 常用工作 + 最近记录 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="导入数据源" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="这里导入的是全系统共用的企业基础信息"
                description="导入后，可用于信息查询、管户分配、管户记录、案头分析，以及后续新增模块自动匹配企业名称、状态、管理员和地址。"
              />
              <Upload.Dragger accept=".xls,.xlsx,.csv,.json" customRequest={({ file }) => handleSourceUpload(file as File)} disabled={importing} showUploadList={false}>
                <p><UploadOutlined style={{ fontSize: 28 }} /></p>
                <p>上传“税务登记信息查询”数据源</p>
                <Text type="secondary" style={{ fontSize: 12 }}>支持 XLS、XLSX、CSV、JSON</Text>
              </Upload.Dragger>
              {importing && (
                <Alert
                  type="warning"
                  showIcon
                  message={`正在导入：${importFileName || '数据源文件'}`}
                  description={
                    <Space direction="vertical" style={{ width: '100%' }} size={6}>
                      <Progress percent={65} status="active" />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        大表导入需要等待解析和写入数据库，当前已等待约 {importElapsed} 秒。请不要重复上传或关闭页面。
                      </Text>
                    </Space>
                  }
                />
              )}
              {lastImportResult && !importing && (
                <Card size="small" title="最近一次导入结果">
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="文件">{lastImportResult.filename || '未记录文件名'}</Descriptions.Item>
                    <Descriptions.Item label="导入时间">{new Date(lastImportResult.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
                    <Descriptions.Item label="批次">{lastImportResult.batch}</Descriptions.Item>
                    <Descriptions.Item label="结果">
                      <Space wrap>
                        <Tag color="green">新增 {lastImportResult.imported}</Tag>
                        <Tag color="blue">更新 {lastImportResult.updated}</Tag>
                        <Tag color={lastImportResult.skipped > 0 ? 'orange' : 'default'}>跳过 {lastImportResult.skipped}</Tag>
                      </Space>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}
              <Card size="small" title="导入历史" extra={<Button size="small" onClick={() => infoQueryApi.importHistory(6).then(data => setImportHistory(data.items))}>刷新</Button>}>
                {importHistory.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无导入历史" />
                ) : (
                  <List
                    size="small"
                    dataSource={importHistory}
                    renderItem={(item) => (
                      <List.Item>
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          <Space wrap>
                            <Text strong>{item.filename || '未记录文件名'}</Text>
                            <Tag>处理 {item.total_processed}</Tag>
                            <Tag color="green">新增 {item.imported}</Tag>
                            <Tag color="blue">更新 {item.updated}</Tag>
                            {item.skipped > 0 && <Tag color="orange">跳过 {item.skipped}</Tag>}
                          </Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(item.created_at).toLocaleString('zh-CN')} · 批次 {item.batch}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
              <Text type="secondary" style={{ fontSize: 12 }}>
                模板字段可包含：纳税人识别号、纳税人名称、状态、行业、经营范围、经营地址、法定代表人、税收管理员。
              </Text>
            </Space>
          </Card>
        </Col>

        {/* 常用工作 */}
        <Col xs={24} lg={12}>
          <Card
            title="常用工作"
            size="small"
            extra={<Link to="/modules/risk-ledger"><Text type="secondary" style={{ fontSize: 12 }}>查看管户记录 →</Text></Link>}
          >
            {loading ? (
              <Skeleton active />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Input.Search
                  placeholder="输入税号、名称、法人或管理员，直接查询"
                  allowClear
                  enterButton="查询"
                  value={taxpayerId}
                  onChange={(event) => setTaxpayerId(event.target.value)}
                  onSearch={(value) => value.trim() && navigate(`/taxpayer-workbench?taxpayer_id=${encodeURIComponent(value.trim())}`)}
                />
                {quickActions.map(action => (
                  <Link key={`${action.key}-${action.label}`} to={action.path} style={{ width: '100%' }}>
                    <Card
                      size="small"
                      hoverable
                      styles={{ body: { padding: '12px 16px' } }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <Button type={action.primary ? 'primary' : 'default'} size="small">
                            {action.label}
                          </Button>
                          <Text type="secondary" style={{ fontSize: 12 }}>{action.desc}</Text>
                        </Space>
                        <Text type="secondary">→</Text>
                      </Space>
                    </Card>
                  </Link>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        {/* 最近记录 */}
        <Col xs={24} lg={12}>
          <Card
            title="最近案头分析和运行记录"
            size="small"
            extra={<Link to="/tasks"><Text type="secondary" style={{ fontSize: 12 }}>查看全部 →</Text></Link>}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : recentTasks.length === 0 ? (
              <Empty
                description={
                  <Space direction="vertical" size={4}>
                    <Text type="secondary">还没有运行记录</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>可以先导入数据源，再查询企业或发起案头分析</Text>
                  </Space>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                size="small"
                dataSource={recentTasks}
                renderItem={item => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/tasks')}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <div>
                        <Text strong>{item.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.module === 'analysis-workbench' ? '案头分析' : '工作事项'} · {new Date(item.created_at).toLocaleString('zh-CN')}
                        </Text>
                      </div>
                      <Tag color={taskStatusMap[item.status]?.color}>
                        {taskStatusMap[item.status]?.label ?? item.status}
                      </Tag>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 帮助入口 */}
      <Card size="small" style={{ marginTop: 16, background: '#fafafa' }}>
        <Space style={{ width: '100%', justifyContent: 'center' }} wrap>
          <Link to="/help/getting-started">
            <Button type="link" size="small">3分钟上手指南</Button>
          </Link>
          <Link to="/help">
            <Button type="link" size="small">帮助中心</Button>
          </Link>
          <Link to="/modules">
            <Button type="link" size="small">系统管理：全部功能</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}
