// 平台首页
import { Card, Row, Col, Typography, Space, List, Button } from 'antd'
import { Link } from 'react-router-dom'

const { Title, Text } = Typography

const modules = [
  {
    key: 'analysis-workbench',
    name: '分析工作模块',
    desc: '上传资料 → 生成分析结果 → 导出报告',
    tag: '工作流型',
    tagColor: 'blue',
  },
  {
    key: 'record-operations',
    name: '对象管理模块',
    desc: '对象列表 · 分类 · 分配 · 批量操作',
    tag: '列表型',
    tagColor: 'gold',
  },
  {
    key: 'learning-lab',
    name: '学习训练模块',
    desc: '练习 · 反馈 · 复盘 · 统计',
    tag: '轻交互型',
    tagColor: 'green',
  },
]

const recentTasks = [
  { id: 1, name: '数据分析报告 #2023', status: '进行中' },
  { id: 2, name: '客户数据导入 #2024', status: '已完成' },
  { id: 3, name: '练习任务 #45', status: '已完成' },
]

export default function Home() {
  return (
    <div className="omni-page">
      {/* 欢迎区 */}
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>欢迎回来</Title>
        <Text type="secondary">这是您的统一工作平台</Text>
      </div>

      {/* 模块快捷入口 */}
      <Card title="模块中心" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {modules.map(m => (
            <Col xs={24} sm={8} key={m.key}>
              <Link to={`/modules/${m.key}`}>
                <Card
                  hoverable
                  size="small"
                  style={{ height: '100%' }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <Text strong>{m.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>[{m.tag}]</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{m.desc}</Text>
                  </Space>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 最近任务 + 快捷操作 */}
      <Row gutter={16}>
        <Col xs={24} sm={16}>
          <Card title="近期任务" size="small">
            <List
              size="small"
              dataSource={recentTasks}
              renderItem={item => (
                <List.Item>
                  <Text>{item.name}</Text>
                  <Text type="secondary">{item.status}</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card title="快捷操作" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Link to="/modules/analysis-workbench">
                <Button block>发起分析</Button>
              </Link>
              <Link to="/modules/record-operations">
                <Button block>导入数据</Button>
              </Link>
              <Link to="/modules/learning-lab">
                <Button block>开始练习</Button>
              </Link>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
