import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Input, List, Row, Col, Space, Statistic, Tag, Timeline, Typography } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { taxOfficerWorkbenchApi, TaxpayerWorkbenchData } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'

const { Title, Text, Paragraph } = Typography
const statusColor: Record<string, string> = { 待核实: 'orange', 已排除: 'green', 整改中: 'blue', 已整改: 'purple' }

export default function TaxpayerWorkbench() {
  const [params, setParams] = useSearchParams()
  const [taxpayerId, setTaxpayerId] = useState(params.get('taxpayer_id') || '')
  const [data, setData] = useState<TaxpayerWorkbenchData | null>(null)
  const [candidates, setCandidates] = useState<TaxpayerWorkbenchData['taxpayer'][]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const message = useAppMessage()

  const load = async (value = taxpayerId) => {
    if (!value.trim()) return
    setLoading(true)
    try {
      const result = await taxOfficerWorkbenchApi.taxpayer(value.trim())
      setData(result)
      setCandidates([])
      setParams({ taxpayer_id: value.trim() })
    } catch {
      const search = await taxOfficerWorkbenchApi.searchTaxpayers(value.trim()).catch(() => ({ items: [] }))
      if (search.items.length === 1) {
        setTaxpayerId(search.items[0].taxpayer_id)
        const result = await taxOfficerWorkbenchApi.taxpayer(search.items[0].taxpayer_id)
        setData(result)
        setCandidates([])
        setParams({ taxpayer_id: search.items[0].taxpayer_id })
        return
      }
      if (search.items.length > 1) {
        setCandidates(search.items as any)
        setData(null)
        return
      }
      void message.error('没有找到该户信息，请先导入纳税人信息或在风险台账中建立临时档案')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const value = params.get('taxpayer_id')
    if (!value) return
    setTaxpayerId(value)
    void load(value)
  }, [])

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>一户式纳税人工作台</Title>
        <Text type="secondary">输入纳税人识别号，集中查看该户信息、风险记录、案头分析和整改跟踪。</Text>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input.Search
            placeholder="输入纳税人识别号或纳税人名称"
            value={taxpayerId}
            loading={loading}
            allowClear
            onChange={(event) => setTaxpayerId(event.target.value)}
            onSearch={load}
            enterButton="查询该户"
          />
        </Space.Compact>
      </Card>

      {!data ? (
        candidates.length > 0 ? (
          <Card title="请选择要查看的纳税人">
            <List
              dataSource={candidates}
              renderItem={(item) => (
                <List.Item actions={[<Button size="small" type="primary" onClick={() => load(item.taxpayer_id)}>查看该户</Button>]}>
                  <List.Item.Meta
                    title={item.company_name}
                    description={`${item.taxpayer_id}；登记状态：${item.registration_status || '—'}；管理员：${item.tax_officer || '—'}；地址：${item.address || '—'}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        ) : <Empty description="请先查询一户纳税人" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Card
            title="纳税人基本信息"
            extra={
              <Space>
                <Button onClick={() => navigate(`/modules/analysis-workbench/new?taxpayer_id=${encodeURIComponent(data.taxpayer.taxpayer_id)}&company_name=${encodeURIComponent(data.taxpayer.company_name || '')}`)}>发起案头分析</Button>
                <Button type="primary" onClick={() => navigate(`/modules/risk-ledger?taxpayer_id=${data.taxpayer.taxpayer_id}`)}>新增风险记录</Button>
                <Button onClick={() => navigate('/my-risk-list')}>查看风险清单</Button>
              </Space>
            }
          >
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={12} md={6}><Card size="small"><Statistic title="风险记录" value={data.entries.length} suffix="条" /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="待核实" value={data.entries.filter(item => item.entry_status === '待核实').length} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="整改中" value={data.entries.filter(item => item.entry_status === '整改中').length} valueStyle={{ color: '#1677ff' }} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="最近分析" value={data.recent_analysis_tasks.length} suffix="次" /></Card></Col>
            </Row>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="纳税人名称">{data.taxpayer.company_name || '未导入基础信息'}</Descriptions.Item>
              <Descriptions.Item label="纳税人识别号">{data.taxpayer.taxpayer_id}</Descriptions.Item>
              <Descriptions.Item label="登记状态">{data.taxpayer.registration_status || '—'}</Descriptions.Item>
              <Descriptions.Item label="税收管理员">{data.taxpayer.tax_officer || '—'}</Descriptions.Item>
              <Descriptions.Item label="行业">{data.taxpayer.industry || '—'}</Descriptions.Item>
              <Descriptions.Item label="主管税务机关">{data.taxpayer.tax_bureau || '—'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{data.taxpayer.address || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {data.latest_risk && (
            <Alert
              type={data.latest_risk.entry_status === '整改中' ? 'warning' : 'info'}
              showIcon
              message={`最新风险状态：${data.latest_risk.entry_status}`}
              description={[
                `${dayjs(data.latest_risk.recorded_at).format('YYYY-MM-DD')}：${data.latest_risk.content}`,
                data.latest_risk.rectification_deadline ? `整改期限：${dayjs(data.latest_risk.rectification_deadline).format('YYYY-MM-DD')}` : '',
                data.latest_risk.contact_person ? `联系人：${data.latest_risk.contact_person}${data.latest_risk.contact_phone ? `（${data.latest_risk.contact_phone}）` : ''}` : '',
              ].filter(Boolean).join('；')}
            />
          )}

          <Card title="风险记录和整改跟踪">
            {data.entries.length === 0 ? (
              <Empty description="该户暂无风险记录" />
            ) : (
              <Timeline
                items={data.entries.map((entry) => ({
                  color: statusColor[entry.entry_status] || 'blue',
                  children: (
                    <Space direction="vertical" size={2}>
                      <Space>
                        <Text strong>{dayjs(entry.recorded_at).format('YYYY-MM-DD HH:mm')}</Text>
                        <Tag color={statusColor[entry.entry_status]}>{entry.entry_status}</Tag>
                      </Space>
                      <Text>{entry.content}</Text>
                      {entry.rectification_deadline && <Text type={entry.entry_status === '整改中' && dayjs(entry.rectification_deadline).isBefore(dayjs()) ? 'danger' : 'secondary'}>整改期限：{dayjs(entry.rectification_deadline).format('YYYY-MM-DD HH:mm')}</Text>}
                      {(entry.contact_person || entry.contact_phone) && <Text type="secondary">联系人：{entry.contact_person || '—'} {entry.contact_phone || ''}</Text>}
                      {entry.note && <Text type="secondary">备注：{entry.note}</Text>}
                    </Space>
                  ),
                }))}
              />
            )}
          </Card>

          <Card title="最近案头分析">
            {data.recent_analysis_tasks.length === 0 ? (
              <Empty description="该户暂无案头分析记录" />
            ) : (
              <List
                dataSource={data.recent_analysis_tasks}
                renderItem={(task) => (
                  <List.Item actions={[<Button size="small" onClick={() => navigate(`/modules/analysis-workbench/results/${task.task_id}`)}>查看结果</Button>]}>
                    <List.Item.Meta
                      title={<Space><Text strong>{task.name}</Text><Tag>{task.risk_count} 个风险</Tag></Space>}
                      description={task.summary}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card title="建议调取资料">
            {data.material_gap_list.length === 0 ? (
              <Paragraph type="secondary">暂无资料缺口。案头分析形成风险后，这里会汇总应要求企业提供的资料。</Paragraph>
            ) : (
              <Space wrap>{data.material_gap_list.map((item) => <Tag key={item}>{item}</Tag>)}</Space>
            )}
          </Card>
        </Space>
      )}
    </div>
  )
}
