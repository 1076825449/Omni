import { Tabs, Typography } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'

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
    <div className="omni-page" style={{ paddingTop: 0 }}>
      {/* 模块标题区 */}
      <div style={{
        background: 'var(--omni-bg-base)',
        borderBottom: '1px solid var(--omni-border-color)',
        padding: '16px 24px 0',
      }}>
        <div style={{ marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>{moduleName}</Title>
          {moduleDesc && <Text type="secondary">{moduleDesc}</Text>}
        </div>
        <Tabs
          activeKey={activeKey}
          onChange={onTabChange}
          items={tabItems}
          size="small"
        />
      </div>

      {/* 模块内容区 */}
      <div style={{ padding: 24 }}>
        {children}
      </div>
    </div>
  )
}
