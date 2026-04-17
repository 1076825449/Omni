// 分析工作模块 - 工作台
import { Card, Row, Col, Statistic, Button, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'

const { Title, Text } = Typography

export default function AnalysisWorkbench() {
  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="总分析任务" value={0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="进行中" value={0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="已完成" value={0} />
          </Card>
        </Col>
      </Row>

      <Card title="快捷操作">
        <Space>
          <Link to="/modules/analysis-workbench/new">
            <Button type="primary">新建分析</Button>
          </Link>
          <Link to="/modules/analysis-workbench/history">
            <Button>查看历史</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}
