import { useEffect, useState } from 'react'
import type { Key } from 'react'
import { Button, Card, Descriptions, Empty, Input, Modal, Select, Skeleton, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import PlatformLayout from '../../components/Layout'
import { infoQueryApi, TaxpayerProfile } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'
import { useAuthStore } from '../../stores/auth'
import BusinessPageHeader from '../../components/BusinessPageHeader'

const { Text } = Typography
const townNames = ['百朋', '成团', '穿山', '进德', '三都', '里高', '土博']
type FilterOption = { value: string; label: string; count: number }
type FilterOptions = {
  officers: FilterOption[]
  departments: FilterOption[]
  registration_statuses: FilterOption[]
  industry_tags: FilterOption[]
  address_tags: FilterOption[]
  total: number
}

const normalizeAddressTagOption = (tag: string) => {
  const value = String(tag || '').trim()
  if (!value || value === '未识别地址') return ''
  for (const town of townNames) {
    if (value === `${town}镇` || value.startsWith(town)) {
      return `${town}镇`
    }
  }
  return value
}

const addressTagOptionsFromItems = (items: FilterOption[] = []) => {
  const tags = new Set<string>()
  items.forEach(item => {
    const value = item.value || item.label
    const normalized = normalizeAddressTagOption(value)
    if (normalized) tags.add(normalized)
  })
  return [...tags].sort((a, b) => a.localeCompare(b, 'zh-CN')).map(value => ({ value, label: value }))
}

export default function InfoQueryModule() {
  const [rows, setRows] = useState<TaxpayerProfile[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<{ tax_officer?: string; manager_department?: string; industry_tag?: string; address_tag?: string; registration_status?: string }>({})
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [batchOfficer, setBatchOfficer] = useState('')
  const [batchIndustryTag, setBatchIndustryTag] = useState('')
  const [batchAddressTag, setBatchAddressTag] = useState('')
  const [stats, setStats] = useState<{ by_officer: Record<string, number>; by_department: Record<string, number>; by_risk_level: Record<string, number>; by_industry_tag: Record<string, number>; by_address_tag: Record<string, number>; total: number } | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [selected, setSelected] = useState<TaxpayerProfile | null>(null)
  const message = useAppMessage()
  const permissions = useAuthStore(s => s.permissions)
  const canAssign = permissions.includes('module:info-query:assign')
  const canManageTags = permissions.includes('module:info-query:tag-manage')
  const pageSize = 30

  const load = (keyword = q, nextPage = page) => {
    setLoading(true)
    infoQueryApi.list({ q: keyword, ...filters, limit: pageSize, offset: (nextPage - 1) * pageSize }).then((list) => {
      setRows(list.taxpayers)
      setTotal(list.total)
      setLoading(false)
    }).catch(() => setLoading(false)).finally(() => setHasLoaded(true))
  }

  const loadStats = () => {
    Promise.all([infoQueryApi.assignmentStats(), infoQueryApi.filterOptions()])
      .then(([stat, options]) => {
        setStats(stat)
        setFilterOptions(options)
      })
      .catch(() => undefined)
  }

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    setPage(1)
    load(q, 1)
  }, [filters])

  const handleExport = async () => {
    setExporting(true)
    try {
      await infoQueryApi.exportFile({ q, ...filters, view: 'assignment' })
      message.success('已开始导出，字段与当前管户分配页面一致')
    } catch {
      message.error('导出失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  const officerOptions = (filterOptions?.officers || [])
    .filter(item => item.value)
    .map(item => ({ value: item.value, label: item.label }))
  const addressTagOptions = addressTagOptionsFromItems(filterOptions?.address_tags)
  const industryTagOptions = (filterOptions?.industry_tags || []).filter(item => item.value).map(item => ({ value: item.value, label: item.label }))
  const departmentOptions = (filterOptions?.departments || []).map(item => ({ value: item.value, label: item.label }))
  const registrationStatusOptions = (filterOptions?.registration_statuses || []).filter(item => item.value).map(item => ({ value: item.value, label: item.label }))
  const searchableSelectProps = {
    showSearch: true,
    optionFilterProp: 'label' as const,
    filterOption: (input: string, option?: { label?: unknown }) =>
      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
  }

  const doSaveAssignment = async (taxpayerIds: string[], proposedOfficer: string) => {
    setSavingAssignment(true)
    try {
      const result = await infoQueryApi.updateAssignment(taxpayerIds, proposedOfficer)
      setRows(prev => prev.map(row => taxpayerIds.includes(row.taxpayer_id) ? { ...row, tax_officer: result.tax_officer, proposed_tax_officer: result.proposed_tax_officer } : row))
      loadStats()
      message.success(`已分配 ${result.updated} 户税收管理员`)
    } catch {
      message.error('拟分配管理员保存失败，请稍后重试')
    } finally {
      setSavingAssignment(false)
    }
  }

  const confirmSaveAssignment = (taxpayerIds: string[], proposedOfficer: string) => {
    if (!taxpayerIds.length) {
      message.warning('请先选择需要分配的纳税人')
      return
    }
    Modal.confirm({
      title: '确认批量分配税收管理员？',
      content: `将把 ${taxpayerIds.length} 户企业的正式税收管理员修改为“${proposedOfficer || '空'}”。`,
      okText: '确认修改',
      cancelText: '取消',
      onOk: () => doSaveAssignment(taxpayerIds, proposedOfficer),
    })
  }

  const doSaveTags = async (tagType: 'industry' | 'address', taxpayerIds: string[], nextTag: string) => {
    setSavingTags(true)
    try {
      const result = await infoQueryApi.updateTags(taxpayerIds, tagType === 'industry' ? { industry_tag: nextTag } : { address_tag: nextTag })
      setRows(prev => prev.map(row => taxpayerIds.includes(row.taxpayer_id)
        ? { ...row, industry_tag: result.industry_tag || row.industry_tag, address_tag: result.address_tag || row.address_tag }
        : row))
      loadStats()
      message.success(`已修改 ${result.updated} 户${tagType === 'industry' ? '行业标签' : '地址标签'}`)
    } catch {
      message.error('批量修改标签失败，请稍后重试')
    } finally {
      setSavingTags(false)
    }
  }

  const saveTags = async (tagType: 'industry' | 'address') => {
    const taxpayerIds = selectedRowKeys.map(String)
    const nextTag = tagType === 'industry' ? batchIndustryTag.trim() : batchAddressTag.trim()
    if (!taxpayerIds.length) {
      message.warning('请先选择需要修改的纳税人')
      return
    }
    if (!nextTag) {
      message.warning(tagType === 'industry' ? '请填写行业标签' : '请填写地址标签')
      return
    }
    Modal.confirm({
      title: `确认批量修改${tagType === 'industry' ? '行业标签' : '地址标签'}？`,
      content: `将把 ${taxpayerIds.length} 户企业的${tagType === 'industry' ? '行业标签' : '地址标签'}修改为“${nextTag}”，人工调整后的标签后续导入不会覆盖。`,
      okText: '确认修改',
      cancelText: '取消',
      onOk: () => doSaveTags(tagType, taxpayerIds, nextTag),
    })
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
          <Tooltip title={value}><span className="business-long-text">{value}</span></Tooltip>
        </Button>
      ),
    },
    { title: '纳税人识别号', dataIndex: 'taxpayer_id', key: 'taxpayer_id', width: 210 },
    { title: '登记状态', dataIndex: 'registration_status', key: 'registration_status', width: 110 },
    { title: '税收管理员', dataIndex: 'tax_officer', key: 'tax_officer', width: 120 },
    { title: '行业标签', dataIndex: 'industry_tag', key: 'industry_tag', width: 180, render: v => v ? <Tag color="blue" className="business-tag">{v}</Tag> : <Text type="secondary">未分类</Text> },
    { title: '地址标签', dataIndex: 'address_tag', key: 'address_tag', width: 180, render: v => v ? <Tag className="business-tag">{v}</Tag> : <Text type="secondary">未识别</Text> },
    { title: '行业', dataIndex: 'industry', key: 'industry', width: 180, render: value => value ? <Tooltip title={value}><span className="business-long-text">{value}</span></Tooltip> : <Text type="secondary">—</Text> },
    { title: '经营地址', dataIndex: 'address', key: 'address', width: 320, render: value => value ? <Tooltip title={value}><span className="business-long-text">{value}</span></Tooltip> : <Text type="secondary">—</Text> },
  ]

  return (
    <PlatformLayout>
      <div className="business-page">
        <div className="business-page-wide">
        <BusinessPageHeader
          title="管户分配"
          description="展示全部管户，按管理员、行业标签、地址标签和登记状态筛选，并支持批量调整。"
          meta={<Text type="secondary">共 {stats?.total ?? total} 户</Text>}
        />
        <Card className="business-section" styles={{ body: { padding: 16 } }}>
          <div className="business-filter-section">
            <Space align="center" style={{ marginBottom: 10 }} wrap>
              <Tag color="blue">查询筛选</Tag>
              <Text type="secondary">先按企业、管理员、行业或地址查找需要分配的管户</Text>
            </Space>
            <Space align="center" wrap>
              <Input.Search
                placeholder="企业名称、税号、法人、管理员"
                allowClear
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onSearch={(value) => {
                  setPage(1)
                  load(value, 1)
                }}
                style={{ width: 340 }}
              />
              <Select {...searchableSelectProps} placeholder="管理员" allowClear style={{ width: 160 }} value={filters.tax_officer} onChange={value => setFilters(prev => ({ ...prev, tax_officer: value }))} options={filterOptions?.officers.map(item => ({ value: item.value, label: item.label })) || []} />
              <Select {...searchableSelectProps} placeholder="管户部门" allowClear style={{ width: 220 }} value={filters.manager_department} onChange={value => setFilters(prev => ({ ...prev, manager_department: value }))} options={departmentOptions} />
              <Select {...searchableSelectProps} placeholder="行业标签" allowClear style={{ width: 180 }} value={filters.industry_tag} onChange={value => setFilters(prev => ({ ...prev, industry_tag: value }))} options={industryTagOptions} />
              <Select {...searchableSelectProps} placeholder="地址标签" allowClear style={{ width: 180 }} value={filters.address_tag} onChange={value => setFilters(prev => ({ ...prev, address_tag: value }))} options={addressTagOptions} />
              <Select {...searchableSelectProps} placeholder="登记状态" allowClear style={{ width: 150 }} value={filters.registration_status} onChange={value => setFilters(prev => ({ ...prev, registration_status: value }))} options={registrationStatusOptions} />
              <Button onClick={() => setFilters({})}>清空筛选</Button>
              <Button onClick={handleExport} loading={exporting}>导出当前结果</Button>
              <Button onClick={() => load(q, page)}>刷新</Button>
            </Space>
          </div>

          <div className="business-batch-section">
            <Space align="center" style={{ marginBottom: 10 }} wrap>
              <Tag color="orange">批量调整</Tag>
              <Text type="secondary">先勾选企业，再统一修改正式税收管理员、行业标签或地址标签</Text>
              <Tag>已选 {selectedRowKeys.length} 户</Tag>
            </Space>
            <div>
              <Space align="center" wrap>
                <Select
                  showSearch
                  allowClear
                  placeholder="批量分配管理员"
                  value={batchOfficer || undefined}
                  onChange={value => setBatchOfficer(value || '')}
                  onSearch={setBatchOfficer}
                  options={officerOptions}
                  style={{ width: 190 }}
                />
                <Button
                  type="primary"
                  disabled={selectedRowKeys.length === 0 || !canAssign}
                  loading={savingAssignment}
                  onClick={() => confirmSaveAssignment(selectedRowKeys.map(String), batchOfficer)}
                >
                  批量分配{selectedRowKeys.length ? `（${selectedRowKeys.length}户）` : ''}
                </Button>
                <Select
                  showSearch
                  allowClear
                  placeholder="批量修改行业标签"
                  value={batchIndustryTag || undefined}
                  onChange={value => setBatchIndustryTag(value || '')}
                  onSearch={setBatchIndustryTag}
                  options={industryTagOptions}
                  style={{ width: 190 }}
                />
                <Button
                  disabled={selectedRowKeys.length === 0 || !canManageTags}
                  loading={savingTags}
                  onClick={() => saveTags('industry')}
                >
                  改行业标签{selectedRowKeys.length ? `（${selectedRowKeys.length}户）` : ''}
                </Button>
                <Select
                  showSearch
                  allowClear
                  placeholder="批量修改地址标签"
                  value={batchAddressTag || undefined}
                  onChange={value => setBatchAddressTag(value || '')}
                  onSearch={setBatchAddressTag}
                  options={addressTagOptions}
                  style={{ width: 190 }}
                />
                <Button
                  disabled={selectedRowKeys.length === 0 || !canManageTags}
                  loading={savingTags}
                  onClick={() => saveTags('address')}
                >
                  改地址标签{selectedRowKeys.length ? `（${selectedRowKeys.length}户）` : ''}
                </Button>
              </Space>
            </div>
          </div>
          {!hasLoaded ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <Table
              columns={columns}
              dataSource={rows}
              rowKey="taxpayer_id"
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              loading={loading}
              size="small"
              scroll={{ x: 1650 }}
              pagination={{
                current: page,
                total,
                pageSize,
                showSizeChanger: false,
                showTotal: value => `共 ${value} 户`,
                onChange: nextPage => {
                  setPage(nextPage)
                  load(q, nextPage)
                },
              }}
              locale={{
                emptyText: (
                  <Empty description={q || Object.values(filters).some(Boolean) ? '没有符合当前条件的纳税人' : '暂无纳税人信息，请先在首页导入税务登记信息查询表'}>
                    <Space>
                      <Button onClick={() => setFilters({})}>清空筛选</Button>
                      <Button onClick={() => load(q, page)}>刷新</Button>
                    </Space>
                  </Empty>
                ),
              }}
            />
          )}
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
      </div>
    </PlatformLayout>
  )
}
