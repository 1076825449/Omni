// 学习训练模块 - 首页
import { Card, Row, Col, Statistic, Button, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'

const { Title } = Typography

export default function LearningLabHome() {
  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="训练集数量" value={0} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="已完成练习" value={0} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="正确率" value="--" suffix="%" /></Card>
        </Col>
      </Row>

      <Card title="快捷入口">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Link to="/modules/learning-lab/practice">
            <Button type="primary" block>开始练习</Button>
          </Link>
          <Link to="/modules/learning-lab/datasets">
            <Button block>管理训练集</Button>
          </Link>
          <Link to="/modules/learning-lab/mistakes">
            <Button block>查看错题本</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}
