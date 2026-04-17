import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import PlatformLayout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Platform/Home'
import ModuleCenter from './pages/ModuleCenter'
import TaskCenter from './pages/TaskCenter'
import FileCenter from './pages/FileCenter'
import LogCenter from './pages/LogCenter'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Search from './pages/Search'
import Stats from './pages/Stats'
import Help from './pages/Help'
import GettingStarted from './pages/Help/GettingStarted'
import AnalysisWorkbench from './modules/analysis-workbench'
import RecordOperations from './modules/record-operations'
import LearningLab from './modules/learning-lab'

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
          {/* 公开 */}
          <Route path="/login" element={<Login />} />

          {/* 受保护 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <PlatformLayout><Home /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules"
            element={
              <ProtectedRoute>
                <PlatformLayout><ModuleCenter /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <PlatformLayout><TaskCenter /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/files"
            element={
              <ProtectedRoute>
                <PlatformLayout><FileCenter /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <PlatformLayout><LogCenter /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <PlatformLayout><Notifications /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <PlatformLayout><Search /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <PlatformLayout><Stats /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/help/getting-started"
            element={
              <ProtectedRoute>
                <PlatformLayout><GettingStarted /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <PlatformLayout><Help /></PlatformLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <PlatformLayout><Settings /></PlatformLayout>
              </ProtectedRoute>
            }
          />

          {/* 模块 */}
          <Route
            path="/modules/analysis-workbench/*"
            element={
              <ProtectedRoute>
                <AnalysisWorkbench />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/record-operations/*"
            element={
              <ProtectedRoute>
                <RecordOperations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/learning-lab/*"
            element={
              <ProtectedRoute>
                <LearningLab />
              </ProtectedRoute>
            }
          />

          {/* 默认跳转 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
