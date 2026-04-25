import { Button, Card, Form, Input, Space, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { recordsApi } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Text } = Typography

export default function NewRecord() {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const message = useAppMessage()

  const handleCreate = async (values: {
    name: string
    category?: string
    assignee?: string
    tags?: string
    detail?: string
  }) => {
    try {
      const record = await recordsApi.create(values)
      void message.success('对象已创建')
      navigate(`/modules/record-operations/${record.record_id}`)
    } catch {
      void message.error('创建对象失败')
    }
  }

  return (
    <Card title="新建对象">
      <Form form={form} layout="vertical" onFinish={(values) => { void handleCreate(values) }} style={{ maxWidth: 720 }}>
        <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入对象名称' }]}>
          <Input placeholder="例如：客户 A / 风险事件 001" />
        </Form.Item>
        <Form.Item label="分类" name="category">
          <Input placeholder="例如：客户 / 线索 / 风险" />
        </Form.Item>
        <Form.Item label="负责人" name="assignee">
          <Input placeholder="例如：张三" />
        </Form.Item>
        <Form.Item label="标签" name="tags">
          <Input placeholder="多个标签用逗号分隔" />
        </Form.Item>
        <Form.Item label="详情" name="detail">
          <Input.TextArea rows={4} placeholder="补充说明对象背景、来源和处理备注" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit">创建对象</Button>
            <Button onClick={() => navigate('/modules/record-operations/list')}>返回列表</Button>
          </Space>
        </Form.Item>
      </Form>

      <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
        新建后可继续在详情页编辑，并在平台日志中心查看对应操作记录。
      </Text>
    </Card>
  )
}
