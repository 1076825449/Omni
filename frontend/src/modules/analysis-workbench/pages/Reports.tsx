// 分析工作模块 - 报告导出页
import { Card, Button, Space, Typography, Result, Form, Input, Row, Col } from 'antd'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi, DocumentConfig } from '../../../services/api'

const { Text } = Typography

export default function Reports() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [docConfig, setDocConfig] = useState<DocumentConfig>({})
  const reportLinks = id ? [
    { key: 'analysis-docx', label: '下载核实报告 DOCX', href: analysisApi.reportUrl(id, 'docx', 'analysis', docConfig), primary: true },
    { key: 'notice-docx', label: '下载通知书 DOCX', href: analysisApi.reportUrl(id, 'docx', 'notice', docConfig), primary: true },
    { key: 'analysis-json', label: '分析报告 JSON', href: analysisApi.reportUrl(id, 'json', 'analysis', docConfig) },
    { key: 'analysis-txt', label: '分析报告 TXT', href: analysisApi.reportUrl(id, 'txt', 'analysis', docConfig) },
    { key: 'notice-json', label: '通知书 JSON', href: analysisApi.reportUrl(id, 'json', 'notice', docConfig) },
    { key: 'notice-txt', label: '通知书 TXT', href: analysisApi.reportUrl(id, 'txt', 'notice', docConfig) },
  ] : []

  return (
    <div>
      <Card title="报告导出" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>任务 ID：{id}</Text>
          <Text type="secondary">导出税务事项通知书与税务分析报告</Text>
          <Space>
            {reportLinks.map((item, index) => (
              <Button key={item.key} type={item.primary || index === 0 ? 'primary' : 'default'} href={item.href}>
                {item.label}
              </Button>
            ))}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>分析报告面向税务人员，通知书面向企业；正式流转优先下载 DOCX，JSON/TXT 用于数据核对和快速预览。</Text>
        </Space>
      </Card>

      <Card title="文书信息确认" style={{ marginBottom: 16 }}>
        <Form
          layout="vertical"
          onValuesChange={(_, values) => setDocConfig(values)}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="税务机关名称" name="agency_name">
                <Input placeholder="例如：国家税务总局XX市XX区税务局" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="文号" name="document_number">
                <Input placeholder="例如：税通〔2026〕001号" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="联系人" name="contact_person">
                <Input placeholder="填写经办税务人员姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="联系电话" name="contact_phone">
                <Input placeholder="填写联系电话" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="整改期限" name="rectification_deadline">
                <Input placeholder="例如：2026年5月10日前" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="文书日期" name="document_date">
                <Input placeholder="例如：2026-04-29" />
              </Form.Item>
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12 }}>
            未填写的字段继续使用系统默认值；正式流转前建议至少填写税务机关、文号、联系人、联系电话、整改期限和文书日期。
          </Text>
        </Form>
      </Card>

      <Result
        status="success"
        title="报告导出已就绪"
        subTitle="下载后的文书包含问题描述、证据、整改要求、核查方向和需调取资料。"
        extra={
          <Space>
            <Button onClick={() => navigate(`/modules/analysis-workbench/results/${id}`)}>返回结果页</Button>
            <Button onClick={() => navigate('/modules/analysis-workbench/history')}>返回历史任务</Button>
          </Space>
        }
      />
    </div>
  )
}
