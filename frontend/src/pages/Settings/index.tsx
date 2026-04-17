// 系统设置 - 含备份中心 + 角色管理
import { Card, Tabs, Typography, Form, Input, Button, Space, List, Tag, Checkbox, message, Spin, Descriptions, Divider } from 'antd'
import { useState, useEffect } from 'react'
import { backupApi, BackupRecord, rolesApi, RoleRecord } from '../../services/api'
import { useAuthStore } from '../../stores/auth'

const { Title, Text, Paragraph } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '等待中', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  succeeded: { text: '成功', color: 'success' },
  failed: { text: '失败', color: 'error' },
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 权限分组展示
const PERMISSION_GROUPS: Record<string, string[]> = {
  '分析工作模块': [
    'module:analysis-workbench:view',
    'module:analysis-workbench:operate',
    'module:analysis-workbench:export',
  ],
  '对象管理模块': [
    'module:record-operations:view',
    'module:record-operations:operate',
  ],
  '学习训练模块': [
    'module:learning-lab:view',
    'module:learning-lab:operate',
  ],
  '平台任务': [
    'platform:task:view',
    'platform:task:operate',
  ],
  '平台文件': [
    'platform:file:view',
    'platform:file:operate',
  ],
  '平台日志': [
    'platform:log:view',
    'platform:log:export',
  ],
  '平台备份': [
    'platform:backup:create',
    'platform:backup:restore',
  ],
  '系统管理': [
    'platform:settings:manage',
    'platform:role:manage',
  ],
}

function PermissionGroupEditor({ permissions, value, onChange }: { permissions: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (p: string) => {
    if (value.includes(p)) {
      onChange(value.filter(x => x !== p))
    } else {
      onChange([...value, p])
    }
  }
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
        const groupPerms = perms.filter(p => permissions.includes(p))
        if (groupPerms.length === 0) return null
        return (
          <div key={group}>
            <Text strong style={{ fontSize: 13 }}>{group}</Text>
            <Checkbox.Group
              value={value.filter(p => groupPerms.includes(p))}
              onChange={(vals) => {
                const kept = value.filter(p => !groupPerms.includes(p))
                onChange([...kept, ...(vals as string[])])
              }}
              style={{ width: '100%' }}
            >
              <Space wrap>
                {groupPerms.map(p => (
                  <Checkbox key={p} value={p} style={{ fontSize: 12 }}>{p.split(':').pop()}</Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </div>
        )
      })}
    </Space>
  )
}

export default function Settings() {
  const [form] = Form.useForm()
  const [backupForm] = Form.useForm()
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  // 角色管理
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [allPerms, setAllPerms] = useState<string[]>([])
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [roleLoading, setRoleLoading] = useState(false)

  const loadBackups = () => {
    setLoading(true)
    backupApi.list().then(({ backups: data }) => {
      setBackups(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const loadRoles = () => {
    if (!isAdmin) return
    setRoleLoading(true)
    Promise.all([rolesApi.list(), rolesApi.getPermissions()]).then(([{ roles: data }, permData]) => {
      setRoles(data)
      setAllPerms(permData.permissions)
      setRoleLoading(false)
    }).catch(() => setRoleLoading(false))
  }

  useEffect(() => { loadBackups() }, [])
  useEffect(() => { loadRoles() }, [isAdmin])

  const handleCreateBackup = async (values: { name: string; note?: string }) => {
    setCreating(true)
    try {
      const res = await backupApi.create(values.name, values.note)
      if (res.success) {
        message.success('备份已开始，请在备份记录中查看结果')
        backupForm.resetFields()
        loadBackups()
      }
    } catch {
      message.error('发起备份失败')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveRole = async () => {
    if (!editingRole) return
    const role = roles.find(r => r.name === editingRole)
    if (!role) return
    try {
      await rolesApi.update(editingRole, {
        display_name: role.display_name,
        description: role.description,
        permissions: editPerms,
      })
      message.success('角色权限已更新')
      setEditingRole(null)
      loadRoles()
    } catch {
      message.error('更新失败')
    }
  }

  const accountTab = (
    <Form layout="vertical" form={form} style={{ maxWidth: 480 }}>
      <Form.Item label="用户名" name="username" initialValue={user?.username}>
        <Input disabled />
      </Form.Item>
      <Form.Item label="角色" name="role" initialValue={user?.role}>
        <Input disabled />
      </Form.Item>
      <Form.Item label="昵称" name="nickname" initialValue={user?.nickname}>
        <Input placeholder="请输入昵称" />
      </Form.Item>
      <Form.Item label="邮箱" name="email">
        <Input placeholder="请输入邮箱" />
      </Form.Item>
      <Form.Item>
        <Button type="primary">保存</Button>
      </Form.Item>
    </Form>
  )

  const backupTab = (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card size="small" title="发起备份">
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          备份将打包数据库和所有上传文件为一个 ZIP 文件，可用于数据迁移或灾难恢复。
        </Paragraph>
        <Form layout="vertical" form={backupForm} onFinish={handleCreateBackup} style={{ maxWidth: 480 }}>
          <Form.Item label="备份名称" name="name" rules={[{ required: true, message: '请输入备份名称' }]}>
            <Input placeholder="如：Phase1 完成备份" />
          </Form.Item>
          <Form.Item label="备注（可选）" name="note">
            <Input.TextArea placeholder="记录此次备份的用途或状态" rows={2} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={creating}>发起备份</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title="备份记录">
        {loading ? <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
         : backups.length === 0 ? <Text type="secondary">暂无备份记录</Text>
         : (
          <List size="small" dataSource={backups} renderItem={(b: BackupRecord) => {
            const s = statusMap[b.status] || { text: b.status, color: 'default' }
            return (
              <List.Item actions={[
                b.status === 'succeeded'
                  ? <Button size="small" href={backupApi.downloadUrl(b.backup_id)} download>下载</Button>
                  : <Button size="small" disabled>{s.text}</Button>,
              ]}>
                <List.Item.Meta
                  title={<Space><Text strong>{b.name}</Text><Tag color={s.color}>{s.text}</Tag>{b.file_size > 0 && <Text type="secondary">{formatSize(b.file_size)}</Text>}</Space>}
                  description={<Text type="secondary" style={{ fontSize: 12 }}>{new Date(b.created_at).toLocaleString('zh-CN')}{b.note && ' | ' + b.note}</Text>}
                />
              </List.Item>
            )
          }} />
        )}
      </Card>

      <Card size="small" type="inner" title="恢复说明" style={{ background: '#fffbe6' }}>
        <Paragraph style={{ fontSize: 13, margin: 0 }}>
          <Text strong>恢复操作说明：</Text><br />
          1. 下载需要恢复的备份 ZIP 文件<br />
          2. 解压覆盖 <code>~/.omni/</code> 目录（需停止服务）<br />
          3. 重启服务完成恢复<br />
          <Text type="secondary">⚠️ 恢复会覆盖当前数据，请确认后再操作。</Text>
        </Paragraph>
      </Card>
    </Space>
  )

  const roleTab = !isAdmin ? (
    <Result status="403" title="权限不足" subTitle="只有管理员可以管理角色" />
  ) : (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Card size="small" title="角色列表">
        {roleLoading ? <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
         : (
          <List size="small" dataSource={roles} renderItem={(role: RoleRecord) => (
            <List.Item
              extra={<Button size="small" onClick={() => { setEditingRole(role.name); setEditPerms(role.permissions) }}>编辑权限</Button>}
            >
              <List.Item.Meta
                title={<Space><Text strong>{role.display_name}</Text><Tag>{role.name}</Tag></Space>}
                description={<Text type="secondary">{role.description}</Text>}
              />
            </List.Item>
          )} />
        )}
      </Card>

      {editingRole && (
        <Card size="small" title={`编辑角色权限：${editingRole}`}>
          <PermissionGroupEditor permissions={allPerms} value={editPerms} onChange={setEditPerms} />
          <Divider />
          <Space>
            <Button type="primary" onClick={handleSaveRole}>保存</Button>
            <Button onClick={() => setEditingRole(null)}>取消</Button>
          </Space>
        </Card>
      )}

      <Card size="small" type="inner" title="角色说明" style={{ background: '#f0f5ff' }}>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="管理员">拥有全部权限，可管理其他用户角色</Descriptions.Item>
          <Descriptions.Item label="普通用户">可正常使用平台所有功能，不能管理角色和权限</Descriptions.Item>
          <Descriptions.Item label="访客">仅可查看平台内容，不能执行任何操作</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  )

  const tabItems = [
    { key: 'account', label: '账号信息', children: accountTab },
    ...(isAdmin ? [{ key: 'roles', label: '角色管理', children: roleTab }] : []),
    { key: 'backup', label: '备份中心', children: backupTab },
    {
      key: 'security',
      label: '安全设置',
      children: (
        <Space direction="vertical" size="middle" style={{ maxWidth: 480 }}>
          <Card size="small" title="修改密码">
            <Form layout="vertical">
              <Form.Item label="当前密码"><Input.Password /></Form.Item>
              <Form.Item label="新密码"><Input.Password /></Form.Item>
              <Form.Item><Button type="primary">修改密码</Button></Form.Item>
            </Form>
          </Card>
        </Space>
      ),
    },
    {
      key: 'preferences',
      label: '偏好设置',
      children: (
        <Space direction="vertical" size="middle" style={{ maxWidth: 480 }}>
          <Form.Item label="界面语言" initialValue="中文（简体）"><Input disabled /></Form.Item>
          <Form.Item label="时区" initialValue="Asia/Shanghai"><Input disabled /></Form.Item>
        </Space>
      ),
    },
  ]

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>系统设置</Title>
        <Text type="secondary">管理您的账号与偏好</Text>
      </div>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}
