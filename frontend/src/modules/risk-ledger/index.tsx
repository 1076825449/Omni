import { useEffect, useState } from 'react'
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, List, Modal, Row,
  Select, Space, Statistic, Table, Tabs, Tag, Timeline, Typography, Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
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
  const [form] = Form.useForm()
  const [batchForm] = Form.useForm()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('single')
  const [rows, setRows] = useState<RiskDossier[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [entryStatus, setEntryStatus] = useState<string | undefined>()
  const [rowDrafts, setRowDrafts] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [failures, setFailures] = useState<Array<Record<string, string>>>([])
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
      setLoading(false)
    }).catch(() => {
      void message.error('加载风险台账失败')
      setLoading(false)
    })
  }

  useEffect(() => { load('') }, [entryStatus])

  useEffect(() => {
    const taxpayerId = searchParams.get('taxpayer_id')
    if (!taxpayerId) return
    setActiveTab('single')
    form.setFieldsValue({ taxpayer_id: taxpayerId, recorded_at: dayjs(), entry_status: '待核实' })
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

  const handleCreate = async (values: any) => {
    try {
      await riskLedgerApi.createEntry({
        ...values,
        recorded_at: values.recorded_at.format('YYYY-MM-DD HH:mm:ss'),
        rectification_deadline: values.rectification_deadline?.format('YYYY-MM-DD HH:mm:ss'),
      })
      void message.success('记录已保存')
      form.resetFields()
      load()
    } catch {
      void message.error('保存失败：若信息查询表未命中该税号，请填写纳税人名称后创建临时档案')
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

  const handleBatchText = async (values: any) => {
    const taxpayerIds = String(values.taxpayer_ids || '')
      .split(/[\s,，;；]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    try {
      const result = await riskLedgerApi.batchText({
        taxpayer_ids: taxpayerIds,
        recorded_at: values.recorded_at.format('YYYY-MM-DD HH:mm:ss'),
        rectification_deadline: values.rectification_deadline?.format('YYYY-MM-DD HH:mm:ss'),
        content: values.content,
        entry_status: values.entry_status,
        contact_person: values.contact_person,
        contact_phone: values.contact_phone,
        note: values.note,
      })
      setFailures(result.failures)
      void message.success(result.message)
      batchForm.resetFields()
      load()
    } catch {
      void message.error('批量记录失败：请检查税号是否为空、记录内容是否填写，整改中记录需补充整改期限和联系人')
    }
  }

  const handleUpload = async (file: File) => {
    try {
      const result = await riskLedgerApi.importFile(file)
      setFailures(result.failures)
      void message.success(result.message)
      load()
    } catch {
      void message.error('导入失败：请检查表头是否包含“纳税人识别号、记录时间、记录内容”')
    }
    return false
  }

  const downloadFailures = () => {
    const header = ['行号', '纳税人识别号', '失败原因', '建议处理方式']
    const rowsText = failures.map((item) => [
      item.row || '',
      item.taxpayer_id || '',
      item.reason || JSON.stringify(item),
      item.reason?.includes('未找到') ? '补充纳税人名称后创建临时档案，或先导入完整信息查询表' : '按失败原因修正后重新导入',
    ])
    const csv = [header, ...rowsText].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '风险台账导入失败清单.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const columns: ColumnsType<RiskDossier> = [
    {
      title: '纳税人',
      dataIndex: 'company_name',
      key: 'company_name',
      render: (value, record) => <Button type="link" onClick={() => showDetail(record.taxpayer_id)}>{value}</Button>,
    },
    { title: '识别号', dataIndex: 'taxpayer_id', key: 'taxpayer_id', width: 180 },
    { title: '登记状态', dataIndex: 'registration_status', key: 'registration_status', width: 100, render: v => v || <Text type="secondary">—</Text> },
    { title: '管理员', dataIndex: 'tax_officer', key: 'tax_officer', width: 110, render: v => v || <Text type="secondary">—</Text> },
    { title: '行业标签', dataIndex: 'industry_tag', key: 'industry_tag', width: 100, render: v => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
    { title: '地址标签', dataIndex: 'address_tag', key: 'address_tag', width: 110, render: v => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text> },
    {
      title: '最新事项',
      dataIndex: 'latest_entry_status',
      key: 'latest_entry_status',
      width: 100,
      render: v => v ? <Tag color={statusColor[v]}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    { title: '记录时间', dataIndex: 'latest_recorded_at', key: 'latest_recorded_at', width: 160, render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : <Text type="secondary">—</Text> },
    { title: '整改期限', dataIndex: 'latest_rectification_deadline', key: 'latest_rectification_deadline', width: 120, render: (v, record) => v ? <Tag color={record.is_overdue ? 'red' : 'blue'}>{dayjs(v).format('YYYY-MM-DD')}</Tag> : <Text type="secondary">—</Text> },
    { title: '记录内容', dataIndex: 'latest_content', key: 'latest_content', ellipsis: true, render: v => v || <Text type="secondary">—</Text> },
    {
      title: '本次记录',
      key: 'inline_record',
      width: 560,
      render: (_, record) => {
        const draft = rowDrafts[record.taxpayer_id] || {}
        return (
          <Space.Compact style={{ width: '100%' }}>
            <DatePicker value={draft.recorded_at || dayjs()} onChange={value => updateDraft(record.taxpayer_id, { recorded_at: value })} style={{ width: 130 }} />
            <Select value={draft.entry_status || '待核实'} onChange={value => updateDraft(record.taxpayer_id, { entry_status: value })} options={statuses.map(s => ({ value: s, label: s }))} style={{ width: 100 }} />
            <Input value={draft.content} onChange={event => updateDraft(record.taxpayer_id, { content: event.target.value })} placeholder="记录内容" style={{ width: 200 }} />
            <Input value={draft.contact_person} onChange={event => updateDraft(record.taxpayer_id, { contact_person: event.target.value })} placeholder="联系人" style={{ width: 90 }} />
            <Button type="primary" onClick={() => handleInlineSave(record)}>保存</Button>
          </Space.Compact>
        )
      },
    },
    { title: '次数', dataIndex: 'entry_count', key: 'entry_count', width: 70 },
  ]

  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="管户记录"
        moduleDesc="企业列表内直接记录风险、排除和整改情况"
        items={[{ key: 'index', label: '管户记录', path: '/modules/risk-ledger' }]}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Card size="small"><Statistic title="档案数" value={stats?.dossier_total || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="记录数" value={stats?.entry_total || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="待核实" value={stats?.pending_count || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="整改中" value={stats?.rectifying_count || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="已整改" value={stats?.rectified_count || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="临时档案" value={stats?.temporary_count || 0} /></Card></Col>
        </Row>

        <Card
          title="管户记录列表"
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              <Input.Search placeholder="税号/名称/法人/管理员/地址" allowClear onSearch={(value) => { setQuery(value); load(value) }} style={{ width: 260 }} />
              <Select placeholder="事项状态" allowClear value={entryStatus} onChange={setEntryStatus} style={{ width: 130 }} options={statuses.map(s => ({ value: s, label: s }))} />
              <Button onClick={() => load()}>刷新</Button>
            </Space>
          }
        >
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="taxpayer_id"
            loading={loading}
            size="small"
            scroll={{ x: 1500 }}
            pagination={{ total, pageSize: 50, hideOnSinglePage: true }}
            locale={{
              emptyText: query || entryStatus ? '没有符合当前筛选条件的企业' : '暂无企业数据。请先在首页导入税务登记信息查询数据源。',
            }}
          />
        </Card>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'single',
              label: '单户补充',
              children: (
                <Card>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="一户只建一个档案，可以连续追加多条风险和整改记录"
                    description="如果税号已在完整信息查询表中，系统会自动带出名称、登记状态、管理员和地址；未命中时填写纳税人名称即可建立临时档案。"
                  />
                  <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ entry_status: '待核实', recorded_at: dayjs() }}>
                    <Row gutter={12}>
                      <Col xs={24} md={8}><Form.Item label="纳税人识别号" name="taxpayer_id" rules={[{ required: true }]}><Input /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="纳税人名称（未命中时必填）" name="company_name"><Input /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="记录时间" name="recorded_at" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="事项状态" name="entry_status" rules={[{ required: true }]}><Select options={statuses.map(s => ({ value: s, label: s }))} /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="整改期限" name="rectification_deadline"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="联系人" name="contact_person"><Input /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="联系电话" name="contact_phone"><Input /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="登记状态" name="registration_status"><Input /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="管理员" name="tax_officer"><Input /></Form.Item></Col>
                      <Col span={24}><Form.Item label="地址" name="address"><Input /></Form.Item></Col>
                      <Col span={24}><Form.Item label="记录内容" name="content" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item></Col>
                      <Col span={24}><Form.Item label="备注" name="note"><Input.TextArea rows={2} /></Form.Item></Col>
                    </Row>
                    <Button type="primary" htmlType="submit">保存记录</Button>
                  </Form>
                </Card>
              ),
            },
            {
              key: 'batch',
              label: '批量记录',
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card title="粘贴税号批量记录">
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="批量记录适合同一风险、同一处理口径"
                        description="如果每户风险内容不同，请使用右侧表格逐行导入。标记整改中时建议填写整改期限和联系人，便于首页催办。"
                      />
                      <Form form={batchForm} layout="vertical" onFinish={handleBatchText} initialValues={{ entry_status: '待核实', recorded_at: dayjs() }}>
                        <Form.Item label="纳税人识别号（换行、逗号或空格分隔）" name="taxpayer_ids" rules={[{ required: true }]}><Input.TextArea rows={5} /></Form.Item>
                        <Form.Item label="记录时间" name="recorded_at" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
                        <Form.Item label="事项状态" name="entry_status" rules={[{ required: true }]}><Select options={statuses.map(s => ({ value: s, label: s }))} /></Form.Item>
                        <Form.Item label="整改期限" name="rectification_deadline"><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
                        <Form.Item label="联系人" name="contact_person"><Input /></Form.Item>
                        <Form.Item label="联系电话" name="contact_phone"><Input /></Form.Item>
                        <Form.Item label="统一记录内容" name="content" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
                        <Form.Item label="备注" name="note"><Input.TextArea rows={2} /></Form.Item>
                        <Button type="primary" htmlType="submit">批量保存</Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="上传表格逐行记录">
                      <Paragraph type="secondary">
                        支持 CSV、XLS、XLSX。必填表头：纳税人识别号、记录时间、记录内容；可选：纳税人名称、状态、管理员、地址、事项状态、整改期限、联系人、联系电话、备注。
                      </Paragraph>
                      <Upload.Dragger accept=".csv,.xls,.xlsx" customRequest={({ file }) => handleUpload(file as File)}>
                        <p><UploadOutlined style={{ fontSize: 28 }} /></p>
                        <p>点击或拖拽上传风险记录表</p>
                      </Upload.Dragger>
                    </Card>
                  </Col>
                </Row>
              ),
            },
          ]}
        />

        {failures.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`有 ${failures.length} 条记录未成功`}
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Table
                  size="small"
                  rowKey={(item, index) => `${item.taxpayer_id || 'row'}-${index}`}
                  pagination={false}
                  dataSource={failures.slice(0, 8)}
                  columns={[
                    { title: '行号', dataIndex: 'row', width: 80, render: v => v || '—' },
                    { title: '纳税人识别号', dataIndex: 'taxpayer_id', width: 180, render: v => v || '—' },
                    { title: '失败原因', dataIndex: 'reason', render: v => v || '请检查表头和必填字段' },
                    { title: '建议处理方式', render: (_, item) => item.reason?.includes('未找到') ? '补充纳税人名称后创建临时档案，或先导入完整信息查询表' : '按失败原因修正后重新导入' },
                  ]}
                />
                <Button size="small" onClick={downloadFailures}>下载失败清单</Button>
              </Space>
            }
          />
        )}

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
      </ModuleLayout>
    </PlatformLayout>
  )
}
