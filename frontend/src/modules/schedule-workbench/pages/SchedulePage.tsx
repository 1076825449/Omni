import { useEffect, useState } from 'react'
import { Button, Card, Empty, Form, Input, List, Popconfirm, Space, Spin, Tag, Typography, Timeline } from 'antd'
import { scheduleApi, type ScheduleExecutionLog, type ScheduleTask } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'
import { Link } from 'react-router-dom'

const { Text } = Typography

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

export default function SchedulePage() {
  const [form] = Form.useForm()
  const [tasks, setTasks] = useState<ScheduleTask[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [historyTaskId, setHistoryTaskId] = useState<number | null>(null)
  const [history, setHistory] = useState<ScheduleExecutionLog[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const message = useAppMessage()

  const load = async () => {
    setLoading(true)
    try {
      const data = await scheduleApi.list()
      setTasks(data.tasks)
    } catch {
      void message.error('加载定时任务失败')
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
      if (editingTaskId) {
        await scheduleApi.update(editingTaskId, values)
        void message.success('定时任务已更新')
      } else {
        await scheduleApi.create(values)
        void message.success('定时任务已创建')
      }
      form.resetFields()
      setEditingTaskId(null)
      await load()
    } catch {
      void message.error(editingTaskId ? '更新定时任务失败' : '创建定时任务失败')
    } finally {
      setCreating(false)
    }
  }

  const handleRunNow = async (id: number) => {
    try {
      const result = await scheduleApi.runNow(id)
      void message.success(result.message)
      await load()
    } catch {
      void message.error('触发任务失败')
    }
  }

  const handleRemove = async (id: number) => {
    try {
      await scheduleApi.delete(id)
      void message.success('定时任务已删除')
      await load()
    } catch {
      void message.error('删除任务失败')
    }
  }

  const handleToggle = async (task: ScheduleTask) => {
    try {
      await scheduleApi.update(task.id, { is_active: !task.is_active })
      void message.success(task.is_active ? '任务已停用' : '任务已启用')
      await load()
    } catch {
      void message.error('更新任务状态失败')
    }
  }

  const handleEdit = (task: ScheduleTask) => {
    setEditingTaskId(task.id)
    form.setFieldsValue({
      name: task.name,
      description: task.description,
      cron_expression: task.cron_expression,
      task_type: task.task_type,
    })
  }

  const handleViewHistory = async (task: ScheduleTask) => {
    setHistoryTaskId(task.id)
    setHistoryLoading(true)
    try {
      const data = await scheduleApi.history(task.id)
      setHistory(data.history)
    } catch {
      void message.error('加载执行历史失败')
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <Space style={{ width: '100%' }} direction="vertical" size="large">
      <Card
        title={editingTaskId ? '编辑定时任务' : '创建定时任务'}
        size="small"
        extra={editingTaskId
          ? <Button size="small" onClick={() => { setEditingTaskId(null); form.resetFields() }}>取消编辑</Button>
          : null}
      >
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
              {editingTaskId ? '保存修改' : '创建任务'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="平台联动" size="small">
        <Space wrap>
          <Link to="/tasks"><Button size="small">查看任务中心</Button></Link>
          <Link to="/logs"><Button size="small">查看日志中心</Button></Link>
          <Link to="/notifications"><Button size="small">查看通知中心</Button></Link>
        </Space>
      </Card>

      <Card title="常用 Cron 模板" size="small">
        <Space wrap>
          <Button size="small" onClick={() => form.setFieldsValue({ cron_expression: '0 9 * * *' })}>每天 9:00</Button>
          <Button size="small" onClick={() => form.setFieldsValue({ cron_expression: '0 9 * * 1-5' })}>每周一到周五 9:00</Button>
          <Button size="small" onClick={() => form.setFieldsValue({ cron_expression: '0 9 1 * *' })}>每月 1 日 9:00</Button>
          <Button size="small" onClick={() => form.setFieldsValue({ cron_expression: '*/5 * * * *' })}>每 5 分钟</Button>
          <Button size="small" onClick={() => form.setFieldsValue({ cron_expression: '0 * * * *' })}>每小时整点</Button>
        </Space>
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
                  <Button key="edit" size="small" onClick={() => handleEdit(task)}>
                    编辑
                  </Button>,
                  <Button key="toggle" size="small" onClick={() => { void handleToggle(task) }}>
                    {task.is_active ? '停用' : '启用'}
                  </Button>,
                  <Button key="run" size="small" onClick={() => { void handleRunNow(task.id) }}>
                    立即执行
                  </Button>,
                  <Button key="history" size="small" onClick={() => { void handleViewHistory(task) }}>
                    执行历史
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
                      <Text type="secondary">最近结果: {task.last_result || '—'}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {(historyTaskId !== null) && (
        <Card
          title={`执行历史 · #${historyTaskId}`}
          size="small"
          extra={<Button size="small" onClick={() => { setHistoryTaskId(null); setHistory([]) }}>关闭</Button>}
        >
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : history.length === 0 ? (
            <Empty description="暂无执行历史" />
          ) : (
            <Timeline
              items={history.map(item => ({
                color: item.result === 'success' ? 'green' : 'red',
                children: (
                  <Space direction="vertical" size={0}>
                    <Text strong>{item.detail}</Text>
                    <Text type="secondary">{new Date(item.created_at).toLocaleString('zh-CN')}</Text>
                  </Space>
                ),
              }))}
            />
          )}
        </Card>
      )}
    </Space>
  )
}
