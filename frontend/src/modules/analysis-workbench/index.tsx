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
  { key: 'workbench', label: '案头分析首页', path: '/modules/analysis-workbench' },
  { key: 'new', label: '发起案头分析', path: '/modules/analysis-workbench/new' },
  { key: 'history', label: '分析记录', path: '/modules/analysis-workbench/history' },
]

export default function AnalysisWorkbench() {
  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="案头分析"
        moduleDesc="按户上传申报、发票、财报等资料，识别疑点并生成文书"
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
