// 学习训练模块 - 收藏页
import { Card, List, Button, Space, Typography, Tag, Popconfirm } from 'antd'
import { useEffect, useState } from 'react'
import { learningLabApi, FavoriteItem } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Title, Text } = Typography

export default function Favorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const message = useAppMessage()

  const load = () => {
    learningLabApi.listFavorites().then(data => {
      setFavorites(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRemove = async (id: number) => {
    await learningLabApi.removeFavorite(id)
    message.success('已取消收藏')
    load()
  }

  return (
    <Card title="我的收藏">
      {loading ? null
       : favorites.length === 0 ? (
        <Text type="secondary">暂无收藏，在练习时点击题目旁的收藏按钮添加。</Text>
       ) : (
        <List
          dataSource={favorites}
          renderItem={(fav: FavoriteItem) => (
            <List.Item
              actions={[
                <Tag key="status" color={fav.user_answer === fav.correct_answer ? 'green' : 'red'}>
                  {fav.user_answer === fav.correct_answer ? '✅ 答对' : '❌ 答错'}
                </Tag>,
                <Popconfirm key="del" title="取消收藏？" onConfirm={() => handleRemove(fav.id)}>
                  <Button size="small" danger>删除</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={<Text>{fav.question_text}</Text>}
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">你的答案：{fav.user_answer}</Text>
                    <Text type="secondary">正确答案：{fav.correct_answer}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
