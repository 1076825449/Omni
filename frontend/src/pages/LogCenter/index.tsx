// 日志中心
import { Card, Table, Tag, Space, Input, Select, DatePicker, Typography, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

interface LogRecord {
  id: string
  action: string
  target: string
  module: string
  operator: string
  result: 'success' | 'failed'
  createdAt: string
}

const mockLogs: LogRecord[] = []

const actionTypeMap: Record<string, { text: string; color: string }> = {
  create: { text: '创建', color: 'green' },
  update: { text: '修改', color: 'blue' },
  delete: { text: '删除', color: 'red' },
  import: { text: '导入', color: 'cyan' },
  export: { text: '导出', color: 'purple' },
  login: { text: '登录', color: 'default' },
}

const columns: ColumnsType<LogRecord> = [
  {
    title: '操作',
    dataIndex: 'action',
    key: 'action',
    width: 100,
    render: (a: string) => {
      const t = actionTypeMap[a] || { text: a, color: 'default' }
      return <Tag color={t.color}>{t.text}</Tag>
    },
  },
  {
    title: '操作对象',
    dataIndex: 'target',
    key: 'target',
  },
  {
    title: '模块',
    dataIndex: 'module',
    key: 'module',
    width: 140,
  },
  {
    title: '操作人',
    dataIndex: 'operator',
    key: 'operator',
    width: 100,
  },
  {
    title: '结果',
    dataIndex: 'result',
    key: 'result',
    width: 90,
    render: (r: string) => <Tag color={r === 'success' ? 'success' : 'error'}>{r === 'success' ? '成功' : '失败'}</Tag>,
  },
  {
    title: '时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
  },
]

export default function LogCenter() {
  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>日志中心</Title>
        <Text type="secondary">全平台操作行为审计追踪</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索操作对象" style={{ width: 200 }} />
          <Select placeholder="操作类型" style={{ width: 120 }} allowClear>
            <Select.Option value="create">创建</Select.Option>
            <Select.Option value="update">修改</Select.Option>
            <Select.Option value="delete">删除</Select.Option>
            <Select.Option value="import">导入</Select.Option>
            <Select.Option value="export">导出</Select.Option>
          </Select>
          <Select placeholder="模块" style={{ width: 160 }} allowClear>
            <Select.Option value="platform">平台公共</Select.Option>
            <Select.Option value="analysis-workbench">分析工作模块</Select.Option>
            <Select.Option value="record-operations">对象管理模块</Select.Option>
            <Select.Option value="learning-lab">学习训练模块</Select.Option>
          </Select>
          <DatePicker.RangePicker size="small" />
          <Button>搜索</Button>
        </Space>
      </Card>

      <Card>
        {mockLogs.length === 0 ? (
          <Empty description="暂无操作日志" />
        ) : (
          <Table
            columns={columns}
            dataSource={mockLogs}
            rowKey="id"
            size="small"
          />
        )}
      </Card>
    </div>
  )
}
