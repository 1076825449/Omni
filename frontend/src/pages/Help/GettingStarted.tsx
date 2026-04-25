// 帮助中心 - 新手起步
import { Card, Steps, Typography, Space, Button, Tag, List, Divider } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const steps = [
  {
    title: '登录平台',
    desc: '使用分配给你的账号密码登录 Omni 平台。默认测试账号：admin / admin123（管理员）',
    action: '前往登录',
    path: '/login',
    tip: '首次使用请先联系管理员开通账号',
  },
  {
    title: '导入纳税人信息（建议第一步）',
    desc: '进入「纳税人信息查询」模块，导入企业基础信息表。这是分析和风险台账的数据基础。',
    action: '导入纳税人信息',
    path: '/modules/info-query',
    tip: '支持 CSV 和 Excel 格式，导入后会显示成功/失败数量',
  },
  {
    title: '发起分析任务',
    desc: '进入「涉税风险分析」模块，上传发票、申报、财务等资料，系统会自动识别并生成风险分析结果。',
    action: '发起分析',
    path: '/modules/analysis-workbench',
    tip: '支持增值税发票、企业所得税、财务报表等资料',
  },
  {
    title: '记录和管理风险',
    desc: '在「风险记录台账」中跟踪风险事项的处理状态（待核实 → 整改中 → 已整改）。',
    action: '查看风险台账',
    path: '/modules/risk-ledger',
    tip: '可以从分析结果直接生成风险记录',
  },
  {
    title: '管理业务对象',
    desc: '在「对象管理」中统一管理企业、任务对象、处理记录，支持批量导入和分类标签管理。',
    action: '进入对象管理',
    path: '/modules/record-operations',
    tip: '对象可以关联到分析任务和风险记录',
  },
  {
    title: '定时任务（可选）',
    desc: '在「定时任务」中设置自动执行的周期任务，如每天自动备份数据。',
    action: '创建定时任务',
    path: '/modules/schedule-workbench',
    tip: '提供常用时间模板，无需了解技术细节',
  },
]

const moduleList = [
  { key: 'analysis-workbench', name: '涉税风险分析', desc: '上传资料，生成风险分析结果和整改建议', color: 'red' },
  { key: 'info-query', name: '纳税人信息查询', desc: '导入和查询纳税人基础信息', color: 'cyan' },
  { key: 'risk-ledger', name: '风险记录台账', desc: '记录和跟踪风险事项处理状态', color: 'orange' },
  { key: 'record-operations', name: '对象管理', desc: '统一管理业务对象和记录', color: 'blue' },
  { key: 'learning-lab', name: '学习训练', desc: '业务知识练习和效果统计', color: 'green' },
  { key: 'schedule-workbench', name: '定时任务', desc: '设置自动执行的周期任务', color: 'default' },
  { key: 'dashboard-workbench', name: '数据看板', desc: '查看平台整体运行统计', color: 'purple' },
]

export default function GettingStarted() {
  const navigate = useNavigate()

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>3 分钟上手指南</Title>
        <Text type="secondary">快速了解 Omni 平台并开始你的第一个任务</Text>
      </div>

      {/* 快速开始流程 */}
      <Card title="快速开始流程" style={{ marginBottom: 16 }}>
        <Steps
          current={-1}
          direction="horizontal"
          size="small"
          items={steps.map((s, i) => ({
            title: (
              <Text style={{ fontSize: 13 }}>{`第${i + 1}步`}</Text>
            ),
            description: (
              <Space direction="vertical" size={4} style={{ maxWidth: 160 }}>
                <Text strong style={{ fontSize: 13 }}>{s.title}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{s.desc}</Text>
                <Button
                  size="small"
                  type="link"
                  onClick={() => navigate(s.path)}
                  style={{ padding: 0, height: 'auto' }}
                >
                  {s.action} →
                </Button>
              </Space>
            ),
          }))}
        />
      </Card>

      {/* 角色说明 */}
      <Card title="你的账号能做什么？" style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%' }} size={16}>
          <Card size="small" style={{ minWidth: 200, background: '#fff2f0' }}>
            <Space direction="vertical" size={4}>
              <Text strong>👑 管理员（admin）</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>可使用全部功能，包括：</Text>
              <Text style={{ fontSize: 12 }}>• 用户和角色管理</Text>
              <Text style={{ fontSize: 12 }}>• 模块注册和配置</Text>
              <Text style={{ fontSize: 12 }}>• 备份和恢复</Text>
              <Text style={{ fontSize: 12 }}>• 系统设置</Text>
            </Space>
          </Card>
          <Card size="small" style={{ minWidth: 200, background: '#f6ffed' }}>
            <Space direction="vertical" size={4}>
              <Text strong>👤 普通用户（user）</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>可使用全部业务功能，但不能：</Text>
              <Text style={{ fontSize: 12 }}>• 管理用户和角色</Text>
              <Text style={{ fontSize: 12 }}>• 执行备份恢复</Text>
              <Text style={{ fontSize: 12 }}>• 修改系统配置</Text>
            </Space>
          </Card>
          <Card size="small" style={{ minWidth: 200, background: '#f9f9f9' }}>
            <Space direction="vertical" size={4}>
              <Text strong>👁 访客（viewer）</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>只读账号，只能查看，不能：</Text>
              <Text style={{ fontSize: 12 }}>• 新建、编辑、删除</Text>
              <Text style={{ fontSize: 12 }}>• 上传文件或导入数据</Text>
              <Text style={{ fontSize: 12 }}>• 执行任何操作</Text>
            </Space>
          </Card>
        </Space>
      </Card>

      {/* 7个模块快速览 */}
      <Card title="平台模块一览" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={moduleList}
          renderItem={item => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{item.name}</Text>
                    <Tag color={item.color}>功能模块</Tag>
                  </Space>
                }
                description={item.desc}
              />
              <Button size="small" type="link" onClick={() => navigate(`/modules/${item.key}`)}>
                进入 →
              </Button>
            </List.Item>
          )}
        />
      </Card>

      {/* 常见操作路径 */}
      <Card title="常见操作路径">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <Text strong>路径1：完成一个完整的风险分析</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <Tag>导入纳税人信息</Tag>
                <Text type="secondary">→</Text>
                <Tag>发起分析</Tag>
                <Text type="secondary">→</Text>
                <Tag>查看风险结果</Tag>
                <Text type="secondary">→</Text>
                <Tag>记录到风险台账</Tag>
                <Text type="secondary">→</Text>
                <Tag>跟踪整改</Tag>
              </Space>
            </div>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>路径2：批量管理业务对象</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <Tag>导入CSV/Excel</Tag>
                <Text type="secondary">→</Text>
                <Tag>查看对象列表</Tag>
                <Text type="secondary">→</Text>
                <Tag>分类/标签管理</Tag>
                <Text type="secondary">→</Text>
                <Tag>归档或编辑</Tag>
              </Space>
            </div>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>路径3：定时自动化</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <Tag>创建定时任务</Tag>
                <Text type="secondary">→</Text>
                <Tag>选择执行时间</Tag>
                <Text type="secondary">→</Text>
                <Tag>设置任务类型</Tag>
                <Text type="secondary">→</Text>
                <Tag>查看执行历史</Tag>
              </Space>
            </div>
          </div>
        </Space>
      </Card>
    </div>
  )
}
