// 分析工作模块 - 工作台
import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Button, Space, Typography, List, Skeleton, Tag } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { analysisApi, AnalysisTask } from '../../../services/api'

const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  queued: { text: '排队中', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  succeeded: { text: '已完成', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
}

export default function AnalysisWorkbench() {
  const [tasks, setTasks] = useState<AnalysisTask[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    analysisApi.listTasks().then(({ tasks: data }) => {
      setTasks(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const total = tasks.length
  const running = tasks.filter(t => t.status === 'running' || t.status === 'queued').length
  const done = tasks.filter(t => t.status === 'succeeded').length

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="总分析任务" value={total} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="进行中" value={running} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="已完成" value={done} loading={loading} />
          </Card>
        </Col>
      </Row>

      <Card
        title="快捷操作"
        extra={<Link to="/modules/analysis-workbench/history"><Button size="small">查看全部</Button></Link>}
      >
        <Space style={{ marginBottom: 16 }}>
          <Link to="/modules/analysis-workbench/new">
            <Button type="primary">新建分析</Button>
          </Link>
        </Space>

        <Title level={5} style={{ marginTop: 16 }}>最近分析任务</Title>
        {loading ? (
          <Skeleton active />
        ) : tasks.length === 0 ? (
          <Text type="secondary">暂无分析任务，点击"新建分析"开始</Text>
        ) : (
          <List
            size="small"
            dataSource={tasks.slice(0, 5)}
            renderItem={(item: AnalysisTask) => (
              <List.Item
                actions={[
                  <Button
                    key="detail"
                    size="small"
                    onClick={() => navigate(`/modules/analysis-workbench/results/${item.task_id}`)}
                  >
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{item.name}</Text>
                      <Tag color={statusMap[item.status]?.color}>{statusMap[item.status]?.text}</Tag>
                    </Space>
                  }
                  description={
                    <Space>
                      <Text type="secondary">文件：{item.file_count}</Text>
                      <Text type="secondary">|</Text>
                      <Text type="secondary">{new Date(item.created_at).toLocaleString('zh-CN')}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}
