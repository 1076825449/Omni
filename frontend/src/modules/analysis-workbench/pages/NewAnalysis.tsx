// 分析工作模块 - 新建分析
import { Card, Form, Input, Button, Upload, Typography, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function NewAnalysis() {
  const [form] = Form.useForm()

  const onFinish = (values: unknown) => {
    console.log('新建分析:', values)
    message.success('分析任务已创建（占位）')
  }

  return (
    <div>
      <Card title="发起新分析">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 600 }}
        >
          <Form.Item label="分析名称" name="name" rules={[{ required: true, message: '请输入分析名称' }]}>
            <Input placeholder="请输入分析名称" />
          </Form.Item>

          <Form.Item label="描述" name="desc">
            <Input.TextArea placeholder="请输入分析描述（可选）" rows={3} />
          </Form.Item>

          <Form.Item label="上传资料" name="files">
            <Upload.Dragger accept=".csv,.xlsx,.json,.txt" maxCount={10}>
              <p><UploadOutlined /></p>
              <p>点击或拖拽上传文件</p>
              <Text type="secondary" style={{ fontSize: 12 }}>支持 CSV、XLSX、JSON、TXT 格式</Text>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">发起分析</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
