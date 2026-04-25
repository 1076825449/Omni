// 分析工作模块 - 报告导出页
import { Card, Button, Space, Typography, Result } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi } from '../../../services/api'

const { Text } = Typography

export default function Reports() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const reportLinks = id ? [
    { key: 'analysis-json', label: '分析报告 JSON', href: analysisApi.reportUrl(id, 'json', 'analysis') },
    { key: 'analysis-txt', label: '分析报告 TXT', href: analysisApi.reportUrl(id, 'txt', 'analysis') },
    { key: 'notice-json', label: '通知书 JSON', href: analysisApi.reportUrl(id, 'json', 'notice') },
    { key: 'notice-txt', label: '通知书 TXT', href: analysisApi.reportUrl(id, 'txt', 'notice') },
  ] : []

  return (
    <div>
      <Card title="报告导出" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>任务 ID：{id}</Text>
          <Text type="secondary">导出税务事项通知书与税务分析报告</Text>
          <Space>
            {reportLinks.map((item, index) => (
              <Button key={item.key} type={index === 0 ? 'primary' : 'default'} href={item.href}>
                {item.label}
              </Button>
            ))}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>分析报告面向税务人员，通知书面向企业；两类文书均支持结构化 JSON 与可读 TXT。</Text>
        </Space>
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
