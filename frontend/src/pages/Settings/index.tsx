// 系统设置 - 含备份中心 + 角色管理
import { Alert, Card, Tabs, Typography, Form, Input, Button, Space, List, Tag, Checkbox, Spin, Descriptions, Divider, Result, Select, Table, Popconfirm } from 'antd'
import { useState, useEffect } from 'react'
import { authApi, auditApi, AuditLogRecord, backupApi, BackupRecord, healthApi, HealthStatus, infoQueryApi, platformMaintenanceApi, platformSettingsApi, rolesApi, RoleRecord, TagStats, UserRecord, usersApi } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useAppMessage } from '../../hooks/useAppMessage'

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
  '案头分析': [
    'module:analysis-workbench:view',
    'module:analysis-workbench:operate',
    'module:analysis-workbench:export',
  ],
  '辅助数据管理': [
    'module:record-operations:view',
    'module:record-operations:operate',
  ],
  '学习训练': [
    'module:learning-lab:view',
    'module:learning-lab:operate',
  ],
  '信息查询与管户分配': [
    'module:info-query:view',
    'module:info-query:import',
    'module:info-query:assign',
    'module:info-query:tag-manage',
  ],
  '运行记录': [
    'platform:task:view',
    'platform:task:operate',
  ],
  '资料留存': [
    'platform:file:view',
    'platform:file:operate',
  ],
  '操作记录': [
    'platform:log:view',
    'platform:log:export',
  ],
  '备份恢复': [
    'platform:backup:create',
    'platform:backup:restore',
  ],
  '系统管理': [
    'platform:settings:manage',
    'platform:role:manage',
    'platform:user:manage',
    'platform:audit:view',
    'platform:maintenance:operate',
  ],
}

function PermissionGroupEditor({ permissions, value, onChange }: { permissions: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Space style={{ width: '100%' }} direction="vertical">
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
  const [documentForm] = Form.useForm()
  const [createUserForm] = Form.useForm()
  const [resetPasswordForms] = Form.useForm()
  const message = useAppMessage()
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  // 角色管理
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [allPerms, setAllPerms] = useState<string[]>([])
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [roleLoading, setRoleLoading] = useState(false)
  const [userLoading, setUserLoading] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [documentSaving, setDocumentSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditTotal, setAuditTotal] = useState(0)
  const [tagStats, setTagStats] = useState<TagStats | null>(null)
  const [tagStatsLoading, setTagStatsLoading] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)

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

  const loadUsers = () => {
    if (!isAdmin) return
    setUserLoading(true)
    usersApi.list().then(({ users: data }) => {
      setUsers(data)
      setUserLoading(false)
    }).catch(() => setUserLoading(false))
  }

  useEffect(() => { loadBackups() }, [])
  useEffect(() => { loadRoles() }, [isAdmin])
  useEffect(() => { loadUsers() }, [isAdmin])
  useEffect(() => {
    platformSettingsApi.getDocumentDefaults().then((data) => {
      documentForm.setFieldsValue(data)
    }).catch(() => {})
  }, [])

  const loadHealth = () => {
    if (!isAdmin) return
    setHealthLoading(true)
    healthApi.get().then(setHealth).catch(() => message.error('健康检查读取失败')).finally(() => setHealthLoading(false))
  }

  const loadAuditLogs = () => {
    if (!isAdmin) return
    setAuditLoading(true)
    auditApi.list({ limit: 50 }).then((data) => {
      setAuditLogs(data.logs)
      setAuditTotal(data.total)
    }).catch(() => message.error('全局操作记录读取失败')).finally(() => setAuditLoading(false))
  }

  const loadTagStats = () => {
    if (!isAdmin) return
    setTagStatsLoading(true)
    infoQueryApi.tagStats().then(setTagStats).catch(() => message.error('标签统计读取失败')).finally(() => setTagStatsLoading(false))
  }

  const handleConsolidateGlobalData = async () => {
    setMaintenanceLoading(true)
    try {
      const result = await platformMaintenanceApi.consolidateGlobalData()
      message.success(`归并完成，自动备份编号：${result.backup_id}`)
      loadHealth()
      loadAuditLogs()
    } catch {
      message.error('归并失败，请先确认当前账号有系统维护权限并检查后端日志')
    } finally {
      setMaintenanceLoading(false)
    }
  }

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
      message.error('发起备份失败，请确认当前账号有备份权限')
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
      message.error('角色权限更新失败，请确认当前账号仍有管理员权限')
    }
  }

  const handleCreateUser = async (values: any) => {
    setCreatingUser(true)
    try {
      await usersApi.create(values)
      message.success('账号已创建')
      createUserForm.resetFields()
      loadUsers()
    } catch {
      message.error('创建账号失败，请确认用户名未重复且密码至少 8 位')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleUpdateUser = async (target: UserRecord, patch: { nickname?: string; role?: string; is_active?: boolean }) => {
    try {
      await usersApi.update(target.id, patch)
      message.success('账号已更新')
      loadUsers()
    } catch {
      message.error('账号更新失败，请确认当前账号有管理员权限')
    }
  }

  const handleResetPassword = async (target: UserRecord) => {
    const value = resetPasswordForms.getFieldValue(`password_${target.id}`)
    try {
      await usersApi.resetPassword(target.id, value)
      message.success('密码已重置，该用户需要重新登录')
      resetPasswordForms.setFieldValue(`password_${target.id}`, '')
    } catch {
      message.error('重置失败，新密码至少 8 位')
    }
  }

  const handleSaveDocumentDefaults = async (values: any) => {
    setDocumentSaving(true)
    try {
      await platformSettingsApi.updateDocumentDefaults(values)
      message.success('文书默认信息已保存')
    } catch {
      message.error('保存文书默认信息失败')
    } finally {
      setDocumentSaving(false)
    }
  }

  const handleChangePassword = async (values: any) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致')
      return
    }
    setPasswordSaving(true)
    try {
      await authApi.changePassword(values.current_password, values.new_password)
      message.success('密码已修改，请重新登录')
      await useAuthStore.getState().logout()
    } catch {
      message.error('密码修改失败，请确认当前密码正确且新密码至少 8 位')
    } finally {
      setPasswordSaving(false)
    }
  }

  const accountTab = (
    <Space direction="vertical" style={{ width: '100%', maxWidth: 520 }}>
      <Alert
        type="info"
        showIcon
        message="账号基础信息暂由管理员统一维护"
        description="当前页面用于查看自己的账号和角色。昵称、联系方式和密码修改后续接入账号管理后再开放，避免前端显示可保存但实际未落库。"
      />
      <Form layout="vertical" form={form}>
        <Form.Item label="用户名" name="username" initialValue={user?.username}>
          <Input disabled />
        </Form.Item>
        <Form.Item label="角色" name="role" initialValue={user?.role}>
          <Input disabled />
        </Form.Item>
        <Form.Item label="昵称" name="nickname" initialValue={user?.nickname}>
          <Input disabled placeholder="由管理员维护" />
        </Form.Item>
      </Form>
    </Space>
  )

  const backupTab = (
    <Space style={{ width: '100%' }} direction="vertical" size="middle">
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
          <Text strong>恢复操作说明（需管理员）：</Text><br />
          1. 下载需要恢复的备份 ZIP 文件<br />
          2. 停止后端服务<br />
          3. 解压备份文件，用 <code>python3 cli.py db restore &lt;backup_id&gt;</code> 恢复数据库<br />
          4. 重启后端服务<br />
          <Text type="secondary">恢复会覆盖当前数据，请在恢复前确认备份完整性。</Text>
        </Paragraph>
      </Card>
    </Space>
  )

  const roleTab = !isAdmin ? (
    <Result status="403" title="权限不足" subTitle="只有管理员可以管理角色" />
  ) : (
    <Space style={{ width: '100%' }} direction="vertical">
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
          <Descriptions.Item label="管理员">拥有全部权限，可管理用户角色、备份恢复和系统设置</Descriptions.Item>
          <Descriptions.Item label="普通用户">可正常使用查户、案头分析、风险台账、文书报告等业务功能</Descriptions.Item>
          <Descriptions.Item label="访客">仅可查看，不能新增、编辑、导入、导出或批量处理</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  )

  const roleOptions = roles.map(role => ({ value: role.name, label: role.display_name || role.name }))

  const userManageTab = !isAdmin ? (
    <Result status="403" title="权限不足" subTitle="只有管理员可以管理账号" />
  ) : (
    <Space style={{ width: '100%' }} direction="vertical" size="middle">
      <Card size="small" title="新建账号">
        <Form layout="inline" form={createUserForm} onFinish={handleCreateUser}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item name="nickname">
            <Input placeholder="姓名/昵称" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}>
            <Input.Password placeholder="初始密码" />
          </Form.Item>
          <Form.Item name="role" initialValue="user" rules={[{ required: true, message: '请选择角色' }]}>
            <Select style={{ width: 130 }} options={roleOptions.length ? roleOptions : [
              { value: 'user', label: '普通用户' },
              { value: 'viewer', label: '访客' },
              { value: 'admin', label: '管理员' },
            ]} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={creatingUser}>创建账号</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title="账号列表">
        {userLoading ? <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
         : (
          <Form form={resetPasswordForms}>
            <List size="small" dataSource={users} renderItem={(item: UserRecord) => (
              <List.Item>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center" wrap>
                  <Space direction="vertical" size={2}>
                    <Space wrap>
                      <Text strong>{item.nickname || item.username}</Text>
                      <Tag>{item.username}</Tag>
                      <Tag color={item.is_active ? 'green' : 'default'}>{item.is_active ? '启用' : '停用'}</Tag>
                      {item.must_change_password && <Tag color="orange">需改密码</Tag>}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>创建时间：{new Date(item.created_at).toLocaleString('zh-CN')}</Text>
                  </Space>
                  <Space wrap>
                    <Select
                      size="small"
                      value={item.role}
                      style={{ width: 130 }}
                      options={roleOptions}
                      onChange={(role) => handleUpdateUser(item, { role })}
                    />
                    <Button size="small" onClick={() => handleUpdateUser(item, { is_active: !item.is_active })}>
                      {item.is_active ? '停用' : '启用'}
                    </Button>
                    <Form.Item name={`password_${item.id}`} style={{ margin: 0 }}>
                      <Input.Password size="small" placeholder="新密码" style={{ width: 160 }} />
                    </Form.Item>
                    <Button size="small" onClick={() => handleResetPassword(item)}>重置密码</Button>
                  </Space>
                </Space>
              </List.Item>
            )} />
          </Form>
        )}
      </Card>
    </Space>
  )

  const maintenanceTab = !isAdmin ? (
    <Result status="403" title="权限不足" subTitle="只有管理员可以维护全局数据" />
  ) : (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card
        size="small"
        title="系统健康检查"
        extra={<Button size="small" onClick={loadHealth} loading={healthLoading}>刷新</Button>}
      >
        {!health ? <Text type="secondary">点击“刷新”查看数据库、上传目录、备份和当前数据源状态。</Text> : (
          <Descriptions size="small" bordered column={2}>
            <Descriptions.Item label="整体状态"><Tag color={health.status === 'ok' ? 'green' : 'orange'}>{health.status === 'ok' ? '正常' : '需关注'}</Tag></Descriptions.Item>
            <Descriptions.Item label="数据库">{health.database?.ok ? '可读写' : '异常'}</Descriptions.Item>
            <Descriptions.Item label="数据库大小">{formatSize(Number(health.database?.size || 0))}</Descriptions.Item>
            <Descriptions.Item label="上传文件数">{health.uploads?.file_count ?? 0}</Descriptions.Item>
            <Descriptions.Item label="最近备份">{health.backups?.latest_backup_id || '暂无'}</Descriptions.Item>
            <Descriptions.Item label="备份状态">{health.backups?.latest_status || '—'}</Descriptions.Item>
            <Descriptions.Item label="当前数据源批次">{health.data_source?.latest_batch || '暂无'}</Descriptions.Item>
            <Descriptions.Item label="纳税人总数">{health.data_source?.taxpayer_total ?? 0}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card size="small" title="历史业务数据归并">
        <Alert
          type="warning"
          showIcon
          message="该操作用于把早期个人账号下的业务数据归并到全局共享空间"
          description="执行前系统会自动生成备份；归并会保留真实操作人和人工调整过的行业/地址标签。一般只需在内网正式启用前执行一次。"
          style={{ marginBottom: 12 }}
        />
        <Popconfirm
          title="确认执行全局数据归并？"
          description="系统会先生成备份，再归并历史个人业务数据。"
          onConfirm={handleConsolidateGlobalData}
        >
          <Button danger loading={maintenanceLoading}>执行全局数据归并</Button>
        </Popconfirm>
      </Card>

      <Card
        size="small"
        title="标签统计"
        extra={<Button size="small" onClick={loadTagStats} loading={tagStatsLoading}>刷新</Button>}
      >
        {!tagStats ? <Text type="secondary">点击“刷新”查看行业标签、地址标签户数和人工锁定数量。</Text> : (
          <Space align="start" style={{ width: '100%' }} wrap>
            <Table
              size="small"
              rowKey="tag"
              title={() => `行业标签（共 ${tagStats.total} 户）`}
              dataSource={tagStats.industry_tags.slice(0, 50)}
              pagination={false}
              style={{ minWidth: 360 }}
              columns={[
                { title: '标签', dataIndex: 'tag' },
                { title: '户数', dataIndex: 'count', width: 80 },
                { title: '人工调整', dataIndex: 'manual_count', width: 90 },
              ]}
            />
            <Table
              size="small"
              rowKey="tag"
              title={() => '地址标签'}
              dataSource={tagStats.address_tags.slice(0, 50)}
              pagination={false}
              style={{ minWidth: 360 }}
              columns={[
                { title: '标签', dataIndex: 'tag' },
                { title: '户数', dataIndex: 'count', width: 80 },
                { title: '人工调整', dataIndex: 'manual_count', width: 90 },
              ]}
            />
          </Space>
        )}
      </Card>
    </Space>
  )

  const auditTab = !isAdmin ? (
    <Result status="403" title="权限不足" subTitle="只有管理员可以查看全局操作记录" />
  ) : (
    <Card
      size="small"
      title="全局操作记录"
      extra={<Button size="small" onClick={loadAuditLogs} loading={auditLoading}>刷新</Button>}
    >
      <Table
        size="small"
        rowKey="id"
        loading={auditLoading}
        dataSource={auditLogs}
        pagination={{ total: auditTotal, pageSize: 50, showSizeChanger: false }}
        columns={[
          { title: '时间', dataIndex: 'created_at', width: 170, render: value => new Date(value).toLocaleString('zh-CN') },
          { title: '操作人', dataIndex: 'operator_name', width: 120 },
          { title: '模块', dataIndex: 'module', width: 120 },
          { title: '动作', dataIndex: 'action', width: 150 },
          { title: '结果', dataIndex: 'result', width: 90, render: value => <Tag color={value === 'success' ? 'green' : 'red'}>{value === 'success' ? '成功' : '失败'}</Tag> },
          { title: '详情', dataIndex: 'detail', ellipsis: true },
        ]}
      />
    </Card>
  )

  const accountAndPermissionTab = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {accountTab}
      {isAdmin && userManageTab}
      {isAdmin && roleTab}
    </Space>
  )

  const tabItems = [
    { key: 'account', label: '账号与权限', children: accountAndPermissionTab },
    ...(isAdmin ? [{ key: 'maintenance', label: '数据维护', children: maintenanceTab }] : []),
    ...(isAdmin ? [{ key: 'audit', label: '全局操作记录', children: auditTab }] : []),
    {
      key: 'documents',
      label: '文书设置',
      children: (
        <Card size="small" title="通知书和核实报告默认信息">
          <Paragraph type="secondary" style={{ fontSize: 13 }}>
            这里填写后，案头分析报告导出页会自动带出；正式生成前仍可临时修改。
          </Paragraph>
          <Form form={documentForm} layout="vertical" onFinish={handleSaveDocumentDefaults} style={{ maxWidth: 640 }}>
            <Form.Item label="税务机关名称" name="agency_name">
              <Input placeholder="例如：国家税务总局XX市XX区税务局" />
            </Form.Item>
            <Form.Item label="联系人" name="contact_person">
              <Input placeholder="经办税务人员姓名" />
            </Form.Item>
            <Form.Item label="联系电话" name="contact_phone">
              <Input placeholder="联系电话" />
            </Form.Item>
            <Form.Item label="默认整改期限" name="rectification_deadline">
              <Input placeholder="例如：收到通知后 5 个工作日内" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={documentSaving}>保存文书默认信息</Button>
          </Form>
        </Card>
      ),
    },
    { key: 'backup', label: '备份恢复', children: backupTab },
    {
      key: 'security',
      label: '安全设置',
      children: (
        <Space direction="vertical" size="middle" style={{ maxWidth: 480 }}>
          <Alert
            type="info"
            showIcon
            message="修改密码后需要重新登录"
            description="系统会校验当前密码，修改成功后自动使现有登录状态失效，并写入操作记录。"
          />
          <Card size="small" title="修改密码">
            <Form layout="vertical" onFinish={handleChangePassword}>
              <Form.Item label="当前密码" name="current_password" rules={[{ required: true, message: '请输入当前密码' }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item label="新密码" name="new_password" rules={[{ required: true, min: 8, message: '新密码至少 8 位' }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item label="确认新密码" name="confirm_password" rules={[{ required: true, message: '请再次输入新密码' }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" loading={passwordSaving}>修改密码并重新登录</Button></Form.Item>
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
    <div className="business-page">
      <div className="business-page-wide">
      <div className="business-page-header">
        <Title level={4} style={{ margin: 0 }}>系统设置</Title>
        <Text type="secondary">管理账号权限、数据维护、备份恢复和文书默认信息</Text>
      </div>
      <Card className="business-section">
        <Tabs items={tabItems} />
      </Card>
      </div>
    </div>
  )
}
