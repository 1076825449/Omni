// 对象管理模块 - 入口
import { Routes, Route } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import RecordOperationsWorkbench from './pages/Workbench'
import RecordList from './pages/List'
import RecordImport from './pages/Import'
import RecordDetail from './pages/Detail'
import NewRecord from './pages/NewRecord'

const tabItems = [
  { key: 'workbench', label: '辅助数据首页', path: '/modules/record-operations' },
  { key: 'list', label: '辅助记录列表', path: '/modules/record-operations/list' },
  { key: 'import', label: '导入数据', path: '/modules/record-operations/import' },
]

export default function RecordOperations() {
  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="辅助数据管理"
        moduleDesc="辅助记录 · 分类标签 · 批量整理"
        items={tabItems}
      >
        <Routes>
          <Route index element={<RecordOperationsWorkbench />} />
          <Route path="list" element={<RecordList />} />
          <Route path="new" element={<NewRecord />} />
          <Route path="import" element={<RecordImport />} />
          <Route path=":id" element={<RecordDetail />} />
        </Routes>
      </ModuleLayout>
    </PlatformLayout>
  )
}
