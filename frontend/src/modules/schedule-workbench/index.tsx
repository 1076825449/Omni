import { Routes, Route } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import SchedulePage from './pages/SchedulePage'

const tabItems = [
  { key: 'schedule', label: '定时任务', path: '/modules/schedule-workbench' },
]

export default function ScheduleWorkbench() {
  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="定时调度"
        moduleDesc="创建、查看和手动触发平台内定时任务"
        items={tabItems}
      >
        <Routes>
          <Route index element={<SchedulePage />} />
        </Routes>
      </ModuleLayout>
    </PlatformLayout>
  )
}
