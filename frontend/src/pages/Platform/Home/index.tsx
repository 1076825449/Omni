// 平台首页
import { Card, Row, Col, Statistic, Button, Space, Typography, List, Skeleton, Empty, Alert, Tag, Badge } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../../stores/auth'
import { useNotificationStore } from '../../../stores/notification'
import type { Module, PlatformStatsOverview, Task } from '../../../services/api'
import { modulesApi, platformStatsApi, tasksApi } from '../../../services/api'

const { Title, Text, Paragraph } = Typography

const roleLabels: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
  viewer: '访客（只读）',
}

const roleDescriptions: Record<string, string> = {
  admin: '可管理用户、角色、模块注册、备份恢复和系统设置',
  user: '可使用业务模块（分析、对象管理、信息查询、风险台账、学习训练、定时任务），不能管理系统配置',
  viewer: '只可查看，不能新增、编辑、删除、导入或执行任何操作',
}

const taskStatusMap: Record<string, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'default' },
  running: { label: '进行中', color: 'processing' },
  succeeded: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
}

export default function Home() {
  const [modules, setModules] = useState<Module[]>([])
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<PlatformStatsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const notificationStore = useNotificationStore()

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
    { key: 'analysis-workbench', label: '发起分析', desc: '上传资料，生成风险分析结果', primary: true },
    { key: 'info-query', label: '导入纳税人信息', desc: '建立企业基础信息库', primary: false },
    { key: 'risk-ledger', label: '记录风险', desc: '跟踪风险事项和处理状态', primary: false },
    { key: 'record-operations', label: '管理对象', desc: '统一管理业务对象和记录', primary: false },
  ].filter(action => modules.some(module => module.key === action.key))

  const hasData = stats && (stats.task_total > 0 || stats.file_total > 0)

  return (
    <div className="omni-page">
      {/* 欢迎区域 */}
      <div className="omni-page-header" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            欢迎使用 Omni 统一工作平台
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            这里可以集中处理分析任务、对象管理、风险台账、信息查询、学习训练和定时调度等业务工作。
          </Paragraph>
        </Space>
      </div>

      {/* 用户角色信息 */}
      <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            <Text strong>当前账号：{user?.nickname || user?.username}</Text>
            <Tag color={user?.role === 'admin' ? 'red' : user?.role === 'viewer' ? 'orange' : 'blue'}>
              {roleLabels[user?.role || ''] || user?.role}
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {roleDescriptions[user?.role || '']}
          </Text>
        </Space>
      </Card>

      {/* 新手引导（仅当没有数据时显示） */}
      {!hasData && !loading && (
        <Alert
          type="info"
          showIcon
          icon={<span style={{ fontSize: 18 }}>🚀</span>}
          message="第一次使用？"
          description={
            <Space direction="vertical" size={4}>
              <Text>建议按以下顺序开始：</Text>
              <Space wrap>
                <Button size="small" type="primary" onClick={() => navigate('/modules/info-query')}>
                  第1步：导入纳税人信息
                </Button>
                <Button size="small" type="primary" onClick={() => navigate('/modules/analysis-workbench')}>
                  第2步：发起分析任务
                </Button>
                <Button size="small" onClick={() => navigate('/help/getting-started')}>
                  查看3分钟上手指南 →
                </Button>
              </Space>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 今日概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="任务总数"
              value={stats?.task_total ?? 0}
              loading={loading}
              suffix="个"
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              全部任务累计
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats?.task_done ?? 0}
              loading={loading}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              成功完成任务
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="失败任务"
              value={stats?.task_failed ?? 0}
              loading={loading}
              suffix="个"
              valueStyle={{ color: (stats?.task_failed ?? 0) > 0 ? '#ff4d4f' : undefined }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              需要关注
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="成功率"
              value={stats?.task_success_rate ?? 0}
              loading={loading}
              suffix="%"
              valueStyle={{ color: (stats?.task_success_rate ?? 0) >= 80 ? '#52c41a' : '#faad14' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              任务完成率
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 模块快捷入口 + 最近任务 */}
      <Row gutter={[16, 16]}>
        {/* 模块快捷入口 */}
        <Col xs={24} lg={12}>
          <Card
            title="快速开始"
            size="small"
            extra={<Link to="/modules"><Text type="secondary" style={{ fontSize: 12 }}>查看全部模块 →</Text></Link>}
          >
            {loading ? (
              <Skeleton active />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {quickActions.map(action => (
                  <Link key={action.key} to={`/modules/${action.key}`} style={{ width: '100%' }}>
                    <Card
                      size="small"
                      hoverable
                      styles={{ body: { padding: '12px 16px' } }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <Button type={action.primary ? 'primary' : 'default'} size="small">
                            {action.label}
                          </Button>
                          <Text type="secondary" style={{ fontSize: 12 }}>{action.desc}</Text>
                        </Space>
                        <Text type="secondary">→</Text>
                      </Space>
                    </Card>
                  </Link>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        {/* 最近任务 */}
        <Col xs={24} lg={12}>
          <Card
            title="最近任务"
            size="small"
            extra={<Link to="/tasks"><Text type="secondary" style={{ fontSize: 12 }}>查看全部 →</Text></Link>}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : recentTasks.length === 0 ? (
              <Empty
                description={
                  <Space direction="vertical" size={4}>
                    <Text type="secondary">还没有任务记录</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      可以从「快速开始」发起一个新任务
                    </Text>
                  </Space>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
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
                      <Tag color={taskStatusMap[item.status]?.color}>
                        {taskStatusMap[item.status]?.label ?? item.status}
                      </Tag>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 帮助入口 */}
      <Card size="small" style={{ marginTop: 16, background: '#fafafa' }}>
        <Space style={{ width: '100%', justifyContent: 'center' }} wrap>
          <Link to="/help/getting-started">
            <Button type="link" size="small">3分钟上手指南</Button>
          </Link>
          <Link to="/help">
            <Button type="link" size="small">帮助中心</Button>
          </Link>
          <Link to="/modules">
            <Button type="link" size="small">模块中心</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}
