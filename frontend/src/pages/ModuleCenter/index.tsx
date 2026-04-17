// 模块中心
import { Card, Row, Col, Typography, Tag, Space, Button } from 'antd'
import { Link } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const modules = [
  {
    key: 'analysis-workbench',
    name: '分析工作模块',
    keyInKebab: 'analysis-workbench',
    type: '工作流型',
    typeColor: 'blue',
    priority: '高',
    desc: '统一处理上传、校验、分析、结果、报告输出。适合作为平台里"任务型模块"的样板。',
    path: '/modules/analysis-workbench',
  },
  {
    key: 'record-operations',
    name: '对象管理模块',
    keyInKebab: 'record-operations',
    type: '列表型',
    typeColor: 'gold',
    priority: '高',
    desc: '统一处理对象管理、分类、分配、批量调整和导出。适合作为平台里"列表型模块"的样板。',
    path: '/modules/record-operations',
  },
  {
    key: 'learning-lab',
    name: '学习训练模块',
    keyInKebab: 'learning-lab',
    type: '轻交互型',
    typeColor: 'green',
    priority: '中',
    desc: '统一处理题库、训练、错题、收藏和统计。适合作为平台里"沉浸式轻模块"的样板。',
    path: '/modules/learning-lab',
  },
]

export default function ModuleCenter() {
  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>模块中心</Title>
        <Text type="secondary">所有模块统一入口，点击进入</Text>
      </div>

      <Row gutter={[16, 16]}>
        {modules.map(m => (
          <Col xs={24} sm={12} lg={8} key={m.key}>
            <Card
              hoverable
              className="omni-module-card"
              style={{ height: '100%' }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space>
                  <Text strong style={{ fontSize: 16 }}>{m.name}</Text>
                </Space>

                <Space size={4}>
                  <Tag color={m.typeColor}>{m.type}</Tag>
                  <Tag>优先级：{m.priority}</Tag>
                </Space>

                <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
                  {m.desc}
                </Paragraph>

                <Text type="secondary" style={{ fontSize: 12 }}>
                  Key: <code>{m.keyInKebab}</code>
                </Text>

                <Link to={m.path}>
                  <Button type="primary" size="small" style={{ marginTop: 8 }}>
                    进入模块
                  </Button>
                </Link>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
