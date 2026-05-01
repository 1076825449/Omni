// 分析工作模块 - 入口
import { Routes, Route, Navigate } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import NewAnalysis from './pages/NewAnalysis'
import Results from './pages/Results'
import Reports from './pages/Reports'

const tabItems = [
  { key: 'new', label: '案头分析', path: '/modules/analysis-workbench' },
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
          <Route index element={<NewAnalysis />} />
          <Route path="new" element={<NewAnalysis />} />
          <Route path="history" element={<Navigate to="/reports" replace />} />
          <Route path="results/:id" element={<Results />} />
          <Route path="reports/:id" element={<Reports />} />
        </Routes>
      </ModuleLayout>
    </PlatformLayout>
  )
}
