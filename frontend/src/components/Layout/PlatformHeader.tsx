import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Badge, Avatar, Dropdown, Input, Button } from 'antd'
import type { MenuProps } from 'antd'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import { useWsStore } from '../../stores/ws'

const navItems = [
  { label: '首页', path: '/' },
  { label: '查一户企业', path: '/taxpayer-workbench' },
  { label: '案头分析', path: '/modules/analysis-workbench' },
  { label: '风险清单', path: '/my-risk-list' },
  { label: '纳税人信息', path: '/modules/info-query' },
  { label: '文书报告', path: '/modules/analysis-workbench/history' },
  { label: '帮助', path: '/help' },
]

export default function PlatformHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const notificationStore = useNotificationStore()
  const wsConnected = useWsStore(s => s.connected)
  const [searchValue, setSearchValue] = useState('')

  // Initial fetch + WS-driven real-time updates for notification badge
  useEffect(() => {
    if (!isAuthenticated) return
    notificationStore.fetch()
    // Listen for real-time notification events pushed from backend via WebSocket
    useWsStore.getState().onMessage((msg) => {
      if (msg.type === 'notification') {
        // New notification arrived via WS — refresh badge count
        notificationStore.fetch()
      }
    })
  }, [isAuthenticated])

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

  const roleLabels: Record<string, string> = { admin: '管理员', user: '普通用户', viewer: '访客' }
  const userMenu: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: 600 }}>{user?.nickname || user?.username}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{roleLabels[user?.role || ''] || user?.role}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    { key: 'modules', label: '系统管理：功能入口' },
    { key: 'tasks', label: '系统管理：运行记录' },
    { key: 'files', label: '系统管理：资料留存' },
    { key: 'logs', label: '系统管理：操作记录' },
    { key: 'stats', label: '系统管理：工作统计' },
    { key: 'settings', label: '系统管理：系统设置' },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', danger: true },
  ]

  const onUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') handleLogout()
    if (key === 'settings') navigate('/settings')
    if (key === 'modules') navigate('/modules')
    if (key === 'tasks') navigate('/tasks')
    if (key === 'files') navigate('/files')
    if (key === 'logs') navigate('/logs')
    if (key === 'stats') navigate('/stats')
  }

  return (
    <header className="omni-header">
      <Link to="/" className="omni-header-logo">
        税务案头助手
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

      <Input.Search
        placeholder="搜索企业、风险、资料"
        value={searchValue}
        onChange={e => setSearchValue(e.target.value)}
        onKeyDown={handleSearch}
        style={{ width: 240, marginRight: 16 }}
        size="small"
      />

      <div className="omni-header-right">
        <Link to="/notifications" className="omni-header-nav-item">
          <Badge count={notificationStore.unreadCount} size="small">
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
