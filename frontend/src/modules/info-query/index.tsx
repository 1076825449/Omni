import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Input, List, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { UploadOutlined } from '@ant-design/icons'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import { infoQueryApi, TaxpayerProfile } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'

const { Text } = Typography

export default function InfoQueryModule() {
  const [rows, setRows] = useState<TaxpayerProfile[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<{ tax_officer?: string; manager_department?: string; industry_tag?: string; address_tag?: string; registration_status?: string }>({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
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

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const result = await infoQueryApi.importFile(file)
      message.success(result.message)
      load('')
    } catch {
      message.error('导入失败：请确认表头包含“纳税人识别号”和“纳税人名称”，文件未被加密且格式为 CSV/XLS/XLSX/JSON')
    } finally {
      setUploading(false)
    }
    return false
  }

  const columns: ColumnsType<TaxpayerProfile> = [
    {
      title: '企业',
      dataIndex: 'company_name',
      key: 'company_name',
      render: (value, record) => <Button type="link" onClick={() => setSelected(record)}>{value}</Button>,
    },
    { title: '纳税人识别号', dataIndex: 'taxpayer_id', key: 'taxpayer_id', width: 180 },
    { title: '行业', dataIndex: 'industry', key: 'industry', width: 140 },
    { title: '行业标签', dataIndex: 'industry_tag', key: 'industry_tag', width: 110, render: v => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">未分类</Text> },
    { title: '地址标签', dataIndex: 'address_tag', key: 'address_tag', width: 120, render: v => v ? <Tag>{v}</Tag> : <Text type="secondary">未识别</Text> },
    { title: '属地', dataIndex: 'region', key: 'region', width: 120 },
    { title: '管户部门', dataIndex: 'manager_department', key: 'manager_department', width: 140 },
    { title: '管理员', dataIndex: 'tax_officer', key: 'tax_officer', width: 120 },
    {
      title: '风险',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 90,
      render: (value) => value ? <Tag color={value.includes('高') ? 'red' : value.includes('中') ? 'orange' : 'blue'}>{value}</Tag> : <Text type="secondary">未标记</Text>,
    },
  ]

  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="管户分配"
        moduleDesc="展示全部管户，按管理员、行业标签、地址标签查看和筛选"
        items={[{ key: 'index', label: '查询与导入', path: '/modules/info-query' }]}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}><Card size="small"><Statistic title="纳税人总数" value={stats?.total || 0} /></Card></Col>
          <Col xs={24} md={8}><Card size="small"><Statistic title="管理员数" value={Object.keys(stats?.by_officer || {}).length} /></Card></Col>
          <Col xs={24} md={8}><Card size="small"><Statistic title="管理部门数" value={Object.keys(stats?.by_department || {}).length} /></Card></Col>
        </Row>

        <Card title="导入完整信息查询表 / 管户分配数据源" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="这是全系统的基础数据源" description="首页也可以导入。导入后，信息查询、管户分配、管户记录、案头分析和后续模块都会自动带出企业名称、登记状态、管理员、行业标签和地址标签。" />
            <Text type="secondary">
              支持 CSV、XLS、XLSX、JSON。必备字段：纳税人识别号、纳税人名称；建议字段：登记状态、行业、主管税务机关、管理分局、税收管理员、地址、风险等级、纳税信用等级。
            </Text>
            <Upload.Dragger accept=".csv,.xls,.xlsx,.json" customRequest={({ file }) => handleUpload(file as File)} disabled={uploading}>
              <p><UploadOutlined style={{ fontSize: 28 }} /></p>
              <p>点击或拖拽上传信息查询表</p>
            </Upload.Dragger>
          </Space>
        </Card>

        <Card
          title="管户查询"
          extra={
            <Space>
              <Input.Search
                placeholder="企业名称、税号、法人、管理员"
                allowClear
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onSearch={(value) => load(value)}
                style={{ width: 260 }}
              />
              <Button onClick={() => load(q)}>刷新</Button>
            </Space>
          }
      >
          <Space wrap style={{ marginBottom: 12 }}>
            <Select placeholder="管理员" allowClear style={{ width: 150 }} value={filters.tax_officer} onChange={value => setFilters(prev => ({ ...prev, tax_officer: value }))} options={Object.keys(stats?.by_officer || {}).map(value => ({ value: value === '未分配' ? '' : value, label: value }))} />
            <Select placeholder="管户部门" allowClear style={{ width: 180 }} value={filters.manager_department} onChange={value => setFilters(prev => ({ ...prev, manager_department: value }))} options={Object.keys(stats?.by_department || {}).map(value => ({ value: value === '未分配' ? '' : value, label: value }))} />
            <Select placeholder="行业标签" allowClear style={{ width: 150 }} value={filters.industry_tag} onChange={value => setFilters(prev => ({ ...prev, industry_tag: value }))} options={Object.keys(stats?.by_industry_tag || {}).map(value => ({ value: value === '未分类' ? '' : value, label: value }))} />
            <Select placeholder="地址标签" allowClear style={{ width: 150 }} value={filters.address_tag} onChange={value => setFilters(prev => ({ ...prev, address_tag: value }))} options={Object.keys(stats?.by_address_tag || {}).filter(value => value !== '未识别地址').map(value => ({ value, label: value }))} />
            <Select placeholder="登记状态" allowClear style={{ width: 140 }} value={filters.registration_status} onChange={value => setFilters(prev => ({ ...prev, registration_status: value }))} options={[...new Set(rows.map(row => row.registration_status).filter(Boolean))].map(value => ({ value, label: value }))} />
            <Button onClick={() => setFilters({})}>清空筛选</Button>
          </Space>
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="taxpayer_id"
            loading={loading}
            size="small"
            pagination={{ total, pageSize: 50, hideOnSinglePage: true }}
            locale={{
              emptyText: q ? '没有匹配的纳税人，请换用税号、企业简称或先导入完整信息查询表' : '暂无纳税人信息，请先导入完整信息查询表',
            }}
          />
        </Card>

        {stats && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={8}>
              <Card title="按管理员" size="small">
                <List size="small" dataSource={Object.entries(stats.by_officer)} renderItem={([name, count]) => <List.Item><Text>{name}</Text><Tag>{count}</Tag></List.Item>} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="按管户部门" size="small">
                <List size="small" dataSource={Object.entries(stats.by_department)} renderItem={([name, count]) => <List.Item><Text>{name}</Text><Tag>{count}</Tag></List.Item>} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="按风险等级" size="small">
                <List size="small" dataSource={Object.entries(stats.by_risk_level)} renderItem={([name, count]) => <List.Item><Text>{name}</Text><Tag>{count}</Tag></List.Item>} />
              </Card>
            </Col>
          </Row>
        )}

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
      </ModuleLayout>
    </PlatformLayout>
  )
}
