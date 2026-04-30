import { useEffect, useState } from 'react'
import type { Key } from 'react'
import { Alert, Button, Card, DatePicker, Form, Input, Modal, Select, Space, Statistic, Table, Tag, Typography, Row, Col } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { RiskDossier, riskLedgerApi, taxOfficerWorkbenchApi } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'

const { Title, Text } = Typography
const statusColor: Record<string, string> = { 待核实: 'orange', 已排除: 'green', 整改中: 'blue', 已整改: 'purple' }

export default function MyRiskList() {
  const [rows, setRows] = useState<RiskDossier[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [entryStatus, setEntryStatus] = useState<string | undefined>()
  const [overdue, setOverdue] = useState<boolean | undefined>()
  const [temporary, setTemporary] = useState<boolean | undefined>()
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [rectifyOpen, setRectifyOpen] = useState(false)
  const [rectifyForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const message = useAppMessage()

  const load = (keyword = q) => {
    setLoading(true)
    taxOfficerWorkbenchApi.myRiskList({ q: keyword, entry_status: entryStatus, overdue, temporary, limit: 50 })
      .then((data) => {
        setRows(data.items)
        setTotal(data.total)
        setSummary(data.summary)
        setLoading(false)
      })
      .catch(() => {
        void message.error('加载管户风险清单失败')
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [entryStatus, overdue, temporary])

  const handleBatchStatus = (status: string) => {
    if (selectedRowKeys.length === 0) {
      void message.warning('请先勾选需要处理的纳税人')
      return
    }
    if (status === '整改中') {
      setRectifyOpen(true)
      return
    }
    Modal.confirm({
      title: `确认批量标记为“${status}”？`,
      content: `将为已勾选的 ${selectedRowKeys.length} 户企业追加一条处理记录，原历史记录不会被覆盖。`,
      okText: '确认处理',
      cancelText: '取消',
      onOk: async () => {
        const result = await riskLedgerApi.batchStatus({
          taxpayer_ids: selectedRowKeys.map(String),
          entry_status: status,
          content: `管户风险清单批量标记为：${status}`,
        })
        setSelectedRowKeys([])
        void message.success(result.message)
        load()
      },
    })
  }

  const submitRectifying = async (values: any) => {
    const result = await riskLedgerApi.batchStatus({
      taxpayer_ids: selectedRowKeys.map(String),
      entry_status: '整改中',
      content: '管户风险清单批量标记为：整改中',
      rectification_deadline: values.rectification_deadline.format('YYYY-MM-DD HH:mm:ss'),
      contact_person: values.contact_person,
      contact_phone: values.contact_phone,
    })
    setSelectedRowKeys([])
    setRectifyOpen(false)
    rectifyForm.resetFields()
    void message.success(result.message)
    load()
  }

  const handleExport = () => {
    window.open(taxOfficerWorkbenchApi.myRiskListExportUrl({ q, entry_status: entryStatus, overdue, temporary }), '_blank')
  }

  const columns: ColumnsType<RiskDossier> = [
    {
      title: '纳税人名称',
      dataIndex: 'company_name',
      key: 'company_name',
      render: (value, record) => <Button type="link" onClick={() => navigate(`/taxpayer-workbench?taxpayer_id=${record.taxpayer_id}`)}>{value}</Button>,
    },
    { title: '纳税人识别号', dataIndex: 'taxpayer_id', key: 'taxpayer_id', width: 180 },
    { title: '登记状态', dataIndex: 'registration_status', key: 'registration_status', width: 100, render: v => v || <Text type="secondary">—</Text> },
    { title: '管理员', dataIndex: 'tax_officer', key: 'tax_officer', width: 110, render: v => v || <Text type="secondary">—</Text> },
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    { title: '最新风险', dataIndex: 'latest_content', key: 'latest_content', ellipsis: true, render: v => v || <Text type="secondary">—</Text> },
    { title: '处理状态', dataIndex: 'latest_entry_status', key: 'latest_entry_status', width: 100, render: v => v ? <Tag color={statusColor[v]}>{v}</Tag> : <Text type="secondary">—</Text> },
    { title: '最后记录', dataIndex: 'latest_recorded_at', key: 'latest_recorded_at', width: 140, render: v => v ? dayjs(v).format('YYYY-MM-DD') : <Text type="secondary">—</Text> },
    { title: '整改期限', dataIndex: 'latest_rectification_deadline', key: 'latest_rectification_deadline', width: 130, render: (v, record) => v ? <Tag color={record.is_overdue ? 'red' : 'blue'}>{dayjs(v).format('YYYY-MM-DD')}</Tag> : <Text type="secondary">—</Text> },
    { title: '联系人', dataIndex: 'latest_contact_person', key: 'latest_contact_person', width: 100, render: v => v || <Text type="secondary">—</Text> },
    { title: '逾期', dataIndex: 'is_overdue', key: 'is_overdue', width: 80, render: v => v ? <Tag color="red">逾期</Tag> : <Text type="secondary">—</Text> },
  ]

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>我的管户风险清单</Title>
        <Text type="secondary">按清单处理待核实、整改中和已整改的风险事项。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="管户风险户数" value={summary.dossier_total || 0} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="待核实" value={summary.pending_count || 0} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="整改中" value={summary.rectifying_count || 0} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="已整改" value={summary.rectified_count || 0} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="已排除" value={summary.excluded_count || 0} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="临时档案" value={summary.temporary_count || 0} /></Card></Col>
      </Row>

      <Card
        title="风险清单"
        extra={
          <Space>
            <Input.Search placeholder="企业名称、税号、地址" allowClear onSearch={(value) => { setQ(value); load(value) }} style={{ width: 240 }} />
            <Select
              placeholder="处理状态"
              allowClear
              value={entryStatus}
              onChange={setEntryStatus}
              style={{ width: 130 }}
              options={['待核实', '已排除', '整改中', '已整改'].map((item) => ({ value: item, label: item }))}
            />
            <Select
              placeholder="是否逾期"
              allowClear
              value={overdue}
              onChange={setOverdue}
              style={{ width: 120 }}
              options={[{ value: true, label: '逾期未整改' }, { value: false, label: '未逾期' }]}
            />
            <Select
              placeholder="档案来源"
              allowClear
              value={temporary}
              onChange={setTemporary}
              style={{ width: 120 }}
              options={[{ value: false, label: '信息表档案' }, { value: true, label: '临时档案' }]}
            />
            <Button onClick={() => navigate('/modules/risk-ledger')}>批量记录风险</Button>
            <Button onClick={handleExport}>导出清单</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="处理口径"
          description="这里只看每户最新处理状态。标记“整改中”必须填写整改期限和联系人，后续首页会据此催办临期和逾期事项。"
        />
        <Space style={{ marginBottom: 12 }} wrap>
          <Text type="secondary">已勾选 {selectedRowKeys.length} 户</Text>
          <Button size="small" onClick={() => handleBatchStatus('已排除')}>批量标记已排除</Button>
          <Button size="small" onClick={() => handleBatchStatus('整改中')}>批量标记整改中</Button>
          <Button size="small" onClick={() => handleBatchStatus('已整改')}>批量标记已整改</Button>
        </Space>
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="taxpayer_id"
          loading={loading}
          size="small"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total, pageSize: 50, hideOnSinglePage: true }}
          locale={{
            emptyText: q || entryStatus || overdue !== undefined || temporary !== undefined
              ? '没有符合当前筛选条件的企业，可调整搜索词或筛选项'
              : '暂无风险清单。可先从一户式工作台或案头分析结果记入风险台账。',
          }}
        />
      </Card>
      <Modal
        title="填写整改跟踪信息"
        open={rectifyOpen}
        onCancel={() => setRectifyOpen(false)}
        onOk={() => rectifyForm.submit()}
        okText="确认标记整改中"
        cancelText="取消"
      >
        <Form form={rectifyForm} layout="vertical" onFinish={submitRectifying}>
          <Form.Item label="整改期限" name="rectification_deadline" rules={[{ required: true, message: '请填写整改期限' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="联系人" name="contact_person" rules={[{ required: true, message: '请填写联系人' }]}>
            <Input placeholder="负责跟踪的税务人员" />
          </Form.Item>
          <Form.Item label="联系电话" name="contact_phone">
            <Input placeholder="联系电话" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
