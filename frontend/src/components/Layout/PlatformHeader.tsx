import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Badge, Avatar, Dropdown, Button, message } from 'antd'
import type { MenuProps } from 'antd'
import { useAuthStore } from '../../stores/auth'

const navItems = [
  { label: '首页', path: '/' },
  { label: '模块中心', path: '/modules' },
  { label: '任务中心', path: '/tasks' },
  { label: '文件中心', path: '/files' },
  { label: '日志中心', path: '/logs' },
]

export default function PlatformHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    message.success('已退出登录')
    navigate('/login')
  }

  const userMenu: MenuProps['items'] = [
    { key: 'settings', label: '系统设置' },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', danger: true },
  ]

  const onUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') handleLogout()
    if (key === 'settings') navigate('/settings')
  }

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

        {isAuthenticated ? (
          <Dropdown menu={{ items: userMenu, onClick: onUserMenuClick }} placement="bottomRight">
            <Avatar style={{ cursor: 'pointer', background: 'var(--omni-color-primary)' }}>
              {user?.nickname?.[0] ?? user?.username?.[0] ?? 'U'}
            </Avatar>
          </Dropdown>
        ) : (
          <Link to="/login">
            <Button size="small">登录</Button>
          </Link>
        )}
      </div>
    </header>
  )
}
