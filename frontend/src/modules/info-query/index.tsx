import { useEffect, useState } from 'react'
import { Button, Card, Descriptions, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import PlatformLayout from '../../components/Layout'
import { infoQueryApi, TaxpayerProfile } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'

const { Title, Text } = Typography

export default function InfoQueryModule() {
  const [rows, setRows] = useState<TaxpayerProfile[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<{ tax_officer?: string; manager_department?: string; industry_tag?: string; address_tag?: string; registration_status?: string }>({})
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [stats, setStats] = useState<{ by_officer: Record<string, number>; by_department: Record<string, number>; by_risk_level: Record<string, number>; by_industry_tag: Record<string, number>; by_address_tag: Record<string, number>; total: number } | null>(null)
  const [selected, setSelected] = useState<TaxpayerProfile | null>(null)
  const message = useAppMessage()

  const load = (keyword = q) => {
    setLoading(true)
    Promise.all([
      infoQueryApi.list({ q: keyword, ...filters, limit: 50 }),
      infoQueryApi.assignmentStats(),
    ]).then(([list, stat]) => {
      setRows(list.taxpayers)
      setTotal(list.total)
      setStats(stat)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load(q) }, [filters])

  const handleExport = async () => {
    setExporting(true)
    try {
      await infoQueryApi.exportFile({ q, ...filters })
      message.success('已开始导出，字段与税务登记信息查询模板一致')
    } catch {
      message.error('导出失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnsType<TaxpayerProfile> = [
    {
      title: '纳税人名称',
      dataIndex: 'company_name',
      key: 'company_name',
      fixed: 'left',
      width: 320,
      render: (value, record) => (
        <Button type="link" style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setSelected(record)}>
          {value}
        </Button>
      ),
    },
    { title: '纳税人识别号', dataIndex: 'taxpayer_id', key: 'taxpayer_id', width: 210 },
    { title: '登记状态', dataIndex: 'registration_status', key: 'registration_status', width: 110 },
    { title: '税收管理员', dataIndex: 'tax_officer', key: 'tax_officer', width: 120 },
    { title: '管户部门', dataIndex: 'manager_department', key: 'manager_department', width: 260 },
    { title: '行业标签', dataIndex: 'industry_tag', key: 'industry_tag', width: 180, render: v => v ? <Tag color="blue" style={{ whiteSpace: 'normal' }}>{v}</Tag> : <Text type="secondary">未分类</Text> },
    { title: '地址标签', dataIndex: 'address_tag', key: 'address_tag', width: 180, render: v => v ? <Tag style={{ whiteSpace: 'normal' }}>{v}</Tag> : <Text type="secondary">未识别</Text> },
    { title: '行业', dataIndex: 'industry', key: 'industry', width: 180 },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 110,
      render: (value) => value ? <Tag color={value.includes('高') ? 'red' : value.includes('中') ? 'orange' : 'blue'}>{value}</Tag> : <Text type="secondary">未标记</Text>,
    },
  ]

  return (
    <PlatformLayout>
      <div style={{ padding: 16 }}>
        <Card
          styles={{ body: { padding: 16 } }}
          style={{ width: '100%' }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} align="center" wrap>
            <Space direction="vertical" size={0}>
              <Title level={4} style={{ margin: 0 }}>管户分配</Title>
              <Text type="secondary">共 {stats?.total ?? total} 户</Text>
            </Space>
            <Space wrap>
              <Input.Search
                placeholder="企业名称、税号、法人、管理员"
                allowClear
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onSearch={(value) => load(value)}
                style={{ width: 340 }}
              />
              <Button onClick={handleExport} loading={exporting}>导出当前结果</Button>
              <Button onClick={() => load(q)}>刷新</Button>
            </Space>
          </Space>

          <Space wrap style={{ marginBottom: 12 }}>
            <Select placeholder="管理员" allowClear style={{ width: 160 }} value={filters.tax_officer} onChange={value => setFilters(prev => ({ ...prev, tax_officer: value }))} options={Object.keys(stats?.by_officer || {}).map(value => ({ value: value === '未分配' ? '' : value, label: value }))} />
            <Select placeholder="管户部门" allowClear style={{ width: 220 }} value={filters.manager_department} onChange={value => setFilters(prev => ({ ...prev, manager_department: value }))} options={Object.keys(stats?.by_department || {}).map(value => ({ value: value === '未分配' ? '' : value, label: value }))} />
            <Select placeholder="行业标签" allowClear style={{ width: 180 }} value={filters.industry_tag} onChange={value => setFilters(prev => ({ ...prev, industry_tag: value }))} options={Object.keys(stats?.by_industry_tag || {}).map(value => ({ value: value === '未分类' ? '' : value, label: value }))} />
            <Select placeholder="地址标签" allowClear style={{ width: 180 }} value={filters.address_tag} onChange={value => setFilters(prev => ({ ...prev, address_tag: value }))} options={Object.keys(stats?.by_address_tag || {}).filter(value => value !== '未识别地址').map(value => ({ value, label: value }))} />
            <Select placeholder="登记状态" allowClear style={{ width: 150 }} value={filters.registration_status} onChange={value => setFilters(prev => ({ ...prev, registration_status: value }))} options={[...new Set(rows.map(row => row.registration_status).filter(Boolean))].map(value => ({ value, label: value }))} />
            <Button onClick={() => setFilters({})}>清空筛选</Button>
          </Space>
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="taxpayer_id"
            loading={loading}
            size="small"
            scroll={{ x: 1700, y: 'calc(100vh - 300px)' }}
            pagination={{ total, pageSize: 50, showTotal: value => `共 ${value} 户` }}
            locale={{
              emptyText: q ? '没有匹配的纳税人，请换用税号、企业简称或清空筛选' : '暂无纳税人信息，请先在首页导入税务登记信息查询表',
            }}
          />
        </Card>

        <Modal title="纳税人信息" open={!!selected} onCancel={() => setSelected(null)} footer={null} width={760}>
          {selected && (
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="企业名称">{selected.company_name}</Descriptions.Item>
              <Descriptions.Item label="纳税人识别号">{selected.taxpayer_id}</Descriptions.Item>
              <Descriptions.Item label="法人">{selected.legal_person || '—'}</Descriptions.Item>
              <Descriptions.Item label="纳税人类型">{selected.taxpayer_type || '—'}</Descriptions.Item>
              <Descriptions.Item label="登记状态">{selected.registration_status || '—'}</Descriptions.Item>
              <Descriptions.Item label="行业">{selected.industry || '—'}</Descriptions.Item>
              <Descriptions.Item label="行业标签">{selected.industry_tag || '—'}</Descriptions.Item>
              <Descriptions.Item label="属地">{selected.region || '—'}</Descriptions.Item>
              <Descriptions.Item label="地址标签">{selected.address_tag || '—'}</Descriptions.Item>
              <Descriptions.Item label="主管税务机关">{selected.tax_bureau || '—'}</Descriptions.Item>
              <Descriptions.Item label="管户部门">{selected.manager_department || '—'}</Descriptions.Item>
              <Descriptions.Item label="管理员">{selected.tax_officer || '—'}</Descriptions.Item>
              <Descriptions.Item label="信用等级">{selected.credit_rating || '—'}</Descriptions.Item>
              <Descriptions.Item label="风险等级">{selected.risk_level || '—'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{selected.address || '—'}</Descriptions.Item>
              <Descriptions.Item label="经营范围" span={2}>{selected.business_scope || '—'}</Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
      </div>
    </PlatformLayout>
  )
}
