// 对象管理模块 - 导入页
import { Card, Form, Upload, Button, Input, Typography, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function RecordImport() {
  const [form] = Form.useForm()

  const onFinish = (values: unknown) => {
    console.log('导入:', values)
    message.success('导入任务已创建（占位）')
  }

  return (
    <Card title="导入数据">
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 600 }}>
        <Form.Item label="导入名称" name="name" rules={[{ required: true, message: '请输入导入名称' }]}>
          <Input placeholder="请输入导入名称" />
        </Form.Item>
        <Form.Item label="上传文件" name="file">
          <Upload.Dragger accept=".csv,.xlsx,.json" maxCount={5}>
            <p><UploadOutlined /></p>
            <p>点击或拖拽上传</p>
            <Text type="secondary" style={{ fontSize: 12 }}>支持 CSV、XLSX、JSON 格式</Text>
          </Upload.Dragger>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">开始导入</Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
