// 系统设置 - 含备份中心
import { Card, Tabs, Typography, Form, Input, Button, Space, List, Tag, Modal, message, Spin } from 'antd'
import { useState, useEffect } from 'react'
import { backupApi, BackupRecord } from '../../services/api'

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

export default function Settings() {
  const [form] = Form.useForm()
  const [backupForm] = Form.useForm()
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const loadBackups = () => {
    setLoading(true)
    backupApi.list().then(({ backups: data }) => {
      setBackups(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadBackups() }, [])

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

  const tabItems = [
    {
      key: 'account',
      label: '账号信息',
      children: (
        <Form layout="vertical" form={form} style={{ maxWidth: 480 }}>
          <Form.Item label="用户名" name="username" initialValue="admin">
            <Input disabled />
          </Form.Item>
          <Form.Item label="昵称" name="nickname">
            <Input placeholder="请输入昵称" />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item>
            <Button type="primary">保存</Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'backup',
      label: '备份中心',
      children: (
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
                <Button type="primary" htmlType="submit" loading={creating}>
                  发起备份
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card size="small" title="备份记录">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : backups.length === 0 ? (
              <Text type="secondary">暂无备份记录</Text>
            ) : (
              <List
                size="small"
                dataSource={backups}
                renderItem={(b: BackupRecord) => {
                  const s = statusMap[b.status] || { text: b.status, color: 'default' }
                  return (
                    <List.Item
                      actions={[
                        b.status === 'succeeded'
                          ? <Button size="small" href={backupApi.downloadUrl(b.backup_id)} download>下载</Button>
                          : <Button size="small" disabled>{s.text}</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{b.name}</Text>
                            <Tag color={s.color}>{s.text}</Tag>
                            {b.file_size > 0 && <Text type="secondary">{formatSize(b.file_size)}</Text>}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {new Date(b.created_at).toLocaleString('zh-CN')}
                              {b.note && ' | ' + b.note}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
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
      ),
    },
    {
      key: 'security',
      label: '安全设置',
      children: (
        <Space direction="vertical" size="middle" style={{ maxWidth: 480 }}>
          <Card size="small" title="修改密码">
            <Form layout="vertical">
              <Form.Item label="当前密码">
                <Input.Password />
              </Form.Item>
              <Form.Item label="新密码">
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary">修改密码</Button>
              </Form.Item>
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
          <Form.Item label="界面语言" initialValue="zh-CN">
            <Input disabled placeholder="中文（简体）" />
          </Form.Item>
          <Form.Item label="时区" initialValue="Asia/Shanghai">
            <Input disabled placeholder="Asia/Shanghai" />
          </Form.Item>
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
