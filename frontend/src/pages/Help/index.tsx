// 帮助中心页
import { Card, Typography, List, Space, Divider, Tag, Collapse } from 'antd'
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
  { key: 'analysis-workbench', label: '分析工作台', type: '工作流型', desc: '发起分析 → 执行 → 查看结果 → 日志全链路追踪', color: 'blue' },
  { key: 'record-operations', label: '对象管理', type: '列表型', desc: '导入 → 列表管理 → 分类/分配 → 批量操作 → 导出', color: 'green' },
  { key: 'learning-lab', label: '学习实验室', type: '学习型', desc: '课程管理 → 章节跟踪 → 进度可视化', color: 'purple' },
]

export default function Help() {
  const navigate = useNavigate()

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>帮助中心</Title>
      </div>

      <Card title="平台模块概览" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
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

      <Card title="平台规范">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Title level={5}>任务接入规范</Title>
            <Paragraph type="secondary">所有耗时操作（分析执行、导入处理、批量操作、导出生成）必须接入平台任务中心，写入 Task 模型，全流程可追踪。</Paragraph>
          </div>
          <Divider />
          <div>
            <Title level={5}>文件接入规范</Title>
            <Paragraph type="secondary">所有模块产生的文件（上传原始文件、生成结果文件、导出文件）必须接入平台文件中心，写入 FileRecord 模型，可统一检索和归档。</Paragraph>
          </div>
          <Divider />
          <div>
            <Title level={5}>日志接入规范</Title>
            <Paragraph type="secondary">所有用户操作（新建、修改、删除、状态变更）必须写入 OperationLog 模型，日志按模块分组，支持追溯。</Paragraph>
          </div>
          <Divider />
          <div>
            <Title level={5}>权限模型</Title>
            <Paragraph type="secondary">平台采用 RBAC 模型：Role → Permissions → User。admin 拥有全部权限，user 拥有常规操作权限，viewer 仅可读。具体权限点在角色管理中配置。</Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  )
}
