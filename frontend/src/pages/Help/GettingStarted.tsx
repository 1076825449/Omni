// 帮助中心 - 新手起步
import { Card, Steps, Typography, Space, Button, Tag } from 'antd'
import { Link, useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const steps = [
  {
    title: '登录平台',
    desc: '使用分配给你的账号密码登录 Omni 平台。测试账号：admin / admin123',
    action: '前往登录',
    path: '/login',
  },
  {
    title: '了解模块',
    desc: '进入「模块中心」，了解平台已安装的功能模块，点击任意模块开始使用。',
    action: '模块中心',
    path: '/modules',
  },
  {
    title: '发起第一个任务',
    desc: '进入「分析工作台」，上传文件并发起分析任务，任务完成后查看结果和日志。',
    action: '分析工作台',
    path: '/modules/analysis-workbench',
  },
  {
    title: '管理对象数据',
    desc: '进入「对象管理」，通过 CSV 导入业务数据，进行分类、分配和批量操作。',
    action: '对象管理',
    path: '/modules/record-operations',
  },
  {
    title: '查看任务与日志',
    desc: '进入「任务中心」和「日志中心」，追踪所有操作的历史记录。',
    action: '任务中心',
    path: '/tasks',
  },
  {
    title: '备份重要数据',
    desc: '定期进入「系统设置 → 备份中心」，手动发起备份，确保平台数据安全。',
    action: '系统设置',
    path: '/settings',
  },
]

export default function GettingStarted() {
  const navigate = useNavigate()

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>新手起步</Title>
      </div>

      <Card title="Omni 平台使用流程" style={{ marginBottom: 16 }}>
        <Steps
          current={-1}
          direction="vertical"
          items={steps.map((s, i) => ({
            title: s.title,
            description: (
              <Space direction="vertical">
                <Text type="secondary">{s.desc}</Text>
                <Button
                  size="small"
                  type="link"
                  onClick={() => navigate(s.path)}
                >
                  {s.action} →
                </Button>
              </Space>
            ),
          }))}
        />
      </Card>

      <Card title="平台核心概念">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>模块</Text>
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              平台的功能单元。每个模块独立功能，如「分析工作台」「对象管理」。模块之间可联动跳转。
            </Paragraph>
          </div>
          <div>
            <Text strong>任务中心</Text>
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              所有耗时操作（分析、导入、批量处理、导出）统一进入任务中心，全程可追踪。
            </Paragraph>
          </div>
          <div>
            <Text strong>文件中心</Text>
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              所有文件（上传的原始文件、生成的报告、导出的结果）统一进入文件中心，可按模块筛选。
            </Paragraph>
          </div>
          <div>
            <Text strong>日志中心</Text>
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              所有操作行为（新建、修改、删除、状态变更）自动记录，可追溯、可审计。
            </Paragraph>
          </div>
          <div>
            <Text strong>角色与权限</Text>
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              平台采用 RBAC 模型：admin 拥有全部权限，user 可进行常规操作，viewer 仅可读。具体权限在「系统设置 → 角色管理」中配置。
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  )
}
