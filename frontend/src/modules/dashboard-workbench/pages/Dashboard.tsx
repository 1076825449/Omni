// Dashboard 主页面
import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Timeline, Spin, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { dashboardApi } from '../../../services/api'
import './Dashboard.css'

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.overview()
      .then(setData)
      .catch(() => message.error('加载仪表盘失败'))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />
  }

  const { stat_cards, task_trend, module_stats, recent_activity } = data
  const maxCount = Math.max(...task_trend.map((t: any) => t.count), 1)

  const resultColor = (result: string) => {
    if (result === 'success') return 'green'
    if (result === 'failed') return 'red'
    return 'default'
  }

  return (
    <div className="dashboard">
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {stat_cards.map((card: any, i: number) => (
          <Col span={6} key={i}>
            <Card hoverable>
              <Statistic
                title={card.label}
                value={card.value}
                valueStyle={{ color: card.change > 0 ? '#3f8600' : undefined }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="📈 7天任务趋势" style={{ marginBottom: 16 }}>
            <div className="trend-bars">
              {task_trend.map((t: any, i: number) => (
                <div key={i} className="trend-bar-item">
                  <div
                    className="trend-bar"
                    style={{ height: `${Math.max((t.count / maxCount) * 80, 4)}px` }}
                  >
                    <span className="trend-count">{t.count}</span>
                  </div>
                  <span className="trend-date">{t.date}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="📊 模块任务统计" style={{ marginBottom: 16 }}>
            <Table
              dataSource={module_stats.map((m: any, i: number) => ({ ...m, key: i }))}
              columns={[
                { title: '模块', dataIndex: 'module' },
                {
                  title: '完成率',
                  render: (_, r: any) => {
                    const rate = r.total > 0 ? Math.round((r.succeeded / r.total) * 100) : 0
                    return <span>{rate}%</span>
                  },
                },
                {
                  title: '状态',
                  render: (_, r: any) => (
                    <>
                      <Tag icon={<CheckCircleOutlined />} color="success">{r.succeeded}</Tag>
                      <Tag icon={<CloseCircleOutlined />} color="error">{r.failed}</Tag>
                    </>
                  ),
                },
              ]}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="🕐 最近活动">
            <Timeline
              items={recent_activity.map((a: any, i: number) => ({
                color: a.result === 'success' ? 'green' : a.result === 'failed' ? 'red' : 'blue',
                children: (
                  <div className="activity-item">
                    <span className="activity-action">{a.action}</span>
                    <span className="activity-target">[{a.target_type}]</span>
                    <span className="activity-detail">{a.detail}</span>
                    <Tag color={resultColor(a.result)} style={{ marginLeft: 8 }}>{a.result}</Tag>
                    <span className="activity-time">
                      {a.created_at ? new Date(a.created_at).toLocaleString('zh-CN') : ''}
                    </span>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
