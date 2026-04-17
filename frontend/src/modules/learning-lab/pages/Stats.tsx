// 学习训练模块 - 统计页
import { Card, Row, Col, Statistic, Progress, List, Tag, Space, Typography, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { learningLabApi, LearningStats } from '../../../services/api'

const { Title, Text } = Typography

export default function Stats() {
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    learningLabApi.getStats().then(data => {
      setStats(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>

  const {
    total_sessions, total_correct, total_questions, avg_score, streak_days,
    last_practice_at, recent_sessions,
  } = stats || { total_sessions: 0, total_correct: 0, total_questions: 0, avg_score: 0, streak_days: 0, recent_sessions: [] }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="练习次数" value={total_sessions} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="平均得分" value={avg_score} suffix="分" /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="正确题数" value={total_correct} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="连续练习" value={streak_days} suffix="天" /></Card>
        </Col>
      </Row>

      <Card title="近10次练习记录" style={{ marginTop: 16 }}>
        {recent_sessions.length === 0 ? (
          <Text type="secondary">暂无练习记录，开始你的第一次练习吧！</Text>
        ) : (
          <List
            size="small"
            dataSource={recent_sessions}
            renderItem={(s: any) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text>{s.set_name}</Text>
                      <Tag color={s.score >= 80 ? 'green' : s.score >= 60 ? 'orange' : 'red'}>
                        {s.score}分
                      </Tag>
                      <Tag>{s.correct_count}/{s.total_count} 正确</Tag>
                      <Tag color={s.status === 'completed' ? 'green' : 'default'}>
                        {s.status === 'completed' ? '已完成' : '进行中'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(s.started_at).toLocaleString('zh-CN')}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card title="能力分布" style={{ marginTop: 16 }}>
        <Progress
          percent={total_questions > 0 ? Math.round(total_correct / total_questions * 100) : 0}
          strokeColor="#52c41a"
          format={p => `正确率 ${p}%`}
        />
        <Text type="secondary">
          共回答 {total_questions} 题，正确 {total_correct} 题
        </Text>
      </Card>
    </div>
  )
}
