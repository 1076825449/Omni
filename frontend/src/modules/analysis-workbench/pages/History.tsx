// 分析工作模块 - 历史任务
import { Card, Table, Tag, Button, Space, Empty } from 'antd'

const mockHistory: unknown[] = []

export default function History() {
  return (
    <Card title="分析历史">
      {mockHistory.length === 0 ? (
        <Empty description="暂无分析历史" />
      ) : (
        <Table dataSource={mockHistory} rowKey="id" size="small" />
      )}
    </Card>
  )
}
