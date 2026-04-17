import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Platform/Home'
import ModuleCenter from './pages/ModuleCenter'
import TaskCenter from './pages/TaskCenter'
import FileCenter from './pages/FileCenter'
import LogCenter from './pages/LogCenter'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import AnalysisWorkbench from './modules/analysis-workbench'
import RecordOperations from './modules/record-operations'
import LearningLab from './modules/learning-lab'

// 临时布局占位，后续任务包会实现
function Layout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh' }}>{children}</div>
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* 平台公共 */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/modules" element={<ModuleCenter />} />
          <Route path="/tasks" element={<TaskCenter />} />
          <Route path="/files" element={<FileCenter />} />
          <Route path="/logs" element={<LogCenter />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />

          {/* 模块页面 */}
          <Route path="/modules/analysis-workbench" element={<AnalysisWorkbench />} />
          <Route path="/modules/record-operations" element={<RecordOperations />} />
          <Route path="/modules/learning-lab" element={<LearningLab />} />

          {/* 默认跳转 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
