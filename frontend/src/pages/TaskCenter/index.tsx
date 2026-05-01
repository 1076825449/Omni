// 任务中心
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Input, Select, Typography, Empty, Pagination, Descriptions, Skeleton } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Module, Task, TaskDetail } from '../../services/api'
import { modulesApi, tasksApi } from '../../services/api'

const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  queued: { text: '排队中', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  succeeded: { text: '已完成', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
}

const typeMap: Record<string, string> = {
  analysis: '分析',
  import: '导入',
  export: '导出',
  practice: '练习',
  default: '其他',
}

const columns: ColumnsType<Task> = [
  {
    title: '任务名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (t: string) => typeMap[t] ?? t,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (s: string) => {
      const m = statusMap[s] || { text: s, color: 'default' }
      return <Tag color={m.color}>{m.text}</Tag>
    },
  },
  {
    title: '模块',
    dataIndex: 'module',
    key: 'module',
    width: 160,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
    render: (t: string) => new Date(t).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'action',
    width: 100,
    render: () => <Button size="small">详情</Button>,
  },
]

export default function TaskCenter() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [module, setModule] = useState<string | undefined>()
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const load = (p = 1, q?: string, t?: string, s?: string, m?: string) => {
    setLoading(true)
    tasksApi.list({ q, type: t, status: s, module: m, limit: 10, offset: (p - 1) * 10 })
      .then(({ tasks: data, total: n }) => {
        setTasks(data)
        setTotal(n)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const loadTaskDetail = (taskId?: string | null) => {
    if (!taskId) {
      setSelectedTask(null)
      return
    }
    setDetailLoading(true)
    tasksApi.get(taskId).then(data => {
      setSelectedTask(data)
      setDetailLoading(false)
    }).catch(() => {
      setSelectedTask(null)
      setDetailLoading(false)
    })
  }

  useEffect(() => {
    modulesApi.list().then(({ modules: data }) => {
      setModules(data.filter(item => item.status === 'active'))
    }).catch(() => {})
    const q = searchParams.get('q') || ''
    const statusValue = searchParams.get('status') || undefined
    const moduleValue = searchParams.get('module') || undefined
    const typeValue = searchParams.get('type') || undefined
    setQuery(q)
    setStatus(statusValue)
    setModule(moduleValue)
    setType(typeValue)
    load(1, q || undefined, typeValue, statusValue, moduleValue)
    loadTaskDetail(searchParams.get('taskId'))
  }, [])

  const columnsWithAction: ColumnsType<Task> = columns.map(column => {
    if (column.key !== 'action') return column
    return {
      ...column,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => {
            const next = new URLSearchParams(searchParams)
            next.set('taskId', record.task_id)
            setSearchParams(next)
            loadTaskDetail(record.task_id)
          }}>
            详情
          </Button>
          <Button
            size="small"
            onClick={() => navigate(record.module === 'analysis-workbench' ? '/reports' : `/modules/${record.module}`)}
          >
            来源
          </Button>
        </Space>
      ),
    }
  })

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>系统管理：运行记录</Title>
        <Text type="secondary">查看案头分析、导入导出等后台运行情况，普通业务处理建议从首页开始。</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索事项名称"
            style={{ width: 200 }}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Select
            placeholder="事项类型"
            style={{ width: 140 }}
            allowClear
            value={type}
            onChange={v => setType(v ?? undefined)}
          >
            <Select.Option value="analysis">分析</Select.Option>
            <Select.Option value="import">导入</Select.Option>
            <Select.Option value="export">导出</Select.Option>
            <Select.Option value="practice">练习</Select.Option>
          </Select>
          <Select
            placeholder="所属功能"
            style={{ width: 180 }}
            allowClear
            value={module}
            onChange={v => setModule(v ?? undefined)}
          >
            {modules.map(item => (
              <Select.Option key={item.key} value={item.key}>{item.name}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={status}
            onChange={v => setStatus(v ?? undefined)}
          >
            <Select.Option value="queued">排队中</Select.Option>
            <Select.Option value="running">进行中</Select.Option>
            <Select.Option value="succeeded">已完成</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
            <Select.Option value="cancelled">已取消</Select.Option>
          </Select>
          <Button onClick={() => {
            const next = new URLSearchParams()
            if (query) next.set('q', query)
            if (type) next.set('type', type)
            if (status) next.set('status', status)
            if (module) next.set('module', module)
            if (selectedTask?.task_id) next.set('taskId', selectedTask.task_id)
            setSearchParams(next)
            setPage(1)
            load(1, query || undefined, type, status, module)
          }}>搜索</Button>
        </Space>
      </Card>

      {(detailLoading || selectedTask) && (
        <Card
          title="运行详情"
          size="small"
          style={{ marginBottom: 16 }}
          extra={selectedTask ? <Button size="small" onClick={() => {
            const next = new URLSearchParams(searchParams)
            next.delete('taskId')
            setSearchParams(next)
            setSelectedTask(null)
          }}>关闭</Button> : null}
        >
          {detailLoading || !selectedTask ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="事项名称">{selectedTask.name}</Descriptions.Item>
                <Descriptions.Item label="当前状态">
                  <Tag color={(statusMap[selectedTask.status] || { color: 'default' }).color}>
                    {(statusMap[selectedTask.status] || { text: selectedTask.status }).text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="所属功能">{selectedTask.module}</Descriptions.Item>
                <Descriptions.Item label="事项类型">{typeMap[selectedTask.type] || selectedTask.type}</Descriptions.Item>
                <Descriptions.Item label="关联文件">{selectedTask.file_count > 0 ? `${selectedTask.file_count} 个文件` : '无'}</Descriptions.Item>
                <Descriptions.Item label="关联日志">{selectedTask.log_count > 0 ? `${selectedTask.log_count} 条日志` : '无'}</Descriptions.Item>
                <Descriptions.Item label="形成风险事项">{selectedTask.related_record_count > 0 ? `${selectedTask.related_record_count} 条` : '无'}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{new Date(selectedTask.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
                {selectedTask.completed_at && (
                  <Descriptions.Item label="完成时间">{new Date(selectedTask.completed_at).toLocaleString('zh-CN')}</Descriptions.Item>
                )}
                {selectedTask.status === 'failed' ? (
                  <Descriptions.Item label="失败原因" span={2}>
                    <Text type="danger">{selectedTask.result_summary || '未知错误，请查看操作日志获取详情'}</Text>
                  </Descriptions.Item>
                ) : (
                  selectedTask.result_summary && (
                    <Descriptions.Item label="结果摘要" span={2}>{selectedTask.result_summary}</Descriptions.Item>
                  )
                )}
              </Descriptions>
              <Space wrap>
                {selectedTask.source_url && (
                  <Button type="primary" onClick={() => navigate(selectedTask.source_url!)}>
                    {selectedTask.source_label || '查看来源'}
                  </Button>
                )}
                <Button onClick={() => navigate(`/logs?q=${encodeURIComponent(selectedTask.task_id)}&module=${selectedTask.module}`)}>
                  查看相关日志
                </Button>
                {selectedTask.file_count > 0 && (
                  <Button onClick={() => navigate(`/files?q=${encodeURIComponent(selectedTask.task_id)}&module=${selectedTask.module}`)}>
                    查看相关文件
                  </Button>
                )}
              </Space>
            </Space>
          )}
        </Card>
      )}

      <Card>
        {tasks.length === 0 && !loading ? (
          <Empty
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">还没有任务记录</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  当你发起分析、导入、导出等操作时，对应的任务会显示在这里。
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  可以进入「模块中心」，选择一个模块开始使用。
                </Text>
              </Space>
            }
          />
        ) : (
          <>
            <Table
              columns={columnsWithAction}
              dataSource={tasks}
              rowKey="id"
              size="small"
              pagination={false}
              loading={loading}
            />
            {total > 10 && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Pagination
                  current={page}
                  total={total}
                  pageSize={10}
                  onChange={p => { setPage(p); load(p, query || undefined, type, status, module) }}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
