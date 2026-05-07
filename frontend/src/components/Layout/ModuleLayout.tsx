import { Tabs } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import BusinessPageHeader from '../BusinessPageHeader'

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
    <div className="business-page">
      <div className="business-page-wide">
        <BusinessPageHeader title={moduleName} description={moduleDesc} />
        <div className="business-section business-tabs-section">
        <Tabs
          activeKey={activeKey}
          onChange={onTabChange}
          items={tabItems}
          size="small"
        />
        </div>

        {children}
      </div>
    </div>
  )
}
