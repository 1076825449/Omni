// 系统设置
import { Card, Tabs, Typography, Form, Input, Button, Space, Divider } from 'antd'
import { Card as AntCard } from 'antd'

const { Title, Text } = Typography

export default function Settings() {
  const [form] = Form.useForm()

  const tabItems = [
    {
      key: 'account',
      label: '账号信息',
      children: (
        <Form layout="vertical" form={form} style={{ maxWidth: 480 }}>
          <Form.Item label="用户名" name="username" initialValue="admin">
            <Input disabled />
          </Form.Item>
          <Form.Item label="昵称" name="nickname">
            <Input placeholder="请输入昵称" />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item>
            <Button type="primary">保存</Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'security',
      label: '安全设置',
      children: (
        <Space direction="vertical" size="middle" style={{ maxWidth: 480 }}>
          <AntCard size="small" title="修改密码">
            <Form layout="vertical">
              <Form.Item label="当前密码">
                <Input.Password />
              </Form.Item>
              <Form.Item label="新密码">
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary">修改密码</Button>
              </Form.Item>
            </Form>
          </AntCard>
        </Space>
      ),
    },
    {
      key: 'preferences',
      label: '偏好设置',
      children: (
        <Space direction="vertical" size="middle" style={{ maxWidth: 480 }}>
          <Form.Item label="界面语言" name="language" initialValue="zh-CN">
            <Input disabled placeholder="中文（简体）" />
          </Form.Item>
          <Form.Item label="时区" name="timezone" initialValue="Asia/Shanghai">
            <Input disabled placeholder="Asia/Shanghai" />
          </Form.Item>
        </Space>
      ),
    },
  ]

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>系统设置</Title>
        <Text type="secondary">管理您的账号与偏好</Text>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}
