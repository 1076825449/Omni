// 分析工作模块 - 历史任务
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Typography, Empty } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { analysisApi, AnalysisTask } from '../../../services/api'

const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  queued: { text: '排队中', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  succeeded: { text: '已完成', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
}

export default function History() {
  const [tasks, setTasks] = useState<AnalysisTask[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    analysisApi.listTasks().then(({ tasks: data }) => {
      setTasks(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCancel = async (taskId: string) => {
    try {
      await analysisApi.cancelTask(taskId)
      load()
    } catch {
      // ignore
    }
  }

  const handleRerun = async (taskId: string) => {
    try {
      const next = await analysisApi.rerunTask(taskId)
      navigate(`/modules/analysis-workbench/results/${next.task_id}`)
    } catch {
      // ignore
    }
  }

  const columns: ColumnsType<AnalysisTask> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r) => (
        <Button type="link" onClick={() => navigate(`/modules/analysis-workbench/results/${r.task_id}`)}>
          {name}
        </Button>
      ),
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
      title: '文件数',
      dataIndex: 'file_count',
      key: 'file_count',
      width: 80,
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
      width: 150,
      render: (_, r: AnalysisTask) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/modules/analysis-workbench/results/${r.task_id}`)}>
            查看
          </Button>
          {r.file_count > 0 && (
            <Button size="small" onClick={() => handleRerun(r.task_id)}>
              重跑
            </Button>
          )}
          {r.status === 'queued' && (
            <Button size="small" danger onClick={() => handleCancel(r.task_id)}>
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card title="分析历史">
      {tasks.length === 0 && !loading ? (
        <Empty description="暂无分析历史，请先新建分析" />
      ) : (
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          size="small"
          loading={loading}
        />
      )}
    </Card>
  )
}
