import { useEffect, useState } from 'react'
import { Button, Card, Empty, Input, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { analysisApi, AnalysisTask } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'

const { Title, Text } = Typography

export default function DocumentReports() {
  const [rows, setRows] = useState<AnalysisTask[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const message = useAppMessage()

  const load = async () => {
    setLoading(true)
    try {
      const result = await analysisApi.listTasks()
      setRows(result.tasks)
    } catch {
      void message.error('加载文书报告列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = rows.filter(item => {
    if (!q.trim()) return true
    const keyword = q.trim()
    return item.name.includes(keyword) || item.task_id.includes(keyword)
  })

  const columns: ColumnsType<AnalysisTask> = [
    { title: '分析事项', dataIndex: 'name', key: 'name', render: (value) => <Text strong>{value}</Text> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: value => <Tag color={value === 'succeeded' ? 'green' : value === 'failed' ? 'red' : 'blue'}>{value === 'succeeded' ? '已完成' : value === 'failed' ? '失败' : '处理中'}</Tag> },
    { title: '资料数', dataIndex: 'file_count', key: 'file_count', width: 90 },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: value => new Date(value).toLocaleString('zh-CN') },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/modules/analysis-workbench/results/${record.task_id}`)}>查看疑点</Button>
          <Button size="small" type="primary" onClick={() => navigate(`/modules/analysis-workbench/reports/${record.task_id}`)}>生成文书</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>文书报告</Title>
        <Text type="secondary">集中查看案头分析结果，生成税务事项通知书和疑点核实报告。</Text>
      </div>
      <Card
        title="可生成文书的分析结果"
        extra={<Input.Search placeholder="搜索企业、事项名称" allowClear value={q} onChange={event => setQ(event.target.value)} style={{ width: 260 }} />}
      >
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="task_id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description="暂无案头分析结果。请先进入案头分析上传资料或补录数据。" /> }}
        />
      </Card>
    </div>
  )
}
