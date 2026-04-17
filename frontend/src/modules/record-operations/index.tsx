// 对象管理模块 - 入口
import { Routes, Route } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import RecordOperationsWorkbench from './pages/Workbench'
import RecordImport from './pages/Import'
import RecordList from './pages/List'

const tabItems = [
  { key: 'workbench', label: '工作台', path: '/modules/record-operations' },
  { key: 'import', label: '导入数据', path: '/modules/record-operations/import' },
  { key: 'list', label: '对象列表', path: '/modules/record-operations/list' },
]

export default function RecordOperations() {
  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="对象管理模块"
        moduleDesc="对象列表 · 分类 · 分配 · 批量操作"
        items={tabItems}
      >
        <Routes>
          <Route index element={<RecordOperationsWorkbench />} />
          <Route path="import" element={<RecordImport />} />
          <Route path="list" element={<RecordList />} />
        </Routes>
      </ModuleLayout>
    </PlatformLayout>
  )
}
