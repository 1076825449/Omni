// 日志中心
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Space, Input, Select, DatePicker, Typography, Empty, Pagination, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { OperationLog } from '../../services/api'
import { logsApi } from '../../services/api'

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
]

export default function LogCenter() {
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<string | undefined>()
  const [module, setModule] = useState<string | undefined>()
  const [result, setResult] = useState<string | undefined>()

  const load = (p = 1, a?: string, m?: string, r?: string) => {
    setLoading(true)
    logsApi.list({ action: a, module: m, result: r, limit: 10, offset: (p - 1) * 10 })
      .then(({ logs: data, total: n }) => {
        setLogs(data)
        setTotal(n)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>日志中心</Title>
        <Text type="secondary">全平台操作行为审计追踪</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="操作类型"
            style={{ width: 120 }}
            allowClear
            onChange={v => { setAction(v ?? undefined); load(1, v ?? action, module, result) }}
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
            onChange={v => { setModule(v ?? undefined); load(1, action, v ?? module, result) }}
          >
            <Select.Option value="platform">平台公共</Select.Option>
            <Select.Option value="analysis-workbench">分析工作模块</Select.Option>
            <Select.Option value="record-operations">对象管理模块</Select.Option>
            <Select.Option value="learning-lab">学习训练模块</Select.Option>
          </Select>
          <Select
            placeholder="结果"
            style={{ width: 100 }}
            allowClear
            onChange={v => { setResult(v ?? undefined); load(1, action, module, v ?? result) }}
          >
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <Button onClick={() => load(1, action, module, result)}>搜索</Button>
        </Space>
      </Card>

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
                  onChange={p => { setPage(p); load(p, action, module, result) }}
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
