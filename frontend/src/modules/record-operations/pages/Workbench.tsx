// 对象管理模块 - 工作台
import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Button, Space, Typography, List, Skeleton, Tag } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { recordsApi, RecordItem } from '../../../services/api'

const { Title, Text } = Typography

export default function RecordOperationsWorkbench() {
  const [stats, setStats] = useState<{ total: number; active: number; categories: number } | null>(null)
  const [recent, setRecent] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      recordsApi.stats(),
      recordsApi.list({ limit: 5 }),
    ]).then(([s, { records }]) => {
      setStats(s)
      setRecent(records)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="对象总数" value={stats?.total ?? 0} loading={loading} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="活跃对象" value={stats?.active ?? 0} loading={loading} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="分类数" value={stats?.categories ?? 0} loading={loading} /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Card
            title="快捷操作"
            extra={<Link to="/modules/record-operations/import"><Button size="small">导入数据</Button></Link>}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Link to="/modules/record-operations/list"><Button type="primary" block>查看列表</Button></Link>
              <Link to="/modules/record-operations/import"><Button block>导入 CSV</Button></Link>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="最近对象" extra={<Link to="/modules/record-operations/list"><Button size="small">查看全部</Button></Link>}>
            {loading ? <Skeleton active />
             : recent.length === 0 ? <Text type="secondary">暂无对象，请先导入</Text>
             : (
              <List size="small" dataSource={recent} renderItem={(r: RecordItem) => (
                <List.Item style={{ cursor: 'pointer' }} onClick={() => navigate(`/modules/record-operations/${r.record_id}`)}>
                  <List.Item.Meta title={<Text>{r.name}</Text>} description={<Space><Tag>{r.category || '未分类'}</Tag><Text type="secondary">{r.assignee || '未分配'}</Text></Space>} />
                </List.Item>
              )} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
