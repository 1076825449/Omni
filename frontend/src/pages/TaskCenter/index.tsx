// 任务中心
import { Card, Table, Tag, Button, Space, Input, Select, Typography, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

interface TaskRecord {
  id: string
  name: string
  type: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  creator: string
  createdAt: string
}

const mockTasks: TaskRecord[] = []

const statusMap = {
  queued: { text: '排队中', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  succeeded: { text: '已完成', color: 'success' },
  failed: { text: '失败', color: 'error' },
}

const columns: ColumnsType<TaskRecord> = [
  {
    title: '任务名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 120,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: TaskRecord['status']) => {
      const s = statusMap[status]
      return <Tag color={s.color}>{s.text}</Tag>
    },
  },
  {
    title: '发起人',
    dataIndex: 'creator',
    key: 'creator',
    width: 100,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
  },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render: () => (
      <Space>
        <Button size="small">详情</Button>
      </Space>
    ),
  },
]

export default function TaskCenter() {
  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>任务中心</Title>
        <Text type="secondary">全平台任务统一记录与状态追踪</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索任务名称" style={{ width: 200 }} />
          <Select placeholder="任务类型" style={{ width: 140 }} allowClear>
            <Select.Option value="analysis">分析</Select.Option>
            <Select.Option value="import">导入</Select.Option>
            <Select.Option value="export">导出</Select.Option>
          </Select>
          <Select placeholder="状态" style={{ width: 120 }} allowClear>
            <Select.Option value="queued">排队中</Select.Option>
            <Select.Option value="running">进行中</Select.Option>
            <Select.Option value="succeeded">已完成</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <Button>搜索</Button>
        </Space>
      </Card>

      <Card>
        {mockTasks.length === 0 ? (
          <Empty description="暂无任务记录" />
        ) : (
          <Table
            columns={columns}
            dataSource={mockTasks}
            rowKey="id"
            size="small"
          />
        )}
      </Card>
    </div>
  )
}
