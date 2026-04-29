import { Card, Typography, Space, Divider, Tag, Collapse, Button, List } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const faqs = [
  {
    q: '每天打开系统先看哪里？',
    a: '先看首页“今日应处理”。逾期未整改、即将到期整改、今日待核实风险会排在前面。',
  },
  {
    q: '如何从一个纳税人开始处理？',
    a: '点击“查一户企业”，输入纳税人识别号，进入一户式工作台查看基础信息、风险记录和分析结果。',
  },
  {
    q: '案头分析结果应该怎么看？',
    a: '重点看“规则命中明细”：为什么发现、涉及哪些数据、计算过程、判断阈值、建议调取哪些资料。',
  },
  {
    q: '通知书和核实报告有什么区别？',
    a: '税务事项通知书面向纳税人，说明存在什么疑点、应如何整改和反馈；税务疑点核实报告面向税务人员，说明核实方向和判断方法。',
  },
  {
    q: '风险已核实不是问题怎么办？',
    a: '在风险清单或一户式工作台中记录处理情况，并将状态标记为“已排除”。',
  },
  {
    q: '权限不足怎么办？',
    a: '联系管理员在“系统管理：系统设置”中调整账号角色或权限。',
  },
]

const workflow = [
  { title: '导入纳税人信息', desc: '建立完整企业基础信息库，供查户、案头分析和风险清单复用。' },
  { title: '查一户企业', desc: '按纳税人识别号或名称进入一户式工作台。' },
  { title: '开展案头分析', desc: '上传申报、财务、发票等资料，识别风险疑点。' },
  { title: '查看疑点和证据', desc: '核对触发原因、涉及数据、计算过程、判断阈值。' },
  { title: '生成通知书和核实报告', desc: '确认文书信息后下载正式 DOCX。' },
  { title: '记入台账并跟踪整改', desc: '记录待核实、已排除、整改中、已整改全过程。' },
]

export default function Help() {
  const navigate = useNavigate()

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>帮助中心</Title>
        <Button type="primary" size="small" onClick={() => navigate('/help/getting-started')}>
          查看上手指南
        </Button>
      </div>

      <Card title="税务工作路径" style={{ marginBottom: 16 }}>
        <List
          dataSource={workflow}
          renderItem={(item, index) => (
            <List.Item>
              <List.Item.Meta
                title={<Space><Tag color="blue">第{index + 1}步</Tag><Text strong>{item.title}</Text></Space>}
                description={item.desc}
              />
            </List.Item>
          )}
        />
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
            <Title level={5}>资料完整性</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              案头分析依赖增值税、企业所得税、个人所得税、财务报表和进销项发票等资料。资料缺失时，系统会给出提醒，风险判断应结合人工核实。
            </Paragraph>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Title level={5}>风险状态</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              常用状态为待核实、已排除、整改中、已整改。逾期只按“最新状态为整改中，且整改期限早于当前时间”判断。
            </Paragraph>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Title level={5}>文书使用</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              下载文书前请先确认税务机关、文号、联系人、联系电话、整改期限和文书日期。正式流转前仍应由税务人员复核。
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  )
}
