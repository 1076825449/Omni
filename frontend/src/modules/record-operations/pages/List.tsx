// 对象管理模块 - 列表页
import { Card, Table, Empty } from 'antd'

const mockList: unknown[] = []

export default function RecordList() {
  return (
    <Card title="对象列表">
      {mockList.length === 0 ? (
        <Empty description="暂无数据，请先导入" />
      ) : (
        <Table dataSource={mockList} rowKey="id" size="small" />
      )}
    </Card>
  )
}
