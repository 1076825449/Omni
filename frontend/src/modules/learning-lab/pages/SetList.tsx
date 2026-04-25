// 学习训练模块 - 训练集列表
import { Card, List, Tag, Button, Space, Typography, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { learningLabApi, TrainingSet } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Title, Text } = Typography

const difficultyMap: Record<string, { label: string; color: string }> = {
  easy: { label: '入门', color: 'green' },
  medium: { label: '进阶', color: 'orange' },
  hard: { label: '挑战', color: 'red' },
}

export default function SetList() {
  const [sets, setSets] = useState<TrainingSet[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const message = useAppMessage()

  useEffect(() => {
    learningLabApi.listSets().then(data => {
      setSets(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleStart = async (setId: string) => {
    try {
      const session = await learningLabApi.startPractice(setId)
      message.success('练习已开始')
      navigate(`/modules/learning-lab/practice/${session.session_id}`)
    } catch {
      message.error('启动失败')
    }
  }

  return (
    <Card title="选择训练集">
      {loading ? <Skeleton active />
       : sets.length === 0 ? <Text type="secondary">暂无可用训练集</Text>
       : (
        <List
          dataSource={sets}
          renderItem={(s: TrainingSet) => {
            const diff = difficultyMap[s.difficulty] || { label: s.difficulty, color: 'default' }
            return (
              <List.Item
                actions={[
                  <Button type="primary" size="small" onClick={() => handleStart(s.set_id)}>
                    开始练习
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{s.name}</Text>
                      <Tag color={diff.color}>{diff.label}</Tag>
                      <Tag>{s.category}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">{s.description}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {s.question_count} 道题{s.tags ? ' · ' + s.tags : ''}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  )
}
