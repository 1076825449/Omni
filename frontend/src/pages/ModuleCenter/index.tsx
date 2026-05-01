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
    name: '辅助数据管理',
    shortDesc: '用于管理员整理历史记录、辅助数据和系统内部留痕，普通税务人员一般不从这里开始工作。',
    scenarios: ['整理历史辅助数据', '查看分析形成的风险事项', '维护内部分类标签'],
    tag: '系统管理',
    tagColor: 'blue',
  },
  'info-query': {
    name: '管户分配',
    shortDesc: '导入完整信息查询表，按管理员、管户部门查看纳税人分布，并为案头分析和管户记录提供基础信息。',
    scenarios: ['导入税务登记信息查询表', '查询企业画像', '按管理员统计管户情况'],
    tag: '管户基础',
    tagColor: 'cyan',
  },
  'risk-ledger': {
    name: '管户记录',
    shortDesc: '按纳税人记录风险、排除、整改和联系情况，形成一户一档的日常管户记录。',
    scenarios: ['记录新发现的风险事项', '记录风险排除情况', '跟踪整改进度'],
    tag: '管户记录',
    tagColor: 'orange',
  },
  'learning-lab': {
    name: '刷题程序',
    shortDesc: '税务业务题库练习、错题复习和学习效果统计。',
    scenarios: ['开始刷题练习', '复习收藏的错题', '查看学习统计'],
    tag: '刷题训练',
    tagColor: 'green',
  },
  'dashboard-workbench': {
    name: '系统管理：工作统计',
    shortDesc: '查看系统运行情况，包括分析、资料、风险和使用统计。',
    scenarios: ['查看分析完成情况', '了解系统整体运转', '按时间范围查看趋势'],
    tag: '系统管理',
    tagColor: 'purple',
  },
  'schedule-workbench': {
    name: '系统管理：自动任务',
    shortDesc: '设置自动分析、自动备份或其他周期工作。',
    scenarios: ['设置每天自动执行分析', '定期备份数据', '周期性整理资料'],
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
          <Title level={4} style={{ margin: 0 }}>系统管理：全部功能</Title>
          <Text type="secondary">
            这里集中放置业务功能和系统管理功能。日常工作建议优先从首页、信息查询、管户分配、管户记录和案头分析进入。
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
                          {m.status === 'active' ? '进入功能' : '暂不可用'}
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
