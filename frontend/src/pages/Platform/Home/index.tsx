// 平台首页
import { Card, Row, Col, Statistic, Button, Space, Typography, List, Skeleton, Empty } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Module, PlatformStatsOverview, Task } from '../../../services/api'
import { modulesApi, platformStatsApi, tasksApi } from '../../../services/api'

const { Title, Text } = Typography

const typeMap: Record<string, string> = {
  workflow: '工作流型',
  list: '列表型',
  interactive: '轻交互型',
  dashboard: '看板型',
}

const taskStatusMap: Record<string, string> = {
  queued: '排队中',
  running: '进行中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

export default function Home() {
  const [modules, setModules] = useState<Module[]>([])
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<PlatformStatsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      modulesApi.list(),
      tasksApi.list({ limit: 5, offset: 0 }),
      platformStatsApi.overview(),
    ]).then(([moduleData, taskData, statsData]) => {
      setModules(moduleData.modules.filter((m: Module) => m.status === 'active'))
      setRecentTasks(taskData.tasks)
      setStats(statsData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const quickActions = [
    { key: 'analysis-workbench', label: '发起分析', primary: true },
    { key: 'record-operations', label: '对象管理' },
    { key: 'learning-lab', label: '开始练习' },
    { key: 'schedule-workbench', label: '查看调度' },
  ].filter(action => modules.some(module => module.key === action.key))

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>欢迎回来</Title>
        <Text type="secondary">这是您的统一工作平台</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="任务总数" value={stats?.task_total ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="任务成功率" value={stats?.task_success_rate ?? 0} suffix="%" loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="文件总数" value={stats?.file_total ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="活跃模块" value={stats?.module_active ?? 0} loading={loading} />
          </Card>
        </Col>
      </Row>

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
                  styles={{ body: { padding: 16 } }}
                  onClick={() => navigate(`/modules/${m.key}`)}
                >
                  <Space style={{ width: '100%' }} direction="vertical" size={4}>
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
            {loading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : recentTasks.length === 0 ? (
              <Empty description="暂无任务记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={recentTasks}
                renderItem={item => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/tasks')}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <div>
                        <Text strong>{item.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.module} · {new Date(item.created_at).toLocaleString('zh-CN')}
                        </Text>
                      </div>
                      <Text type="secondary">{taskStatusMap[item.status] ?? item.status}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card title="快捷操作" size="small">
            <Space style={{ width: '100%' }} direction="vertical">
              {quickActions.map(action => (
                <Link key={action.key} to={`/modules/${action.key}`}>
                  <Button type={action.primary ? 'primary' : 'default'} block>{action.label}</Button>
                </Link>
              ))}
              <Link to="/tasks">
                <Button block>查看全部任务</Button>
              </Link>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
