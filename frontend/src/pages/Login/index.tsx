import { Form, Input, Button, Typography, Checkbox } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '../../stores/auth'
import { useAppMessage } from '../../hooks/useAppMessage'

const { Title, Text } = Typography

export default function Login() {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const message = useAppMessage()
  const login = useAuthStore(s => s.login)
  const showDemoAccount = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNT === 'true'
  const [remember, setRemember] = useState(() => {
    return localStorage.getItem('omni-remember') === 'true'
  })

  const onFinish = async ({ username, password }: { username: string; password: string }) => {
    const ok = await login(username, password)
    if (ok) {
      if (remember) {
        localStorage.setItem('omni-remember', 'true')
        localStorage.setItem('omni-last-username', username)
      } else {
        localStorage.removeItem('omni-remember')
        localStorage.removeItem('omni-last-username')
      }
      message.success('登录成功')
      navigate('/')
    } else {
      message.error('用户名或密码错误')
    }
  }

  const lastUsername = localStorage.getItem('omni-last-username') || ''

  return (
    <div className="omni-login-container">
      <div className="omni-login-box">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>税务案头助手</Title>
          <Text type="secondary">查户 · 分析 · 记录 · 整改 · 文书</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          size="large"
          initialValues={{ username: lastUsername || (showDemoAccount ? 'admin' : ''), password: showDemoAccount ? 'admin123' : '' }}
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

          <Form.Item style={{ marginBottom: 0 }}>
            <Checkbox checked={remember} onChange={e => setRemember(e.target.checked)}>
              记住用户名
            </Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>

        {showDemoAccount && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              本地测试账号：admin / admin123
            </Text>
          </div>
        )}
      </div>
    </div>
  )
}
