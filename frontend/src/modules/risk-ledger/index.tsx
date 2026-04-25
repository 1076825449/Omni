import { useEffect, useState } from 'react'
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, List, Modal, Row,
  Select, Space, Statistic, Table, Tabs, Tag, Timeline, Typography, Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import { RiskDossier, riskLedgerApi } from '../../services/api'
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
  const [rows, setRows] = useState<RiskDossier[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [entryStatus, setEntryStatus] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [failures, setFailures] = useState<Array<Record<string, string>>>([])
  const message = useAppMessage()

  const load = (q = query) => {
    setLoading(true)
    Promise.all([
      riskLedgerApi.list({ q, entry_status: entryStatus, limit: 50 }),
      riskLedgerApi.stats(),
    ]).then(([list, stat]) => {
      setRows(list.dossiers)
      setTotal(list.total)
      setStats(stat)
      setLoading(false)
    }).catch(() => {
      void message.error('加载风险台账失败')
      setLoading(false)
    })
  }

  useEffect(() => { load('') }, [entryStatus])

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
      })
      void message.success('记录已保存')
      form.resetFields()
      load()
    } catch {
      void message.error('保存失败；若信息表未命中，请填写纳税人名称后创建临时档案')
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
        content: values.content,
        entry_status: values.entry_status,
        note: values.note,
      })
      setFailures(result.failures)
      void message.success(result.message)
      batchForm.resetFields()
      load()
    } catch {
      void message.error('批量记录失败')
    }
  }

  const handleUpload = async (file: File) => {
    try {
      const result = await riskLedgerApi.importFile(file)
      setFailures(result.failures)
      void message.success(result.message)
      load()
    } catch {
      void message.error('导入失败，请检查表头')
    }
    return false
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
    {
      title: '最新事项',
      dataIndex: 'latest_entry_status',
      key: 'latest_entry_status',
      width: 100,
      render: v => v ? <Tag color={statusColor[v]}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    { title: '记录时间', dataIndex: 'latest_recorded_at', key: 'latest_recorded_at', width: 160, render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : <Text type="secondary">—</Text> },
    { title: '记录内容', dataIndex: 'latest_content', key: 'latest_content', ellipsis: true, render: v => v || <Text type="secondary">—</Text> },
    { title: '次数', dataIndex: 'entry_count', key: 'entry_count', width: 70 },
  ]

  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="风险记录台账"
        moduleDesc="一户一档 · 风险留痕 · 排除整改跟踪"
        items={[{ key: 'index', label: '台账', path: '/modules/risk-ledger' }]}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Card size="small"><Statistic title="档案数" value={stats?.dossier_total || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="记录数" value={stats?.entry_total || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="待核实" value={stats?.pending_count || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="整改中" value={stats?.rectifying_count || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="已整改" value={stats?.rectified_count || 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="临时档案" value={stats?.temporary_count || 0} /></Card></Col>
        </Row>

        <Tabs
          items={[
            {
              key: 'single',
              label: '单户记录',
              children: (
                <Card>
                  <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ entry_status: '待核实', recorded_at: dayjs() }}>
                    <Row gutter={12}>
                      <Col xs={24} md={8}><Form.Item label="纳税人识别号" name="taxpayer_id" rules={[{ required: true }]}><Input /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="纳税人名称（未命中时必填）" name="company_name"><Input /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="记录时间" name="recorded_at" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="事项状态" name="entry_status" rules={[{ required: true }]}><Select options={statuses.map(s => ({ value: s, label: s }))} /></Form.Item></Col>
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
                      <Form form={batchForm} layout="vertical" onFinish={handleBatchText} initialValues={{ entry_status: '待核实', recorded_at: dayjs() }}>
                        <Form.Item label="纳税人识别号（换行、逗号或空格分隔）" name="taxpayer_ids" rules={[{ required: true }]}><Input.TextArea rows={5} /></Form.Item>
                        <Form.Item label="记录时间" name="recorded_at" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
                        <Form.Item label="事项状态" name="entry_status" rules={[{ required: true }]}><Select options={statuses.map(s => ({ value: s, label: s }))} /></Form.Item>
                        <Form.Item label="统一记录内容" name="content" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
                        <Form.Item label="备注" name="note"><Input.TextArea rows={2} /></Form.Item>
                        <Button type="primary" htmlType="submit">批量保存</Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="上传表格逐行记录">
                      <Paragraph type="secondary">
                        支持 CSV、XLS、XLSX。必填表头：纳税人识别号、记录时间、记录内容；可选：纳税人名称、状态、管理员、地址、事项状态、备注。
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
            description={<List size="small" dataSource={failures.slice(0, 8)} renderItem={(item) => <List.Item>{JSON.stringify(item)}</List.Item>} />}
          />
        )}

        <Card
          title="风险记录台账"
          extra={
            <Space>
              <Input.Search placeholder="税号/名称/地址" allowClear onSearch={(value) => { setQuery(value); load(value) }} style={{ width: 240 }} />
              <Select placeholder="事项状态" allowClear value={entryStatus} onChange={setEntryStatus} style={{ width: 130 }} options={statuses.map(s => ({ value: s, label: s }))} />
              <Button onClick={() => load()}>刷新</Button>
            </Space>
          }
        >
          <Table columns={columns} dataSource={rows} rowKey="taxpayer_id" loading={loading} size="small" pagination={{ total, pageSize: 50, hideOnSinglePage: true }} />
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
