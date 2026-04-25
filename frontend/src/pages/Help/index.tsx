// 帮助中心页
import { Card, Typography, Space, Divider, Tag, Collapse, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const faqs = [
  {
    q: '如何创建分析任务？',
    a: '进入「分析工作台」模块，点击「新建分析」，填写任务名称和描述，确认后系统会创建任务并等待发起分析。',
  },
  {
    q: '文件上传有限制吗？',
    a: '平台文件中心支持常见格式（PDF、Word、Excel、图片等），单文件大小建议不超过 100MB。',
  },
  {
    q: '备份文件在哪里下载？',
    a: '进入「系统设置 → 备份中心」，找到对应备份记录，点击下载按钮获取 ZIP 备份文件。',
  },
  {
    q: '如何管理对象数据？',
    a: '进入「对象管理」模块，可以通过 CSV 导入数据，在列表页进行筛选、编辑和批量操作。',
  },
  {
    q: '权限不足怎么办？',
    a: '请联系管理员（admin 账号），在「系统设置 → 角色管理」中调整您的角色和权限。',
  },
  {
    q: '分析任务可以取消吗？',
    a: '可以，在任务详情页点击「取消」按钮可将任务状态变更为已取消。',
  },
]

const modules = [
  { key: 'analysis-workbench', label: '分析工作模块', type: '工作流型', desc: '创建任务 → 上传资料 → 发起分析 → 查看结果与报告', color: 'blue' },
  { key: 'record-operations', label: '对象管理模块', type: '列表型', desc: '导入 → 列表管理 → 分类/分配 → 批量操作', color: 'green' },
  { key: 'learning-lab', label: '学习训练模块', type: '轻交互型', desc: '选择题集 → 开始练习 → 查看结果 → 收藏与统计', color: 'purple' },
  { key: 'dashboard-workbench', label: '数据仪表盘', type: '看板型', desc: '查看平台统计、趋势和最近活动', color: 'cyan' },
  { key: 'schedule-workbench', label: '定时调度', type: '工作流型', desc: '创建 cron 任务 → 手动执行 → 进入任务/日志中心追踪', color: 'orange' },
]

export default function Help() {
  const navigate = useNavigate()

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>帮助中心</Title>
        <Button type="primary" size="small" onClick={() => navigate('/help/getting-started')}>
          新手起步
        </Button>
      </div>

      <Card title="平台模块概览" style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%' }} direction="vertical">
          {modules.map(m => (
            <Card key={m.key} type="inner" size="small">
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <Text strong>{m.label}</Text>
                  <Tag color={m.color}>{m.type}</Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>{m.desc}</Text>
              </Space>
            </Card>
          ))}
        </Space>
      </Card>

      <Card title="常见问题" style={{ marginBottom: 16 }}>
        <Collapse items={faqs.map((f, i) => ({
          key: String(i),
          label: f.q,
          children: <Text>{f.a}</Text>,
        }))} />
      </Card>

      <Card title="使用注意事项">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Title level={5}>📊 统计数据说明</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              首页和数据看板中的统计数据来自平台真实操作记录，包括任务、文件、日志等。数据反映的是系统中实际发生的行为，不是预设目标。
            </Paragraph>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Title level={5}>🔔 通知消息说明</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              当任务完成、导入结束、分析有风险发现时，系统会在通知中心提醒你。如果没有看到通知，请检查「全部已读」筛选条件，或点击「全部标为已读」刷新状态。
            </Paragraph>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Title level={5}>📋 风险状态说明</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              风险台账中的状态流转：待核实 → 整改中 → 已整改，或待核实 → 已排除（核实后不是风险）。如果风险已移交其他部门，选择「已移交」并记录原因。
            </Paragraph>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Title level={5}>💾 数据备份说明</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              建议定期备份平台数据。备份文件包含数据库和所有上传文件。恢复时需要停服操作，并使用 CLI 命令执行。详情见「管理员手册」。
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  )
}
