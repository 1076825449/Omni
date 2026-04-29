// 平台首页
import { Card, Row, Col, Statistic, Button, Space, Typography, List, Skeleton, Empty, Alert, Tag, Input } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../../stores/auth'
import { useNotificationStore } from '../../../stores/notification'
import type { Module, PlatformStatsOverview, Task } from '../../../services/api'
import { modulesApi, platformStatsApi, tasksApi, taxOfficerWorkbenchApi } from '../../../services/api'

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
  const [riskSummary, setRiskSummary] = useState<Record<string, number>>({})
  const [taxpayerId, setTaxpayerId] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const notificationStore = useNotificationStore()

  useEffect(() => {
    Promise.all([
      modulesApi.list(),
      tasksApi.list({ limit: 5, offset: 0 }),
      platformStatsApi.overview(),
      taxOfficerWorkbenchApi.myRiskList({ limit: 1 }),
    ]).then(([moduleData, taskData, statsData, riskData]) => {
      setModules(moduleData.modules.filter((m: Module) => m.status === 'active'))
      setRecentTasks(taskData.tasks)
      setStats(statsData)
      setRiskSummary(riskData.summary)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const quickActions = [
    { path: '/taxpayer-workbench', key: 'taxpayer-workbench', label: '查一户企业', desc: '进入一户式工作台', primary: true },
    { path: '/my-risk-list', key: 'risk-ledger', label: '处理风险清单', desc: '查看待核实和整改事项', primary: false },
    { path: '/modules/info-query', key: 'info-query', label: '导入纳税人信息', desc: '建立企业基础信息库', primary: false },
    { path: '/modules/risk-ledger', key: 'risk-ledger', label: '记录风险', desc: '补充风险和整改记录', primary: false },
  ].filter(action => modules.some(module => module.key === action.key))

  const hasData = stats && (stats.task_total > 0 || stats.file_total > 0)

  return (
    <div className="omni-page">
      {/* 欢迎区域 */}
      <div className="omni-page-header" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            税源管理员今日工作台
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            从这里查一户企业、处理风险清单、跟踪整改进展。
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
                  第2步：开展案头分析
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
              title="待核实风险"
              value={riskSummary.pending_count ?? 0}
              loading={loading}
              suffix="户"
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              需要进一步核实
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="整改中企业"
              value={riskSummary.rectifying_count ?? 0}
              loading={loading}
              suffix="户"
              valueStyle={{ color: '#1677ff' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              需要跟踪整改
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="已整改"
              value={riskSummary.rectified_count ?? 0}
              loading={loading}
              suffix="户"
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              已完成整改记录
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="我的管户数"
              value={riskSummary.dossier_total ?? 0}
              loading={loading}
              suffix="户"
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              已纳入风险跟踪
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 模块快捷入口 + 最近任务 */}
      <Row gutter={[16, 16]}>
        {/* 模块快捷入口 */}
        <Col xs={24} lg={12}>
          <Card
            title="常用工作"
            size="small"
            extra={<Link to="/my-risk-list"><Text type="secondary" style={{ fontSize: 12 }}>查看管户风险清单 →</Text></Link>}
          >
            {loading ? (
              <Skeleton active />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Input.Search
                  placeholder="输入纳税人识别号，直接查一户"
                  allowClear
                  enterButton="查询"
                  value={taxpayerId}
                  onChange={(event) => setTaxpayerId(event.target.value)}
                  onSearch={(value) => value.trim() && navigate(`/taxpayer-workbench?taxpayer_id=${encodeURIComponent(value.trim())}`)}
                />
                {quickActions.map(action => (
                  <Link key={`${action.key}-${action.label}`} to={action.path} style={{ width: '100%' }}>
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
            title="最近案头分析和工作记录"
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
                          {item.module === 'analysis-workbench' ? '案头分析' : '工作事项'} · {new Date(item.created_at).toLocaleString('zh-CN')}
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
            <Button type="link" size="small">全部功能</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}
