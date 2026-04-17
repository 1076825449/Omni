// 通知中心
import { Card, List, Tag, Typography, Empty, Button, Space } from 'antd'

const { Title, Text } = Typography

interface Notification {
  id: string
  title: string
  content: string
  type: 'info' | 'success' | 'warning' | 'error'
  isRead: boolean
  createdAt: string
}

const mockNotifications: Notification[] = []

export default function Notifications() {
  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Space>
          <Title level={4} style={{ margin: 0 }}>通知中心</Title>
          <Button size="small" disabled={mockNotifications.length === 0}>全部标为已读</Button>
        </Space>
      </div>

      <Card>
        {mockNotifications.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <List
            dataSource={mockNotifications}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong={!item.isRead}>{item.title}</Text>
                      <Tag color={
                        item.type === 'success' ? 'green' :
                        item.type === 'warning' ? 'orange' :
                        item.type === 'error' ? 'red' : 'blue'
                      }>
                        {item.type === 'info' ? '通知' :
                         item.type === 'success' ? '成功' :
                         item.type === 'warning' ? '警告' : '错误'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">{item.content}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.createdAt}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}
