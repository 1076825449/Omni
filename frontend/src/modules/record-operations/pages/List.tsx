// 对象管理模块 - 列表页
import { useEffect, useState } from 'react'
import {
  Alert, Card, Table, Tag, Button, Space, Input, Select, Typography,
  Empty, Pagination, Modal, Checkbox, Popconfirm, AutoComplete,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { recordsApi, RecordItem } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '活跃', color: 'green' },
  archived: { text: '已归档', color: 'default' },
  locked: { text: '已锁定', color: 'red' },
}

export default function RecordList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [records, setRecords] = useState<RecordItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [tag, setTag] = useState<string | undefined>()
  const [selected, setSelected] = useState<string[]>([])
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [batchCategory, setBatchCategory] = useState('')
  const [batchAssignee, setBatchAssignee] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const batch = searchParams.get('batch') || undefined
  const navigate = useNavigate()
  const message = useAppMessage()

  const categoryOptions = Array.from(new Set(records.map((record) => record.category).filter(Boolean))).map((value) => ({ value, label: value }))

  const load = (p = 1) => {
    setLoading(true)
    recordsApi.list({
      batch,
      q: query || undefined,
      category,
      status,
      tags: tag,
      limit: 10,
      offset: (p - 1) * 10,
    })
      .then(({ records: data, total: n }) => {
        setRecords(data)
        setTotal(n)
        setLoading(false)
        setSelected([])
      })
      .catch(() => { void message.error('加载失败'); setLoading(false) })
  }

  // 加载标签建议
  const loadTagSuggestions = (q: string) => {
    void recordsApi.tagSuggestions(q)
      .then((data) => setTagSuggestions(data.tags))
      .catch(() => setTagSuggestions([]))
  }

  useEffect(() => {
    load(1)
    setPage(1)
  }, [batch, query, category, status, tag])

  const handleBatchUpdate = async () => {
    try {
      const res = await recordsApi.batchUpdate(selected, {
        category: batchCategory || undefined,
        assignee: batchAssignee || undefined,
      })
      void message.success(res.message)
      setBatchModalOpen(false)
      load(page)
    } catch { void message.error('批量更新失败') }
  }

  const handleBatchDelete = async () => {
    try {
      const res = await recordsApi.batchDelete(selected)
      void message.success(res.message)
      setDeleteModalOpen(false)
      load(page)
    } catch { void message.error('批量删除失败') }
  }

  const handleDelete = async (id: string) => {
    try {
      await recordsApi.delete(id)
      void message.success('已归档')
      load(page)
    } catch { void message.error('操作失败') }
  }

  const columns: ColumnsType<RecordItem> = [
    {
      title: <Checkbox
        checked={selected.length === records.length && records.length > 0}
        indeterminate={selected.length > 0 && selected.length < records.length}
        onChange={e => setSelected(e.target.checked ? records.map(r => r.record_id) : [])}
      />,
      key: 'checkbox', width: 40, fixed: 'left',
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r) => (
        <Button type="link" onClick={() => navigate(`/modules/record-operations/${r.record_id}`)}>{name}</Button>
      ),
    },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120, render: c => c || <Text type="secondary">—</Text> },
    { title: '负责人', dataIndex: 'assignee', key: 'assignee', width: 120, render: a => a || <Text type="secondary">—</Text> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text ?? s}</Tag> },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (t: string) => t
        ? t.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => <Tag key={tag} style={{ marginBottom: 2 }}>{tag}</Tag>)
        : <Text type="secondary">—</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, r: RecordItem) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/modules/record-operations/${r.record_id}`)}>详情</Button>
          <Popconfirm title="确认归档？" onConfirm={() => handleDelete(r.record_id)}>
            <Button size="small" danger>归档</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="对象列表"
      extra={
        <Space>
          {selected.length > 0 && (
            <>
              <Button type="primary" onClick={() => setBatchModalOpen(true)}>
                批量更新 ({selected.length})
              </Button>
              <Button danger onClick={() => setDeleteModalOpen(true)}>
                批量删除 ({selected.length})
              </Button>
            </>
          )}
          <Button onClick={() => navigate('/modules/record-operations/new')}>新建对象</Button>
        </Space>
      }
    >
      {batch && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="当前正在查看分析同步对象"
          description={
            <Space wrap>
              <Text code>{batch}</Text>
              <Button size="small" onClick={() => setSearchParams({})}>清除筛选</Button>
            </Space>
          }
        />
      )}
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="搜索名称/标签/说明"
          style={{ width: 200 }}
          allowClear
          onSearch={(value) => setQuery(value.trim())}
        />
        <Select
          placeholder="分类"
          style={{ width: 140 }}
          allowClear
          options={categoryOptions}
          value={category}
          onChange={(value) => setCategory(value)}
        />
        <Select
          placeholder="状态"
          style={{ width: 120 }}
          allowClear
          value={status}
          options={[
            { value: 'active', label: '活跃' },
            { value: 'archived', label: '已归档' },
            { value: 'locked', label: '已锁定' },
          ]}
          onChange={(value) => setStatus(value)}
        />
        <AutoComplete
          placeholder="按标签过滤"
          style={{ width: 160 }}
          options={tagSuggestions.map(t => ({ value: t }))}
          onSearch={loadTagSuggestions}
          onSelect={(value) => setTag(value)}
          onChange={(value) => setTag(value || undefined)}
          allowClear
        />
      </Space>

      {records.length === 0 && !loading ? (
        <Empty description="暂无对象数据" style={{ marginTop: 80 }}>
          <Button type="primary" onClick={() => navigate('/modules/record-operations/new')}>新建第一个对象</Button>
        </Empty>
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={records}
            rowKey="id"
            size="small"
            pagination={false}
            loading={loading}
            scroll={{ x: 700 }}
            rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) }}
          />
          {total > 10 && (
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Pagination
                current={page}
                total={total}
                pageSize={10}
                onChange={p => { setPage(p); load(p) }}
                showSizeChanger={false}
                showTotal={t => `共 ${t} 条`}
              />
            </div>
          )}
        </>
      )}

      {/* 批量更新弹窗 */}
      <Modal title={`批量更新 ${selected.length} 条对象`} open={batchModalOpen} onOk={handleBatchUpdate} onCancel={() => setBatchModalOpen(false)}>
        <Space style={{ width: '100%' }} direction="vertical">
          <Text type="secondary">将更新 {selected.length} 条对象</Text>
          <Text>分类：<Input style={{ width: 200 }} onChange={e => setBatchCategory(e.target.value)} placeholder="留空则不修改" /></Text>
          <Text>负责人：<Input style={{ width: 200 }} onChange={e => setBatchAssignee(e.target.value)} placeholder="留空则不修改" /></Text>
        </Space>
      </Modal>

      {/* 批量删除确认弹窗 */}
      <Modal
        title={`确认删除 ${selected.length} 条对象？`}
        open={deleteModalOpen}
        okText="确认删除"
        okType="danger"
        onOk={handleBatchDelete}
        onCancel={() => setDeleteModalOpen(false)}
      >
        <Text type="danger">此操作不可恢复！将彻底删除 {selected.length} 条对象。</Text>
      </Modal>
    </Card>
  )
}
