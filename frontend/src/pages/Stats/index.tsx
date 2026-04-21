// 平台统计页
import { Card, Row, Col, Statistic, Progress, Typography, Space, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { platformStatsApi } from '../../services/api'

const { Title, Text } = Typography

export default function Stats() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    platformStatsApi.overview().then(d => {
      setData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
  if (!data) return <Card><Text>加载失败</Text></Card>

  const { task_total, task_done, task_failed, task_success_rate, file_total, file_active, record_total, log_total, module_active } = data

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>平台统计</Title>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="任务总数" value={task_total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="任务成功率" value={task_success_rate} suffix="%" />
            <Progress percent={task_success_rate} showInfo={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="文件总数" value={file_total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="活跃文件" value={file_active} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="对象记录" value={record_total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="操作日志" value={log_total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="活跃模块" value={module_active} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="失败任务" value={task_failed} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="任务状态分布" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>成功</Text>
                <Progress percent={task_total > 0 ? Math.round(task_done / task_total * 100) : 0} strokeColor="#52c41a" />
              </div>
              <div>
                <Text>失败</Text>
                <Progress percent={task_total > 0 ? Math.round(task_failed / task_total * 100) : 0} strokeColor="#ff4d4f" />
              </div>
              <div>
                <Text>进行中/待处理</Text>
                <Progress percent={task_total > 0 ? Math.round((task_total - task_done - task_failed) / task_total * 100) : 0} strokeColor="#1677ff" />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="快捷入口" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">任务 {task_total} 个 | 文件 {file_total} 个 | 对象 {record_total} 条 | 日志 {log_total} 条</Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
