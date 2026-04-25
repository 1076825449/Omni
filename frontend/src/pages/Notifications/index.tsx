// 通知中心
import { useEffect, useState } from 'react'
import { Card, List, Tag, Typography, Button, Space, Spin, Empty, Select, Input } from 'antd'
import { notificationsApi, NotificationRecord } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'
import { useNavigate } from 'react-router-dom'

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
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string | undefined>()
  const message = useAppMessage()
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    notificationsApi.list({ q: query || undefined, type }).then(({ notifications: data, unread_count }) => {
      setNotifications(data)
      setUnreadCount(unread_count)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleMarkRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id)
      void message.success('通知已标为已读')
      load()
    } catch {
      void message.error('操作失败')
    }
  }

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllRead()
      void message.success('已全部标为已读')
      load()
    } catch {
      void message.error('操作失败')
    }
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
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索标题或内容"
            style={{ width: 220 }}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <Select
            placeholder="通知类型"
            style={{ width: 140 }}
            allowClear
            value={type}
            onChange={value => setType(value ?? undefined)}
          >
            <Select.Option value="info">通知</Select.Option>
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="warning">警告</Select.Option>
            <Select.Option value="error">错误</Select.Option>
          </Select>
          <Button onClick={load}>搜索</Button>
        </Space>
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
                  onClick={() => !item.is_read && void handleMarkRead(item.id)}
                  actions={[
                    item.target_url
                      ? <Button size="small" key="goto" onClick={(event) => { event.stopPropagation(); navigate(item.target_url!) }}>{item.target_label || '查看'}</Button>
                      : null,
                    !item.is_read
                      ? <Button size="small" key="read" onClick={(event) => { event.stopPropagation(); void handleMarkRead(item.id) }}>标为已读</Button>
                      : <Text key="done" type="secondary" style={{ fontSize: 12 }}>已读</Text>,
                  ].filter(Boolean)}
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
