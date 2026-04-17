// 分析工作模块 - 分析结果页
import { useEffect, useState } from 'react'
import { Card, Tag, Button, Space, Typography, Skeleton, Result, Descriptions } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi, AnalysisTaskDetail } from '../../../services/api'

const { Title, Text, Paragraph } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  queued: { text: '排队中', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  succeeded: { text: '已完成', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
}

export default function Results() {
  const { id } = useParams<{ id: string }>()
  const [task, setTask] = useState<AnalysisTaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    analysisApi.getTask(id).then(data => {
      setTask(data)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [id])

  if (loading) return <Skeleton active style={{ padding: 24 }} />

  if (!task) return (
    <Result
      status="error"
      title="任务不存在"
      extra={<Button onClick={() => navigate('/modules/analysis-workbench/history')}>返回历史</Button>}
    />
  )

  const status = statusMap[task.status] || { text: task.status, color: 'default' }

  return (
    <div>
      <Card title="分析结果" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Title level={4} style={{ margin: 0 }}>{task.name}</Title>
            <Tag color={status.color} style={{ fontSize: 14 }}>{status.text}</Tag>
          </Space>

          <Descriptions size="small" column={2}>
            <Descriptions.Item label="任务ID">{task.task_id}</Descriptions.Item>
            <Descriptions.Item label="文件数">{task.file_count}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(task.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
            {task.completed_at && (
              <Descriptions.Item label="完成时间">{new Date(task.completed_at).toLocaleString('zh-CN')}</Descriptions.Item>
            )}
          </Descriptions>
        </Space>
      </Card>

      <Card title="分析摘要">
        {task.status === 'running' && (
          <Result
            status="info"
            title="分析执行中..."
            subTitle="请稍候，结果将在任务完成后显示"
          />
        )}
        {task.status === 'succeeded' && (
          <Result
            status="success"
            title="分析完成"
            subTitle={task.result_summary || '分析已完成，报告可导出'}
            extra={
              <Button
                type="primary"
                onClick={() => navigate(`/modules/analysis-workbench/reports/${task?.task_id}`)}
              >
                导出报告
              </Button>
            }
          />
        )}
        {task.status === 'failed' && (
          <Result
            status="error"
            title="分析失败"
            subTitle={task.result_summary || '分析过程出错，请重试'}
            extra={
              <Button
                onClick={() => navigate('/modules/analysis-workbench/history')}
              >
                返回历史
              </Button>
            }
          />
        )}
        {task.status === 'queued' && (
          <Result
            status="warning"
            title="任务排队中"
            subTitle="任务已创建，正在等待处理"
          />
        )}
        {task.status === 'cancelled' && (
          <Result
            status="warning"
            title="任务已取消"
          />
        )}
      </Card>

      {task.status === 'succeeded' && (
        <Card title="结果详情" style={{ marginTop: 16 }}>
          <Paragraph>
            {task.result_summary || '本次分析共产出 1 份报告，包含以下关键发现：'}
          </Paragraph>
          <ul>
            <li>关键发现一：数据分布呈现显著特征</li>
            <li>关键发现二：存在 3 条异常记录需要关注</li>
            <li>关键发现三：趋势分析显示增长潜力</li>
          </ul>
          <Text type="secondary">* 以上为模拟结果，实际分析取决于上传的原始数据</Text>
        </Card>
      )}
    </div>
  )
}
