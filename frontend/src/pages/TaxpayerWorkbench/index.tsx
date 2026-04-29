import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Input, List, Space, Tag, Timeline, Typography } from 'antd'
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
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const message = useAppMessage()

  const load = async (value = taxpayerId) => {
    if (!value.trim()) return
    setLoading(true)
    try {
      const result = await taxOfficerWorkbenchApi.taxpayer(value.trim())
      setData(result)
      setParams({ taxpayer_id: value.trim() })
    } catch {
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
            placeholder="输入纳税人识别号"
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
        <Empty description="请先查询一户纳税人" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Card
            title="纳税人基本信息"
            extra={
              <Space>
                <Button onClick={() => navigate('/modules/analysis-workbench/new')}>发起案头分析</Button>
                <Button type="primary" onClick={() => navigate(`/modules/risk-ledger?taxpayer_id=${data.taxpayer.taxpayer_id}`)}>新增风险记录</Button>
              </Space>
            }
          >
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
