// 分析工作模块 - 入口
import { Routes, Route } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import Workbench from './pages/Workbench'
import NewAnalysis from './pages/NewAnalysis'
import History from './pages/History'
import Results from './pages/Results'
import Reports from './pages/Reports'

const tabItems = [
  { key: 'workbench', label: '工作台', path: '/modules/analysis-workbench' },
  { key: 'new', label: '新建分析', path: '/modules/analysis-workbench/new' },
  { key: 'history', label: '历史任务', path: '/modules/analysis-workbench/history' },
]

export default function AnalysisWorkbench() {
  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="分析工作模块"
        moduleDesc="上传资料 → 生成分析结果 → 导出报告"
        items={tabItems}
      >
        <Routes>
          <Route index element={<Workbench />} />
          <Route path="new" element={<NewAnalysis />} />
          <Route path="history" element={<History />} />
          <Route path="results/:id" element={<Results />} />
          <Route path="reports/:id" element={<Reports />} />
        </Routes>
      </ModuleLayout>
    </PlatformLayout>
  )
}
