// 学习训练模块 - 工作台
import { Card, Row, Col, Statistic, Button, Space, Typography, List, Skeleton, Tag, Alert } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { learningLabApi, LearningStats } from '../../../services/api'

const { Title, Text } = Typography

export default function LearningLabWorkbench() {
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasInProgress, setHasInProgress] = useState(false)
  const [continueSessionId, setContinueSessionId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.allSettled([learningLabApi.getStats(), learningLabApi.continueLast()])
      .then(([statsResult, continueResult]) => {
        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value)
          setHasInProgress(statsResult.value.recent_sessions.some((s: any) => s.status === 'in_progress'))
        }
        if (continueResult.status === 'fulfilled') {
          setHasInProgress(true)
          setContinueSessionId(continueResult.value.session_id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {hasInProgress && (
        <Alert
          message="有正在进行的练习"
          description="你有一项练习尚未完成，请继续。"
          type="warning"
          showIcon
          action={
            <Button size="small" onClick={async () => {
              if (continueSessionId) {
                navigate(`/modules/learning-lab/practice/${continueSessionId}`)
                return
              }
              try {
                const session = await learningLabApi.continueLast()
                navigate(`/modules/learning-lab/practice/${session.session_id}`)
              } catch {
                // ignore and stay on current page
              }
            }}>
              继续练习
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="练习总次数" value={stats?.total_sessions ?? 0} loading={loading} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="平均正确率" value={stats?.avg_score ?? 0} suffix="%" loading={loading} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="累计正确题数" value={stats?.total_correct ?? 0} loading={loading} /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Card title="开始新练习" extra={<Link to="/modules/learning-lab/sets"><Button size="small">查看全部</Button></Link>}>
            <Space style={{ width: '100%' }} direction="vertical">
              <Link to="/modules/learning-lab/sets"><Button type="primary" block>选择训练集</Button></Link>
              {continueSessionId && (
                <Button block onClick={() => navigate(`/modules/learning-lab/practice/${continueSessionId}`)}>
                  回到未完成练习
                </Button>
              )}
              {stats?.recent_sessions?.[0] && (
                <div>
                  <Text type="secondary">最近：{stats.recent_sessions[0].set_name}</Text>
                  <br />
                  <Text>得分：{stats.recent_sessions[0].score}分</Text>
                </div>
              )}
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="快捷入口">
            <Space style={{ width: '100%' }} direction="vertical">
              <Link to="/modules/learning-lab/favorites"><Button block>我的收藏</Button></Link>
              <Link to="/modules/learning-lab/stats"><Button block>学习统计</Button></Link>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
