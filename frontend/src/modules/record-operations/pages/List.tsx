// 对象管理模块 - 列表页
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Input, Select, Typography, Empty, Pagination, Modal, message, Checkbox } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { recordsApi, RecordItem } from '../../../services/api'

const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '活跃', color: 'green' },
  archived: { text: '已归档', color: 'default' },
  locked: { text: '已锁定', color: 'red' },
}

export default function RecordList() {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [selected, setSelected] = useState<string[]>([])
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchCategory, setBatchCategory] = useState('')
  const [batchAssignee, setBatchAssignee] = useState('')
  const navigate = useNavigate()

  const load = (p = 1, cat?: string, stat?: string) => {
    setLoading(true)
    recordsApi.list({ limit: 10, offset: (p - 1) * 10, category: cat, status: stat })
      .then(({ records: data, total: n }) => {
        setRecords(data)
        setTotal(n)
        setLoading(false)
        setSelected([])
      }).catch(() => setLoading(false))
  }

  useEffect(() => { load(page, category, status) }, [])

  const handleBatchUpdate = async () => {
    try {
      const res = await recordsApi.batchUpdate(selected, {
        category: batchCategory || undefined,
        assignee: batchAssignee || undefined,
      })
      message.success(res.message)
      setBatchModalOpen(false)
      load(page, category, status)
    } catch {
      message.error('批量更新失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await recordsApi.delete(id)
      message.success('已归档')
      load(page, category, status)
    } catch {
      message.error('操作失败')
    }
  }

  const columns: ColumnsType<RecordItem> = [
    {
      title: <Checkbox checked={selected.length === records.length && records.length > 0} indeterminate={selected.length > 0 && selected.length < records.length} onChange={e => { setSelected(e.target.checked ? records.map(r => r.record_id) : []) }} />,
      key: 'checkbox',
      width: 40,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r) => <Button type="link" onClick={() => navigate(`/modules/record-operations/${r.record_id}`)}>{name}</Button>,
    },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120, render: (c: string) => c || <Text type="secondary">—</Text> },
    { title: '负责人', dataIndex: 'assignee', key: 'assignee', width: 120, render: (a: string) => a || <Text type="secondary">—</Text> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text ?? s}</Tag>,
    },
    { title: '标签', dataIndex: 'tags', key: 'tags', width: 150, render: (t: string) => t ? <Text type="secondary" style={{ fontSize: 12 }}>{t}</Text> : <Text type="secondary">—</Text> },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, r: RecordItem) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/modules/record-operations/${r.record_id}`)}>详情</Button>
          <Button size="small" danger onClick={() => handleDelete(r.record_id)}>归档</Button>
        </Space>
      ),
    },
  ]

  return (
    <Card title="对象列表">
      <Space wrap style={{ marginBottom: 12 }}>
        <Input placeholder="搜索名称" style={{ width: 160 }} onPressEnter={e => load(1, category, status)} />
        <Select placeholder="分类" style={{ width: 120 }} allowClear onChange={v => { setCategory(v); load(1, v, status) }} />
        <Select placeholder="状态" style={{ width: 100 }} allowClear onChange={v => { setStatus(v); load(1, category, v) }} />
        <Button onClick={() => load(1, category, status)}>搜索</Button>
        {selected.length > 0 && (
          <Button type="primary" onClick={() => setBatchModalOpen(true)}>
            批量更新 ({selected.length})
          </Button>
        )}
      </Space>

      {records.length === 0 && !loading ? (
        <Empty description="暂无对象数据" />
      ) : (
        <>
          <Table columns={columns} dataSource={records} rowKey="id" size="small" pagination={false} loading={loading} />
          {total > 10 && <div style={{ marginTop: 16, textAlign: 'right' }}><Pagination current={page} total={total} pageSize={10} onChange={p => { setPage(p); load(p, category, status) }} showSizeChanger={false} /></div>}
        </>
      )}

      <Modal title="批量更新" open={batchModalOpen} onOk={handleBatchUpdate} onCancel={() => setBatchModalOpen(false)}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">将更新 {selected.length} 条对象</Text>
          <Text>分类：<Input style={{ width: 200 }} onChange={e => setBatchCategory(e.target.value)} placeholder="留空则不修改" /></Text>
          <Text>负责人：<Input style={{ width: 200 }} onChange={e => setBatchAssignee(e.target.value)} placeholder="留空则不修改" /></Text>
        </Space>
      </Modal>
    </Card>
  )
}
