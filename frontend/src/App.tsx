import { Suspense, lazy } from 'react'
import { Spin } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PlatformLayout from './components/Layout'
import AppProviders from './components/AppProviders'
import ProtectedRoute from './components/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const Home = lazy(() => import('./pages/Platform/Home'))
const ModuleCenter = lazy(() => import('./pages/ModuleCenter'))
const TaskCenter = lazy(() => import('./pages/TaskCenter'))
const FileCenter = lazy(() => import('./pages/FileCenter'))
const LogCenter = lazy(() => import('./pages/LogCenter'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Settings = lazy(() => import('./pages/Settings'))
const Search = lazy(() => import('./pages/Search'))
const Stats = lazy(() => import('./pages/Stats'))
const Help = lazy(() => import('./pages/Help'))
const GettingStarted = lazy(() => import('./pages/Help/GettingStarted'))
const AnalysisWorkbench = lazy(() => import('./modules/analysis-workbench'))
const DashboardWorkbench = lazy(() => import('./modules/dashboard-workbench'))
const InfoQuery = lazy(() => import('./modules/info-query'))
const RiskLedger = lazy(() => import('./modules/risk-ledger'))
const RecordOperations = lazy(() => import('./modules/record-operations'))
const LearningLab = lazy(() => import('./modules/learning-lab'))
const ScheduleWorkbench = lazy(() => import('./modules/schedule-workbench'))

function RouteFallback() {
  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  )
}

function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
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
              path="/modules/info-query/*"
              element={
                <ProtectedRoute>
                  <InfoQuery />
                </ProtectedRoute>
              }
            />
            <Route
              path="/modules/risk-ledger/*"
              element={
                <ProtectedRoute>
                  <RiskLedger />
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
            <Route
              path="/modules/dashboard-workbench/*"
              element={
                <ProtectedRoute>
                  <DashboardWorkbench />
                </ProtectedRoute>
              }
            />
            <Route
              path="/modules/schedule-workbench/*"
              element={
                <ProtectedRoute>
                  <ScheduleWorkbench />
                </ProtectedRoute>
              }
            />

            {/* 默认跳转 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProviders>
  )
}

export default App
