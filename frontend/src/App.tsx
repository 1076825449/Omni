import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import PlatformLayout from './components/Layout'
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

function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          {/* 登录页 - 独立布局 */}
          <Route path="/login" element={<LoginLayout><Login /></LoginLayout>} />

          {/* 平台公共页面 - 统一布局 */}
          <Route path="/" element={<PlatformLayout><Home /></PlatformLayout>} />
          <Route path="/modules" element={<PlatformLayout><ModuleCenter /></PlatformLayout>} />
          <Route path="/tasks" element={<PlatformLayout><TaskCenter /></PlatformLayout>} />
          <Route path="/files" element={<PlatformLayout><FileCenter /></PlatformLayout>} />
          <Route path="/logs" element={<PlatformLayout><LogCenter /></PlatformLayout>} />
          <Route path="/notifications" element={<PlatformLayout><Notifications /></PlatformLayout>} />
          <Route path="/settings" element={<PlatformLayout><Settings /></PlatformLayout>} />

          {/* 模块页面 - 模块内部包含 PlatformLayout */}
          <Route path="/modules/analysis-workbench/*" element={<AnalysisWorkbench />} />
          <Route path="/modules/record-operations/*" element={<RecordOperations />} />
          <Route path="/modules/learning-lab/*" element={<LearningLab />} />

          {/* 默认跳转 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
