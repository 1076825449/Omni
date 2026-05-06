import { useEffect, useState } from 'react'
import {
  Button, Card, Col, DatePicker, Descriptions, Input, List, Modal, Row,
  Select, Skeleton, Space, Tag, Timeline, Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import { RiskDossier, riskLedgerApi, taxOfficerWorkbenchApi } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'

const { Text, Paragraph } = Typography
const statuses = ['待核实', '已排除', '整改中', '已整改']
const statusColor: Record<string, string> = {
  待核实: 'orange',
  已排除: 'green',
  整改中: 'blue',
  已整改: 'purple',
}

export default function RiskLedgerModule() {
  const [searchParams] = useSearchParams()
  const [rows, setRows] = useState<RiskDossier[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [entryStatus, setEntryStatus] = useState<string | undefined>()
  const [rowDrafts, setRowDrafts] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const message = useAppMessage()

  const load = (q = query) => {
    setLoading(true)
    Promise.all([
      taxOfficerWorkbenchApi.taxpayerRecords({ q, entry_status: entryStatus, limit: 50 }),
      riskLedgerApi.stats(),
    ]).then(([list, stat]) => {
      setRows(list.items)
      setTotal(list.total)
      setStats(stat)
    }).catch(() => {
      void message.error('加载风险台账失败')
    }).finally(() => {
      setLoading(false)
      setHasLoaded(true)
    })
  }

  useEffect(() => { load('') }, [entryStatus])

  useEffect(() => {
    const taxpayerId = searchParams.get('taxpayer_id')
    if (!taxpayerId) return
    setQuery(taxpayerId)
    load(taxpayerId)
  }, [searchParams])

  const showDetail = async (taxpayerId: string) => {
    try {
      setDetail(await riskLedgerApi.get(taxpayerId))
      setDetailOpen(true)
    } catch {
      void message.error('加载档案详情失败')
    }
  }

  const updateDraft = (taxpayerId: string, patch: any) => {
    setRowDrafts(prev => ({ ...prev, [taxpayerId]: { ...(prev[taxpayerId] || {}), ...patch } }))
  }

  const handleInlineSave = async (record: RiskDossier) => {
    const draft = rowDrafts[record.taxpayer_id] || {}
    if (!draft.content?.trim()) {
      void message.warning('请先填写记录内容')
      return
    }
    try {
      await riskLedgerApi.createEntry({
        taxpayer_id: record.taxpayer_id,
        company_name: record.company_name,
        registration_status: record.registration_status,
        tax_officer: record.tax_officer,
        address: record.address,
        recorded_at: (draft.recorded_at || dayjs()).format('YYYY-MM-DD HH:mm:ss'),
        rectification_deadline: draft.rectification_deadline?.format('YYYY-MM-DD HH:mm:ss'),
        entry_status: draft.entry_status || '待核实',
        content: draft.content,
        contact_person: draft.contact_person,
        contact_phone: draft.contact_phone,
        note: draft.note,
      })
      void message.success('记录已保存')
      setRowDrafts(prev => ({ ...prev, [record.taxpayer_id]: {} }))
      load()
    } catch {
      void message.error('保存失败，请检查记录内容、整改期限和联系人')
    }
  }

  const renderRecordCard = (record: RiskDossier) => {
    const draft = rowDrafts[record.taxpayer_id] || {}
    return (
      <Card
        size="small"
        styles={{ body: { padding: 16 } }}
        style={{ width: '100%', borderColor: record.is_overdue ? '#ffccc7' : '#eef1f5' }}
      >
        <Row gutter={[16, 12]} align="top">
          <Col xs={24} xl={9}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap size={6}>
                <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 600, whiteSpace: 'normal', textAlign: 'left' }} onClick={() => showDetail(record.taxpayer_id)}>
                  {record.company_name || '未命名纳税人'}
                </Button>
                {record.latest_entry_status && <Tag color={statusColor[record.latest_entry_status]}>{record.latest_entry_status}</Tag>}
                {record.is_overdue && <Tag color="red">逾期</Tag>}
              </Space>
              <Space wrap size={[8, 4]}>
                <Text type="secondary">税号：{record.taxpayer_id}</Text>
                <Text type="secondary">登记状态：{record.registration_status || '—'}</Text>
                <Text type="secondary">管理员：{record.tax_officer || '—'}</Text>
              </Space>
              <Space wrap size={[4, 4]}>
                {record.industry_tag ? <Tag color="blue">{record.industry_tag}</Tag> : <Tag>未分类行业</Tag>}
                {record.address_tag ? <Tag>{record.address_tag}</Tag> : <Tag>未识别地址</Tag>}
                <Tag>记录 {record.entry_count || 0} 次</Tag>
              </Space>
            </Space>
          </Col>

          <Col xs={24} xl={6}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>最近记录</Text>
              <Text type="secondary">
                {record.latest_recorded_at ? dayjs(record.latest_recorded_at).format('YYYY-MM-DD HH:mm') : '暂无记录'}
              </Text>
              <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                {record.latest_content || '还没有风险、排除或整改记录'}
              </Paragraph>
              {record.latest_rectification_deadline && (
                <Text type={record.is_overdue ? 'danger' : 'secondary'}>
                  整改期限：{dayjs(record.latest_rectification_deadline).format('YYYY-MM-DD')}
                </Text>
              )}
            </Space>
          </Col>

          <Col xs={24} xl={9}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text strong>本次记录</Text>
              <Row gutter={[8, 8]}>
                <Col xs={24} md={8}>
                  <DatePicker value={draft.recorded_at || dayjs()} onChange={value => updateDraft(record.taxpayer_id, { recorded_at: value })} style={{ width: '100%' }} />
                </Col>
                <Col xs={24} md={8}>
                  <Select value={draft.entry_status || '待核实'} onChange={value => updateDraft(record.taxpayer_id, { entry_status: value })} options={statuses.map(s => ({ value: s, label: s }))} style={{ width: '100%' }} />
                </Col>
                <Col xs={24} md={8}>
                  <DatePicker placeholder="整改期限" value={draft.rectification_deadline} onChange={value => updateDraft(record.taxpayer_id, { rectification_deadline: value })} style={{ width: '100%' }} />
                </Col>
                <Col xs={24}>
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    value={draft.content}
                    onChange={event => updateDraft(record.taxpayer_id, { content: event.target.value })}
                    placeholder="记录风险、核实情况、排除理由或整改进展"
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Input value={draft.contact_person} onChange={event => updateDraft(record.taxpayer_id, { contact_person: event.target.value })} placeholder="联系人" />
                </Col>
                <Col xs={24} md={8}>
                  <Input value={draft.contact_phone} onChange={event => updateDraft(record.taxpayer_id, { contact_phone: event.target.value })} placeholder="联系电话" />
                </Col>
                <Col xs={24} md={8}>
                  <Button type="primary" block onClick={() => handleInlineSave(record)}>保存本次记录</Button>
                </Col>
              </Row>
            </Space>
          </Col>
        </Row>
      </Card>
    )
  }

  return (
    <PlatformLayout>
      <div style={{ minHeight: '100vh', background: '#f5f7fb', padding: 24 }}>
        <Card
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: 16 } }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
            <Space direction="vertical" size={4}>
              <Typography.Title level={4} style={{ margin: 0 }}>管户记录</Typography.Title>
              <Text type="secondary">按户记录风险、核实结论和整改进展</Text>
              {hasLoaded ? (
                <Space wrap style={{ marginTop: 8 }}>
                  <Tag>企业 {total} 户</Tag>
                  <Tag color="orange">待核实 {stats?.pending_count || 0}</Tag>
                  <Tag color="blue">整改中 {stats?.rectifying_count || 0}</Tag>
                  <Tag color="green">已排除 {stats?.excluded_count || 0}</Tag>
                  <Tag color="purple">已整改 {stats?.rectified_count || 0}</Tag>
                </Space>
              ) : (
                <Text type="secondary" style={{ marginTop: 8 }}>正在加载管户记录...</Text>
              )}
            </Space>
            <Space>
              <Input.Search placeholder="税号/名称/法人/管理员" allowClear value={query} onChange={event => setQuery(event.target.value)} onSearch={(value) => { setQuery(value); load(value) }} style={{ width: 260 }} />
              <Select placeholder="事项状态" allowClear value={entryStatus} onChange={setEntryStatus} style={{ width: 130 }} options={statuses.map(s => ({ value: s, label: s }))} />
              <Button onClick={() => load()}>刷新</Button>
            </Space>
          </Space>
        </Card>

        <Card
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: 16 } }}
        >
          {!hasLoaded ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Skeleton active paragraph={{ rows: 3 }} />
              <Skeleton active paragraph={{ rows: 3 }} />
            </Space>
          ) : (
            <List
              loading={loading}
              dataSource={rows}
              rowKey="taxpayer_id"
              renderItem={(item) => (
                <List.Item style={{ padding: '8px 0', borderBlockEnd: 'none' }}>
                  {renderRecordCard(item)}
                </List.Item>
              )}
              pagination={total > 50 ? { total, pageSize: 50, showSizeChanger: false } : false}
              locale={{
                emptyText: query || entryStatus ? '没有符合当前筛选条件的企业' : '暂无企业数据。请先在首页导入税务登记信息查询数据源。',
              }}
            />
          )}
        </Card>

        <Modal title="纳税人风险档案" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={860}>
          {detail && (
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="纳税人名称">{detail.dossier.company_name}</Descriptions.Item>
                <Descriptions.Item label="识别号">{detail.dossier.taxpayer_id}</Descriptions.Item>
                <Descriptions.Item label="登记状态">{detail.dossier.registration_status || '—'}</Descriptions.Item>
                <Descriptions.Item label="管理员">{detail.dossier.tax_officer || '—'}</Descriptions.Item>
                <Descriptions.Item label="临时档案">{detail.dossier.is_temporary ? '是' : '否'}</Descriptions.Item>
                <Descriptions.Item label="记录数">{detail.dossier.entry_count}</Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>{detail.dossier.address || '—'}</Descriptions.Item>
              </Descriptions>
              <Timeline
                items={detail.entries.map((entry: any) => ({
                  color: statusColor[entry.entry_status] || 'blue',
                  children: (
                    <Space direction="vertical" size={2}>
                      <Space><Text strong>{dayjs(entry.recorded_at).format('YYYY-MM-DD HH:mm')}</Text><Tag color={statusColor[entry.entry_status]}>{entry.entry_status}</Tag></Space>
                      <Text>{entry.content}</Text>
                      {entry.rectification_deadline && <Text type={dayjs(entry.rectification_deadline).isBefore(dayjs()) && entry.entry_status === '整改中' ? 'danger' : 'secondary'}>整改期限：{dayjs(entry.rectification_deadline).format('YYYY-MM-DD HH:mm')}</Text>}
                      {(entry.contact_person || entry.contact_phone) && <Text type="secondary">联系人：{entry.contact_person || '—'} {entry.contact_phone || ''}</Text>}
                      {entry.note && <Text type="secondary">备注：{entry.note}</Text>}
                    </Space>
                  ),
                }))}
              />
            </Space>
          )}
        </Modal>
      </div>
    </PlatformLayout>
  )
}
