// 文件中心
import { Card, Table, Tag, Button, Space, Input, Select, Typography, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

interface FileRecord {
  id: string
  name: string
  module: string
  size: string
  type: string
  creator: string
  createdAt: string
  status: 'active' | 'archived'
}

const mockFiles: FileRecord[] = []

const columns: ColumnsType<FileRecord> = [
  {
    title: '文件名',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '所属模块',
    dataIndex: 'module',
    key: 'module',
    width: 140,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
  },
  {
    title: '大小',
    dataIndex: 'size',
    key: 'size',
    width: 100,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '正常' : '已归档'}</Tag>,
  },
  {
    title: '上传人',
    dataIndex: 'creator',
    key: 'creator',
    width: 100,
  },
  {
    title: '时间',
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
        <Button size="small">下载</Button>
        <Button size="small">详情</Button>
      </Space>
    ),
  },
]

export default function FileCenter() {
  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>文件中心</Title>
        <Text type="secondary">全平台文件统一管理</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索文件名" style={{ width: 200 }} />
          <Select placeholder="所属模块" style={{ width: 160 }} allowClear>
            <Select.Option value="analysis-workbench">分析工作模块</Select.Option>
            <Select.Option value="record-operations">对象管理模块</Select.Option>
            <Select.Option value="learning-lab">学习训练模块</Select.Option>
          </Select>
          <Select placeholder="文件状态" style={{ width: 120 }} allowClear>
            <Select.Option value="active">正常</Select.Option>
            <Select.Option value="archived">已归档</Select.Option>
          </Select>
          <Button>搜索</Button>
        </Space>
      </Card>

      <Card>
        {mockFiles.length === 0 ? (
          <Empty description="暂无文件记录" />
        ) : (
          <Table
            columns={columns}
            dataSource={mockFiles}
            rowKey="id"
            size="small"
          />
        )}
      </Card>
    </div>
  )
}
