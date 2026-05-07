// 学习训练模块 - 入口
import { Routes, Route } from 'react-router-dom'
import PlatformLayout from '../../components/Layout'
import ModuleLayout from '../../components/Layout/ModuleLayout'
import LearningLabWorkbench from './pages/Workbench'
import SetList from './pages/SetList'
import Practice from './pages/Practice'
import Results from './pages/Results'
import Favorites from './pages/Favorites'
import Stats from './pages/Stats'

const tabItems = [
  { key: 'home', label: '首页', path: '/modules/learning-lab' },
  { key: 'sets', label: '题库', path: '/modules/learning-lab/sets' },
  { key: 'favorites', label: '错题收藏', path: '/modules/learning-lab/favorites' },
  { key: 'stats', label: '刷题统计', path: '/modules/learning-lab/stats' },
]

export default function LearningLab() {
  return (
    <PlatformLayout>
      <ModuleLayout
        moduleName="刷题程序"
        moduleDesc="题库练习 · 错题复盘 · 学习统计"
        items={tabItems}
      >
        <Routes>
          <Route index element={<LearningLabWorkbench />} />
          <Route path="sets" element={<SetList />} />
          <Route path="practice/:id" element={<Practice />} />
          <Route path="results/:id" element={<Results />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="stats" element={<Stats />} />
        </Routes>
      </ModuleLayout>
    </PlatformLayout>
  )
}
