import { useEffect, useState } from 'react'
import { Button, Card, Empty, Form, Input, List, Popconfirm, Space, Spin, Tag, Typography, message } from 'antd'
import { scheduleApi, type ScheduleTask } from '../../../services/api'

const { Text } = Typography

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

export default function SchedulePage() {
  const [form] = Form.useForm()
  const [tasks, setTasks] = useState<ScheduleTask[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await scheduleApi.list()
      setTasks(data.tasks)
    } catch {
      message.error('加载定时任务失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreate = async (values: { name: string; description?: string; cron_expression: string; task_type: string }) => {
    setCreating(true)
    try {
      await scheduleApi.create(values)
      message.success('定时任务已创建')
      form.resetFields()
      await load()
    } catch {
      message.error('创建定时任务失败')
    } finally {
      setCreating(false)
    }
  }

  const handleRunNow = async (id: number) => {
    try {
      const result = await scheduleApi.runNow(id)
      message.success(result.message)
      await load()
    } catch {
      message.error('触发任务失败')
    }
  }

  const handleRemove = async (id: number) => {
    try {
      await scheduleApi.delete(id)
      message.success('定时任务已删除')
      await load()
    } catch {
      message.error('删除任务失败')
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="创建定时任务" size="small">
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            void handleCreate(values)
          }}
        >
          <Form.Item label="任务名称" name="name" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="例如：每日分析同步" />
          </Form.Item>
          <Form.Item label="任务说明" name="description">
            <Input.TextArea rows={2} placeholder="说明该任务的用途" />
          </Form.Item>
          <Form.Item label="Cron 表达式" name="cron_expression" rules={[{ required: true, message: '请输入 cron 表达式' }]}>
            <Input placeholder="例如：0 9 * * *" />
          </Form.Item>
          <Form.Item label="任务类型" name="task_type" rules={[{ required: true, message: '请输入任务类型' }]}>
            <Input placeholder="例如：analysis / backup" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={creating}>
              创建任务
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="任务列表" size="small">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : tasks.length === 0 ? (
          <Empty description="暂无定时任务" />
        ) : (
          <List
            dataSource={tasks}
            renderItem={(task) => (
              <List.Item
                actions={[
                  <Button key="run" size="small" onClick={() => { void handleRunNow(task.id) }}>
                    立即执行
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="确认删除这个定时任务？"
                    onConfirm={() => { void handleRemove(task.id) }}
                  >
                    <Button size="small" danger>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Text strong>{task.name}</Text>
                      <Tag color={task.is_active ? 'success' : 'default'}>
                        {task.is_active ? '启用中' : '已停用'}
                      </Tag>
                      <Tag>{task.task_type}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">{task.description || '暂无说明'}</Text>
                      <Text type="secondary">Cron: {task.cron_expression}</Text>
                      <Text type="secondary">下次执行: {formatDate(task.next_run_at)}</Text>
                      <Text type="secondary">上次执行: {formatDate(task.last_run_at)}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  )
}
