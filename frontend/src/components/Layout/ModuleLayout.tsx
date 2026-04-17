import { Tabs, Typography, Breadcrumb, Space } from 'antd'
import { useNavigate, useLocation, Link } from 'react-router-dom'

const { Title, Text } = Typography

interface TabItem {
  key: string
  label: string
  path: string
}

interface ModuleLayoutProps {
  moduleName: string
  moduleDesc?: string
  items: TabItem[]
  children: React.ReactNode
}

export default function ModuleLayout({ moduleName, moduleDesc, items, children }: ModuleLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const tabItems = items.map(item => ({
    key: item.key,
    label: item.label,
  }))

  const activeKey = items.find(item => location.pathname === item.path)?.key
    ?? items[0]?.key
    ?? ''

  const onTabChange = (key: string) => {
    const item = items.find(i => i.key === key)
    if (item) navigate(item.path)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--omni-bg-layout)' }}>
      {/* 模块页面顶部横条 */}
      <div style={{
        background: 'var(--omni-bg-base)',
        borderBottom: '1px solid var(--omni-border-color)',
        padding: '12px 24px 0',
      }}>
        {/* 面包屑：平台 → 模块 */}
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={[
            { title: <Link to="/">平台首页</Link> },
            { title: <Link to="/modules">模块中心</Link> },
            { title: moduleName },
          ]}
        />

        {/* 模块标题 */}
        <div style={{ marginBottom: 12 }}>
          <Space>
            <Title level={5} style={{ margin: 0 }}>{moduleName}</Title>
            {moduleDesc && <Text type="secondary">— {moduleDesc}</Text>}
          </Space>
        </div>

        {/* 模块级 Tab */}
        <Tabs
          activeKey={activeKey}
          onChange={onTabChange}
          items={tabItems}
          size="small"
        />
      </div>

      {/* 模块内容 */}
      <div style={{ padding: 24 }}>
        {children}
      </div>
    </div>
  )
}
