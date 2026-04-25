// 日志中心
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Space, Input, Select, Typography, Empty, Pagination, Button, Descriptions } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useSearchParams } from 'react-router-dom'
import type { Module, OperationLog } from '../../services/api'
import { logsApi, modulesApi } from '../../services/api'

const { Title, Text } = Typography

const actionMap: Record<string, { text: string; color: string }> = {
  create: { text: '创建', color: 'green' },
  update: { text: '修改', color: 'blue' },
  delete: { text: '删除', color: 'red' },
  import: { text: '导入', color: 'cyan' },
  export: { text: '导出', color: 'purple' },
  login: { text: '登录', color: 'default' },
  logout: { text: '退出', color: 'default' },
}

export default function LogCenter() {
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState<string | undefined>()
  const [module, setModule] = useState<string | undefined>()
  const [result, setResult] = useState<string | undefined>()
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const load = (p = 1, q?: string, a?: string, m?: string, r?: string) => {
    setLoading(true)
    logsApi.list({ q, action: a, module: m, result: r, limit: 10, offset: (p - 1) * 10 })
      .then(({ logs: data, total: n }) => {
        setLogs(data)
        setTotal(n)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    modulesApi.list().then(({ modules: data }) => {
      setModules(data.filter(item => item.status === 'active'))
    }).catch(() => {})
    const q = searchParams.get('q') || ''
    const actionValue = searchParams.get('action') || undefined
    const moduleValue = searchParams.get('module') || undefined
    const resultValue = searchParams.get('result') || undefined
    setQuery(q)
    setAction(actionValue)
    setModule(moduleValue)
    setResult(resultValue)
    load(1, q || undefined, actionValue, moduleValue, resultValue)
  }, [])

  const columns: ColumnsType<OperationLog> = [
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (a: string) => {
        const m = actionMap[a] || { text: a, color: 'default' }
        return <Tag color={m.color}>{m.text}</Tag>
      },
    },
    {
      title: '操作对象',
      key: 'target',
      render: (_, r) => `${r.target_type} #${r.target_id}`,
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 160,
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: (r: string) => <Tag color={r === 'success' ? 'success' : 'error'}>{r === 'success' ? '成功' : '失败'}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: OperationLog) => (
        <Button size="small" type="link" onClick={() => setSelectedLog(record)}>详情</Button>
      ),
    },
  ]

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>日志中心</Title>
        <Text type="secondary">全平台操作行为审计追踪</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索日志内容或对象"
            style={{ width: 220 }}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Select
            placeholder="操作类型"
            style={{ width: 120 }}
            allowClear
            value={action}
            onChange={v => setAction(v ?? undefined)}
          >
            <Select.Option value="create">创建</Select.Option>
            <Select.Option value="update">修改</Select.Option>
            <Select.Option value="delete">删除</Select.Option>
            <Select.Option value="import">导入</Select.Option>
            <Select.Option value="export">导出</Select.Option>
            <Select.Option value="login">登录</Select.Option>
          </Select>
          <Select
            placeholder="模块"
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
            placeholder="结果"
            style={{ width: 100 }}
            allowClear
            value={result}
            onChange={v => setResult(v ?? undefined)}
          >
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <Button onClick={() => {
            const next = new URLSearchParams()
            if (query) next.set('q', query)
            if (action) next.set('action', action)
            if (module) next.set('module', module)
            if (result) next.set('result', result)
            setSearchParams(next)
            setPage(1)
            load(1, query || undefined, action, module, result)
          }}>搜索</Button>
        </Space>
      </Card>

      {selectedLog && (
        <Card
          title="日志详情"
          size="small"
          style={{ marginBottom: 16 }}
          extra={<Button size="small" onClick={() => setSelectedLog(null)}>关闭</Button>}
        >
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="操作类型">{selectedLog.action}</Descriptions.Item>
            <Descriptions.Item label="操作结果">
              <Tag color={selectedLog.result === 'success' ? 'success' : 'error'}>
                {selectedLog.result === 'success' ? '成功' : '失败'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="目标类型">{selectedLog.target_type}</Descriptions.Item>
            <Descriptions.Item label="目标ID">{selectedLog.target_id}</Descriptions.Item>
            <Descriptions.Item label="所属模块">{selectedLog.module}</Descriptions.Item>
            <Descriptions.Item label="操作人ID">{selectedLog.operator_id}</Descriptions.Item>
            <Descriptions.Item label="操作时间">{new Date(selectedLog.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="详细说明" span={2}>{selectedLog.detail || '—'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card>
        {logs.length === 0 && !loading ? (
          <Empty description="暂无操作日志" />
        ) : (
          <>
            <Table
              columns={columns}
              dataSource={logs}
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
                  onChange={p => { setPage(p); load(p, query || undefined, action, module, result) }}
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
