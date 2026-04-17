// 学习训练模块 - 练习页
import { Card, Empty, Typography } from 'antd'

const { Title, Text } = Typography

export default function Practice() {
  return (
    <Card title="练习模式">
      <Empty description="暂无练习任务，请先添加训练集" />
    </Card>
  )
}
