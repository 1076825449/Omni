// 模块中心
import { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Tag, Button, Space, Spin, Empty } from 'antd'
import { Link } from 'react-router-dom'
import type { Module } from '../../services/api'

const { Title, Text, Paragraph } = Typography

const typeMap: Record<string, { label: string; color: string }> = {
  workflow: { label: '工作流型', color: 'blue' },
  list: { label: '列表型', color: 'gold' },
  interactive: { label: '轻交互型', color: 'green' },
}

const priorityMap: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'default' },
}

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: '正常运行', color: 'success' },
  developing: { label: '开发中', color: 'processing' },
  offline: { label: '已下线', color: 'default' },
}

export default function ModuleCenter() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string | null>(null)

  useEffect(() => {
    modulesApi.list().then(data => {
      setModules(data.modules)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = filterType
    ? modules.filter(m => m.type === filterType)
    : modules

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>模块中心</Title>
            <Text type="secondary">所有模块统一入口，点击进入</Text>
          </div>
          <Space>
            <Button size="small" onClick={() => setFilterType(null)} type={!filterType ? 'primary' : 'default'}>
              全部
            </Button>
            {Object.entries(typeMap).map(([k, v]) => (
              <Button
                key={k}
                size="small"
                onClick={() => setFilterType(k)}
                type={filterType === k ? 'primary' : 'default'}
              >
                {v.label}
              </Button>
            ))}
          </Space>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : filtered.length === 0 ? (
        <Empty description="暂无可用模块" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map(m => (
            <Col xs={24} sm={12} lg={8} key={m.key}>
              <Card hoverable className="omni-module-card">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Text style={{ fontSize: 20 }}>{m.icon}</Text>
                      <Text strong style={{ fontSize: 16 }}>{m.name}</Text>
                    </Space>
                    <Tag color={statusMap[m.status]?.color}>{statusMap[m.status]?.label}</Tag>
                  </Space>

                  <Space size={4} wrap>
                    <Tag color={typeMap[m.type]?.color}>{typeMap[m.type]?.label}</Tag>
                    <Tag color={priorityMap[m.priority]?.color}>优先级：{priorityMap[m.priority]?.label}</Tag>
                  </Space>

                  <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }} ellipsis={{ rows: 2 }}>
                    {m.description}
                  </Paragraph>

                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Key: <code>{m.key}</code>
                  </Text>

                  <Link to={`/modules/${m.key}`}>
                    <Button
                      type="primary"
                      size="small"
                      disabled={m.status !== 'active'}
                      style={{ marginTop: 8 }}
                    >
                      {m.status === 'active' ? '进入模块' : '暂不可用'}
                    </Button>
                  </Link>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
