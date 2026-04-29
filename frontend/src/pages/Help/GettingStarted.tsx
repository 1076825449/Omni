import { Card, Steps, Typography, Space, Button, Tag, List, Divider } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const steps = [
  {
    title: '导入完整信息查询表',
    desc: '先把纳税人识别号、纳税人名称、登记状态、管理员、地址等基础信息导入系统，后续查户、案头分析和风险清单都会自动带出这些信息。',
    action: '导入纳税人信息',
    path: '/modules/info-query',
    tip: '建议使用税务登记信息查询表或完整信息查询表。',
  },
  {
    title: '查一户企业',
    desc: '输入纳税人识别号进入一户式工作台，集中查看基础信息、案头分析、风险记录和整改进展。',
    action: '查一户企业',
    path: '/taxpayer-workbench',
    tip: '这是日常处理单户事项的主入口。',
  },
  {
    title: '开展案头分析',
    desc: '上传增值税、企业所得税、个人所得税、财务报表、进销项发票等资料，系统会按税务比对规则识别疑点。',
    action: '发起案头分析',
    path: '/modules/analysis-workbench',
    tip: '资料越完整，风险判断越可靠。',
  },
  {
    title: '查看疑点和证据',
    desc: '在分析结果页查看每条风险的触发原因、涉及数据、计算过程、判断阈值、建议核实资料。',
    action: '查看历史分析',
    path: '/modules/analysis-workbench/history',
    tip: '先看“为什么发现”，再决定是否要求企业说明。',
  },
  {
    title: '生成通知书和核实报告',
    desc: '填写税务机关、文号、联系人、联系电话、整改期限和文书日期后，下载税务事项通知书和税务疑点核实报告。',
    action: '进入文书报告',
    path: '/modules/analysis-workbench/history',
    tip: '通知书面向纳税人，核实报告面向税务人员。',
  },
  {
    title: '记入风险台账并跟踪整改',
    desc: '将需要处理的疑点记入风险记录台账，按待核实、已排除、整改中、已整改持续记录处理过程。',
    action: '处理风险清单',
    path: '/my-risk-list',
    tip: '首页“今日应处理”会优先提示临期和逾期整改事项。',
  },
]

const workPaths = [
  { name: '单户核实', tags: ['查一户企业', '看案头分析', '记风险记录', '跟踪整改'] },
  { name: '批量处理', tags: ['导入纳税人信息', '查看风险清单', '批量记录风险', '导出清单'] },
  { name: '文书流转', tags: ['确认文书信息', '下载通知书', '下载核实报告', '留存处理记录'] },
]

export default function GettingStarted() {
  const navigate = useNavigate()

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>3 分钟上手指南</Title>
        <Text type="secondary">按税源管理员日常工作路径完成“查户、分析、记录、整改、导出”。</Text>
      </div>

      <Card title="快速开始流程" style={{ marginBottom: 16 }}>
        <Steps
          current={-1}
          direction="vertical"
          size="small"
          items={steps.map((s, i) => ({
            title: <Text strong>{`第${i + 1}步：${s.title}`}</Text>,
            description: (
              <Space direction="vertical" size={4}>
                <Text type="secondary">{s.desc}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>提示：{s.tip}</Text>
                <Button
                  size="small"
                  type={i === 0 ? 'primary' : 'default'}
                  onClick={() => navigate(s.path)}
                >
                  {s.action}
                </Button>
              </Space>
            ),
          }))}
        />
      </Card>

      <Card title="税务工作路径" style={{ marginBottom: 16 }}>
        <List
          dataSource={workPaths}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>{item.name}</Text>
                <Space wrap>
                  {item.tags.map((tag, index) => (
                    <span key={tag}>
                      <Tag>{tag}</Tag>
                      {index < item.tags.length - 1 && <Text type="secondary">→</Text>}
                    </span>
                  ))}
                </Space>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card title="状态怎么理解">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <Text strong>待核实</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>系统或人工发现疑点，但还没有向企业核实或调取资料。</Paragraph>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>已排除</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>经核实后能够说明原因，未形成需要整改的问题。</Paragraph>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>整改中</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>企业已被要求说明、补正资料或整改，仍需跟踪反馈期限。</Paragraph>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>已整改</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>企业已提交说明、补正资料或完成整改，税务人员已记录处理结果。</Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  )
}
