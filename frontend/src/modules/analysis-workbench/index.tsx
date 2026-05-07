// 分析工作模块 - 入口
import { Routes, Route, Navigate } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import NewAnalysis from './pages/NewAnalysis'
import Results from './pages/Results'
import Reports from './pages/Reports'

export default function AnalysisWorkbench() {
  return (
    <PlatformLayout>
      <div className="business-page">
        <div className="business-page-wide">
        <Routes>
          <Route index element={<NewAnalysis />} />
          <Route path="new" element={<NewAnalysis />} />
          <Route path="history" element={<Navigate to="/reports" replace />} />
          <Route path="results/:id" element={<Results />} />
          <Route path="reports/:id" element={<Reports />} />
        </Routes>
        </div>
      </div>
    </PlatformLayout>
  )
}
