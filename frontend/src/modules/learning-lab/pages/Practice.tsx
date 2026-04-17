// 学习训练模块 - 练习页
import { Card, Button, Space, Typography, Radio, Progress, message, Alert, Tag, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { learningLabApi, PracticeSession, Question } from '../../../services/api'

const { Title, Text, Paragraph } = Typography

export default function Practice() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, boolean>>({})
  const navigate = useNavigate()

  const load = () => {
    if (!id) return
    learningLabApi.getPractice(id).then(data => {
      setSession(data)
      // 找第一个未答的
      const firstUnanswered = (data.questions || []).findIndex(
        (q: Question) => !data.questions.some((sq: Question) => sq.user_answer !== null && sq.id === q.id)
      )
      setCurrent(Math.max(0, firstUnanswered === -1 ? 0 : firstUnanswered))
      const answeredMap: Record<string, boolean> = {}
      const resultsMap: Record<string, boolean> = {}
      ;(data.questions || []).forEach((q: Question) => {
        if (q.user_answer !== null) {
          answeredMap[q.id] = true
          resultsMap[q.id] = q.is_correct || false
        }
      })
      setAnswered(answeredMap)
      setResults(resultsMap)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleSubmit = async () => {
    if (!session || !selected) return
    const question = session.questions[current]
    try {
      const res = await learningLabApi.answer(session.session_id, question.id, selected)
      setAnswered(prev => ({ ...prev, [question.id]: true }))
      setResults(prev => ({ ...prev, [question.id]: res.is_correct }))
      message.success(res.is_correct ? '✅ 回答正确！' : '❌ 回答错误')
      if (res.all_answered) {
        message.info('所有题目已答完，即将跳转结果页...')
        setTimeout(() => navigate(`/modules/learning-lab/results/${session.session_id}`), 1500)
      }
    } catch {
      message.error('提交失败')
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
  if (!session) return <Card><Text>练习不存在</Text></Card>

  const questions = session.questions || []
  const q = questions[current]
  const isAnswered = answered[q?.id]
  const allAnswered = questions.every((question: Question) => answered[question.id])

  const handleNext = () => {
    setSelected(null)
    setCurrent(prev => Math.min(prev + 1, questions.length - 1))
  }
  const handlePrev = () => {
    setSelected(null)
    setCurrent(prev => Math.max(prev - 1, 0))
  }

  return (
    <div>
      <Card title={`练习：${session.set_name}`} extra={<Text type="secondary">第 {current + 1} / {questions.length} 题</Text>}>
        <Progress
          percent={Math.round((Object.keys(answered).length / questions.length) * 100)}
          showInfo={false}
          style={{ marginBottom: 24 }}
        />

        {q && (
          <>
            <div style={{ marginBottom: 24 }}>
              <Title level={5}>{q.question}</Title>
            </div>

            <Radio.Group
              value={selected}
              onChange={e => !isAnswered && setSelected(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              disabled={isAnswered}
            >
              {q.options.map((opt: string, i: number) => (
                <Radio key={i} value={opt} style={{ fontSize: 16, padding: '12px 16px', border: '1px solid #d9d9d9', borderRadius: 8 }}>
                  {opt}
                </Radio>
              ))}
            </Radio.Group>

            {isAnswered && (
              <Alert
                message={results[q.id] ? '回答正确 ✅' : '回答错误 ❌'}
                description={
                  <Text>
                    你的答案：{q.user_answer} &nbsp;|&nbsp; 正确答案：{q.answer}
                  </Text>
                }
                type={results[q.id] ? 'success' : 'error'}
                showIcon
                style={{ marginTop: 16 }}
              />
            )}

            <Space style={{ marginTop: 24 }}>
              {!isAnswered ? (
                <Button type="primary" disabled={!selected} onClick={handleSubmit}>
                  提交答案
                </Button>
              ) : (
                <Button type="primary" disabled={current === questions.length - 1} onClick={handleNext}>
                  下一题 →
                </Button>
              )}
              <Button disabled={current === 0} onClick={handlePrev}>← 上一题</Button>
              <Button
                disabled={!allAnswered}
                onClick={() => navigate(`/modules/learning-lab/results/${session.session_id}`)}
              >
                查看结果
              </Button>
            </Space>
          </>
        )}
      </Card>

      <Card title="答题进度" style={{ marginTop: 16 }}>
        <Space wrap>
          {questions.map((question: Question, i: number) => (
            <Tag
              key={question.id}
              color={
                answered[question.id]
                  ? (results[question.id] ? 'green' : 'red')
                  : (i === current ? 'blue' : 'default')
              }
              style={{ cursor: 'pointer', fontSize: 14, padding: '4px 8px' }}
              onClick={() => { setCurrent(i); setSelected(question.user_answer || null) }}
            >
              {i + 1}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  )
}
