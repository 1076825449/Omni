import { Result, Button } from 'antd'
import { useAuthStore } from '../stores/auth'

interface PermissionGuardProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const hasPermission = useAuthStore(s => s.hasPermission(permission))

  if (!hasPermission) {
    if (fallback) return <>{fallback}</>
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="您没有执行此操作的权限，请联系管理员。"
        extra={<Button type="primary" href="/">返回首页</Button>}
      />
    )
  }

  return <>{children}</>
}
