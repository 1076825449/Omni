// 登录页
import { Form, Input, Button, Typography, message } from 'antd'

const { Title, Text } = Typography

export default function Login() {
  const [form] = Form.useForm()

  const onFinish = (values: { username: string; password: string }) => {
    console.log('登录:', values)
    message.success('登录成功（占位）')
  }

  return (
    <div className="omni-login-container">
      <div className="omni-login-box">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>Omni 统一平台</Title>
          <Text type="secondary">统一入口 · 统一导航 · 统一体验</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}
