// 分析工作模块 - 报告导出页
import { Card, Button, Space, Typography, Result } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

export default function Reports() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div>
      <Card title="报告导出" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>任务 ID：{id}</Text>
          <Text type="secondary">选择导出格式</Text>
          <Space>
            <Button type="primary" disabled>导出为 PDF</Button>
            <Button disabled>导出为 Excel</Button>
            <Button disabled>导出为 JSON</Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            * 导出功能为占位实现，实际导出需要接入文件生成服务
          </Text>
        </Space>
      </Card>

      <Result
        status="info"
        title="报告导出功能"
        subTitle="此为标准样板模块，占位实现。实际项目中需接入后端文件生成服务。"
        extra={
          <Button onClick={() => navigate('/modules/analysis-workbench/history')}>
            返回历史任务
          </Button>
        }
      />
    </div>
  )
}
