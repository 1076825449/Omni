// Dashboard 数据展示模块
import { Routes, Route } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import Dashboard from './pages/Dashboard'

const tabItems = [
  { key: 'dashboard', label: '仪表盘', path: '/modules/dashboard-workbench' },
]

export default function DashboardWorkbench() {
  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="数据仪表盘"
        moduleDesc="平台全局数据概览 — 任务趋势、模块统计、最近活动"
        items={tabItems}
      >
        <Routes>
          <Route index element={<Dashboard />} />
        </Routes>
      </ModuleLayout>
    </PlatformLayout>
  )
}
