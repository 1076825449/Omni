import { Link, useLocation } from 'react-router-dom'
import { Badge, Avatar, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import './PlatformHeader.css'

const navItems = [
  { label: '首页', path: '/' },
  { label: '模块中心', path: '/modules' },
  { label: '任务中心', path: '/tasks' },
  { label: '文件中心', path: '/files' },
  { label: '日志中心', path: '/logs' },
]

const userMenu: MenuProps['items'] = [
  { key: 'settings', label: '系统设置' },
  { key: 'logout', label: '退出登录' },
]

export default function PlatformHeader() {
  const location = useLocation()

  return (
    <header className="omni-header">
      <Link to="/" className="omni-header-logo">
        Omni 平台
      </Link>

      <nav className="omni-header-nav">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`omni-header-nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="omni-header-right">
        <Link to="/notifications" className="omni-header-nav-item">
          <Badge count={0} size="small">
            <span style={{ fontSize: 16 }}>🔔</span>
          </Badge>
        </Link>

        <Dropdown menu={{ items: userMenu }} placement="bottomRight">
          <Avatar style={{ cursor: 'pointer', background: 'var(--omni-color-primary)' }}>
            U
          </Avatar>
        </Dropdown>
      </div>
    </header>
  )
}
