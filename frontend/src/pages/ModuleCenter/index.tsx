// 模块中心
import { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Tag, Button, Space, Spin, Empty, Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { modulesApi } from '../../services/api'
import type { Module } from '../../services/api'

const { Title, Text, Paragraph } = Typography

// 7个正式模块的用户友好说明
const moduleDescriptions: Record<string, {
  name: string
  shortDesc: string
  scenarios: string[]
  tag: string
  tagColor: string
}> = {
  'analysis-workbench': {
    name: '涉税风险分析',
    shortDesc: '上传企业申报、发票、财务等资料，生成风险分析结果和整改建议。',
    scenarios: ['上传发票和申报数据进行风险识别', '生成税务事项通知书', '跟踪风险整改进展'],
    tag: '核心业务',
    tagColor: 'red',
  },
  'record-operations': {
    name: '对象管理',
    shortDesc: '统一管理企业、任务对象、风险对象和处理记录。',
    scenarios: ['批量导入业务对象数据', '分类标签管理', '追踪对象来源和关联'],
    tag: '数据管理',
    tagColor: 'blue',
  },
  'info-query': {
    name: '纳税人信息查询',
    shortDesc: '导入和查询纳税人基础信息，是分析和风险台账的数据来源。',
    scenarios: ['导入纳税人基本信息', '查询企业画像', '按管理员统计管户情况'],
    tag: '基础数据',
    tagColor: 'cyan',
  },
  'risk-ledger': {
    name: '风险记录台账',
    shortDesc: '按纳税人记录风险事项、处理过程和整改状态。',
    scenarios: ['记录新发现的风险事项', '跟踪整改进度', '按状态统计风险情况'],
    tag: '风险处理',
    tagColor: 'orange',
  },
  'learning-lab': {
    name: '学习训练',
    shortDesc: '业务知识练习、错题复习和学习效果统计。',
    scenarios: ['开始练习提升业务能力', '复习收藏的错题', '查看学习统计'],
    tag: '学习训练',
    tagColor: 'green',
  },
  'dashboard-workbench': {
    name: '数据看板',
    shortDesc: '查看平台整体运行情况，包括任务、文件、风险和模块使用统计。',
    scenarios: ['查看任务完成情况', '了解平台整体运转', '按时间范围查看趋势'],
    tag: '数据总览',
    tagColor: 'purple',
  },
  'schedule-workbench': {
    name: '定时任务',
    shortDesc: '设置定时分析、定时备份或其他周期任务，自动执行。',
    scenarios: ['设置每天自动执行分析', '定期备份平台数据', '周期性的数据整理任务'],
    tag: '系统工具',
    tagColor: 'default',
  },
}

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: '正常运行', color: 'success' },
  developing: { label: '开发中', color: 'processing' },
  offline: { label: '已下线', color: 'default' },
}

export default function ModuleCenter() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    modulesApi.list().then(data => {
      setModules(data.modules)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>模块中心</Title>
          <Text type="secondary">
            平台共 {modules.filter(m => m.status === 'active').length} 个可用模块，点击进入相应模块开始使用。
          </Text>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : modules.length === 0 ? (
        <Empty description="暂无可用模块" />
      ) : (
        <Row gutter={[16, 16]}>
          {modules.map(m => {
            const desc = moduleDescriptions[m.key] || {
              name: m.name,
              shortDesc: m.description || '平台功能模块',
              scenarios: [],
              tag: '功能模块',
              tagColor: 'default',
            }

            return (
              <Col xs={24} sm={12} lg={8} key={m.key}>
                <Card
                  hoverable
                  className="omni-module-card"
                  styles={{ body: { padding: 20 } }}
                >
                  <Space style={{ width: '100%' }} direction="vertical" size={12}>
                    {/* 模块头部：图标+名称+状态 */}
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Text style={{ fontSize: 28 }}>{m.icon}</Text>
                        <Space direction="vertical" size={0}>
                          <Text strong style={{ fontSize: 16 }}>{desc.name}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {m.name}
                          </Text>
                        </Space>
                      </Space>
                      <Tag color={statusMap[m.status]?.color}>
                        {statusMap[m.status]?.label}
                      </Tag>
                    </Space>

                    {/* 模块描述 */}
                    <Paragraph
                      type="secondary"
                      style={{ margin: 0, fontSize: 13 }}
                      ellipsis={{ rows: 2 }}
                    >
                      {desc.shortDesc}
                    </Paragraph>

                    {/* 适用场景 */}
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        适用场景：
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        {desc.scenarios.map((s, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
                            • {s}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 标签和操作 */}
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tag color={desc.tagColor}>{desc.tag}</Tag>
                      <Link to={`/modules/${m.key}`}>
                        <Button
                          type="primary"
                          size="small"
                          disabled={m.status !== 'active'}
                        >
                          {m.status === 'active' ? '进入模块' : '暂不可用'}
                        </Button>
                      </Link>
                    </Space>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}
    </div>
  )
}
