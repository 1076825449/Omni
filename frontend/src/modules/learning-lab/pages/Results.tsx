// 学习训练模块 - 结果页
import { Card, Button, Space, Typography, Progress, List, Tag, Result } from 'antd'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { learningLabApi, PracticeSession } from '../../../services/api'

const { Title, Text } = Typography

export default function Results() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    learningLabApi.getPractice(id).then(data => {
      setSession(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return null
  if (!session) return <Card><Text>练习不存在</Text></Card>

  const { score, correct_count, total_count, set_name } = session
  const questions = session.questions || []
  const correct = questions.filter((q: any) => q.is_correct)
  const wrong = questions.filter((q: any) => !q.is_correct)

  return (
    <div>
      <Card title="练习结果">
        <Result
          status={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'}
          title={
            <Space direction="vertical">
              <Text style={{ fontSize: 32 }}>{set_name}</Text>
              <Text type="secondary">得分 {score} 分</Text>
            </Space>
          }
          subTitle={
            <Space direction="vertical">
              <Text>正确 {correct_count} / {total_count} 题</Text>
              <Progress
                percent={score}
                size="small"
                strokeColor={score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f'}
                style={{ width: 200 }}
              />
            </Space>
          }
          extra={
            <Space>
              <Button type="primary" onClick={() => navigate('/modules/learning-lab/stats')}>
                查看统计
              </Button>
              <Button onClick={() => navigate('/modules/learning-lab/sets')}>
                再练一次
              </Button>
            </Space>
          }
        />
      </Card>

      <Card title={`错题 (${wrong.length})`} style={{ marginTop: 16 }}>
        {wrong.length === 0 ? (
          <Text type="secondary">太棒了，没有错题！ 🎉</Text>
        ) : (
          <List
            size="small"
            dataSource={wrong}
            renderItem={(q: any) => (
              <List.Item>
                <List.Item.Meta
                  title={<Text type="danger">❌ {q.question}</Text>}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">你的答案：{q.user_answer}</Text>
                      <Text type="secondary">正确答案：{q.answer}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card title={`正确答案 (${correct.length})`} style={{ marginTop: 16 }}>
        <List
          size="small"
          dataSource={correct}
          renderItem={(q: any) => (
            <List.Item>
              <List.Item.Meta
                title={<Text type="secondary">✅ {q.question}</Text>}
                description={<Text type="secondary">正确答案：{q.answer}</Text>}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
