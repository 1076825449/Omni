// 通知中心
import { useEffect, useState } from 'react'
import { Card, List, Tag, Typography, Button, Space, Spin, Empty, Checkbox } from 'antd'
import { notificationsApi, NotificationRecord } from '../../services/api'

const { Title, Text } = Typography

const typeMap: Record<string, { label: string; color: string }> = {
  info: { label: '通知', color: 'blue' },
  success: { label: '成功', color: 'green' },
  warning: { label: '警告', color: 'orange' },
  error: { label: '错误', color: 'red' },
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    notificationsApi.list().then(({ notifications: data, unread_count }) => {
      setNotifications(data)
      setUnreadCount(unread_count)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleMarkRead = async (id: number) => {
    await notificationsApi.markRead(id)
    load()
  }

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead()
    load()
  }

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>通知中心</Title>
            {unreadCount > 0 && <Text type="secondary">有 {unreadCount} 条未读</Text>}
          </div>
          <Button
            size="small"
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
          >
            全部标为已读
          </Button>
        </Space>
      </div>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : notifications.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item: NotificationRecord) => {
              const t = typeMap[item.type] || { label: item.type, color: 'default' }
              return (
                <List.Item
                  style={{ opacity: item.is_read ? 0.6 : 1 }}
                  onClick={() => !item.is_read && handleMarkRead(item.id)}
                  actions={[
                    !item.is_read
                      ? <Button size="small" key="read">标为已读</Button>
                      : <Text key="done" type="secondary" style={{ fontSize: 12 }}>已读</Text>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong={!item.is_read}>{item.title}</Text>
                        <Tag color={t.color}>{t.label}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        {item.content && <Text type="secondary">{item.content}</Text>}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(item.created_at).toLocaleString('zh-CN')}
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
    </div>
  )
}
