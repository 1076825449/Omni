// 对象管理模块 - 工作台
import { Card, Row, Col, Statistic, Button, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'

const { Title } = Typography

export default function RecordOperationsWorkbench() {
  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="对象总数" value={0} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="已分类" value={0} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="本周新增" value={0} /></Card>
        </Col>
      </Row>

      <Card title="快捷操作">
        <Space>
          <Link to="/modules/record-operations/import">
            <Button type="primary">导入数据</Button>
          </Link>
          <Link to="/modules/record-operations/list">
            <Button>查看列表</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}
