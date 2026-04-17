import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Badge, Avatar, Dropdown, Input, Button } from 'antd'
import type { MenuProps } from 'antd'
import { useState } from 'react'
import { useAuthStore } from '../../stores/auth'

const navItems = [
  { label: '首页', path: '/' },
  { label: '模块中心', path: '/modules' },
  { label: '任务中心', path: '/tasks' },
  { label: '文件中心', path: '/files' },
  { label: '日志中心', path: '/logs' },
  { label: '统计', path: '/stats' },
  { label: '帮助', path: '/help' },
]

export default function PlatformHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [searchValue, setSearchValue] = useState('')

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate('/search?q=' + encodeURIComponent(searchValue.trim()))
      setSearchValue('')
    }
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

      {/* 搜索框 */}
      <Input.Search
        placeholder="搜索任务/文件/日志/模块"
        value={searchValue}
        onChange={e => setSearchValue(e.target.value)}
        onKeyDown={handleSearch}
        style={{ width: 240, marginRight: 16 }}
        size="small"
      />

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
