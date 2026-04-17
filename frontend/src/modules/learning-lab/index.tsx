// 学习训练模块 - 入口
import { Routes, Route } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import LearningLabHome from './pages/Home'
import Practice from './pages/Practice'
import Datasets from './pages/Datasets'
import Mistakes from './pages/Mistakes'

const tabItems = [
  { key: 'home', label: '首页', path: '/modules/learning-lab' },
  { key: 'practice', label: '练习', path: '/modules/learning-lab/practice' },
  { key: 'datasets', label: '训练集', path: '/modules/learning-lab/datasets' },
  { key: 'mistakes', label: '错题本', path: '/modules/learning-lab/mistakes' },
]

export default function LearningLab() {
  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="学习训练模块"
        moduleDesc="练习 · 反馈 · 复盘 · 统计"
        items={tabItems}
      >
        <Routes>
          <Route index element={<LearningLabHome />} />
          <Route path="practice" element={<Practice />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="mistakes" element={<Mistakes />} />
        </Routes>
      </ModuleLayout>
    </PlatformLayout>
  )
}
