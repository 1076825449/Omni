// 任务中心
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Input, Select, Typography, Empty, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Task } from '../../services/api'
import { tasksApi } from '../../services/api'

const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  queued: { text: '排队中', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  succeeded: { text: '已完成', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
}

const typeMap: Record<string, string> = {
  analysis: '分析',
  import: '导入',
  export: '导出',
  practice: '练习',
  default: '其他',
}

const columns: ColumnsType<Task> = [
  {
    title: '任务名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (t: string) => typeMap[t] ?? t,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (s: string) => {
      const m = statusMap[s] || { text: s, color: 'default' }
      return <Tag color={m.color}>{m.text}</Tag>
    },
  },
  {
    title: '模块',
    dataIndex: 'module',
    key: 'module',
    width: 160,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
    render: (t: string) => new Date(t).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'action',
    width: 100,
    render: () => <Button size="small">详情</Button>,
  },
]

export default function TaskCenter() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string | undefined>()
  const [module] = useState<string | undefined>()

  const load = (p = 1, s?: string, m?: string) => {
    setLoading(true)
    tasksApi.list({ status: s, module: m, limit: 10, offset: (p - 1) * 10 })
      .then(({ tasks: data, total: n }) => {
        setTasks(data)
        setTotal(n)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load(page, status, module) }, [])

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>任务中心</Title>
        <Text type="secondary">全平台任务统一记录与状态追踪</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索任务名称"
            style={{ width: 200 }}
            onChange={e => load(1, status, e.target.value || undefined)}
          />
          <Select
            placeholder="任务类型"
            style={{ width: 140 }}
            allowClear
            onChange={v => load(1, v ?? status, module)}
          >
            <Select.Option value="analysis">分析</Select.Option>
            <Select.Option value="import">导入</Select.Option>
            <Select.Option value="export">导出</Select.Option>
            <Select.Option value="practice">练习</Select.Option>
          </Select>
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            onChange={v => { setStatus(v ?? undefined); load(1, v ?? undefined, module) }}
          >
            <Select.Option value="queued">排队中</Select.Option>
            <Select.Option value="running">进行中</Select.Option>
            <Select.Option value="succeeded">已完成</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
            <Select.Option value="cancelled">已取消</Select.Option>
          </Select>
          <Button onClick={() => load(1, status, module)}>搜索</Button>
        </Space>
      </Card>

      <Card>
        {tasks.length === 0 && !loading ? (
          <Empty description="暂无任务记录" />
        ) : (
          <>
            <Table
              columns={columns}
              dataSource={tasks}
              rowKey="id"
              size="small"
              pagination={false}
              loading={loading}
            />
            {total > 10 && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Pagination
                  current={page}
                  total={total}
                  pageSize={10}
                  onChange={p => { setPage(p); load(p, status, module) }}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
