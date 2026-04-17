// 平台首页
import { Card, Row, Col, Statistic, Button, Space, Typography, List, Skeleton } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Module } from '../../../services/api'
import { modulesApi } from '../../../services/api'

const { Title, Text } = Typography

const typeMap: Record<string, string> = {
  workflow: '工作流型',
  list: '列表型',
  interactive: '轻交互型',
}

const typeColor: Record<string, string> = {
  workflow: 'blue',
  list: 'gold',
  interactive: 'green',
}

const recentTasks = [
  { id: 1, name: '数据分析报告 #2023', status: '进行中' },
  { id: 2, name: '客户数据导入 #2024', status: '已完成' },
  { id: 3, name: '练习任务 #45', status: '已完成' },
]

export default function Home() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    modulesApi.list().then(data => {
      setModules(data.modules.filter((m: Module) => m.status === 'active'))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="omni-page">
      {/* 欢迎区 */}
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>欢迎回来</Title>
        <Text type="secondary">这是您的统一工作平台</Text>
      </div>

      {/* 模块快捷入口 */}
      <Card
        title="模块中心"
        size="small"
        extra={<Link to="/modules"><Button size="small">查看全部</Button></Link>}
        style={{ marginBottom: 24 }}
      >
        {loading ? (
          <Row gutter={[16, 16]}>
            {[1, 2, 3].map(i => <Col xs={24} sm={8} key={i}><Skeleton active /></Col>)}
          </Row>
        ) : (
          <Row gutter={[16, 16]}>
            {modules.map(m => (
              <Col xs={24} sm={8} key={m.key}>
                <Card
                  hoverable
                  size="small"
                  bodyStyle={{ padding: 16 }}
                  onClick={() => navigate(`/modules/${m.key}`)}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <Text style={{ fontSize: 18 }}>{m.icon}</Text>
                      <Text strong>{m.name}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {typeMap[m.type]}
                    </Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
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
              {modules.slice(0, 1).map(m => (
                <Link key={m.key} to={`/modules/${m.key}`}>
                  <Button type="primary" block>发起分析</Button>
                </Link>
              ))}
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
