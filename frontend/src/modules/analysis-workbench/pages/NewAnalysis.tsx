// 分析工作模块 - 新建分析
import { Card, Form, Input, Button, Upload, Typography, message, Space, List } from 'antd'
import { UploadOutlined, FileOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analysisApi } from '../../../services/api'

const { Title, Text } = Typography

export default function NewAnalysis() {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleUpload = async (file: File) => {
    if (!taskId) {
      message.warning('请先创建任务再上传文件')
      return false
    }
    setUploading(true)
    try {
      await analysisApi.uploadFile(taskId, file)
      message.success(`${file.name} 上传成功`)
      setFileList(prev => [...prev, { name: file.name, status: 'done' }])
    } catch {
      message.error(`${file.name} 上传失败`)
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleCreate = async (values: { name: string; description: string }) => {
    try {
      const res = await analysisApi.createTask(values.name, values.description)
      if (res.success) {
        setTaskId(res.task_id)
        message.success('任务已创建，可以上传文件了')
      }
    } catch {
      message.error('创建任务失败')
    }
  }

  const handleRun = async () => {
    if (!taskId) return
    try {
      await analysisApi.runTask(taskId)
      message.success('分析已开始，请在历史任务中查看结果')
      navigate('/modules/analysis-workbench/history')
    } catch {
      message.error('发起分析失败')
    }
  }

  return (
    <div>
      <Card title="新建分析任务" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ maxWidth: 600 }}>
          <Form.Item label="分析名称" name="name" rules={[{ required: true, message: '请输入分析名称' }]}>
            <Input placeholder="如：2024年Q1客户分析" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="简要描述本次分析的目的（可选）" rows={2} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              {taskId ? '新建另一个任务' : '创建任务'}
            </Button>
            {taskId && (
              <Button style={{ marginLeft: 8 }} onClick={handleRun}>
                发起分析
              </Button>
            )}
          </Form.Item>
        </Form>
      </Card>

      {taskId && (
        <Card title="上传分析资料" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">当前任务 ID：{taskId}</Text>
            <Upload.Dragger
              accept=".csv,.xlsx,.xls,.json,.txt"
              customRequest={({ file }) => handleUpload(file as File)}
              fileList={fileList}
              onRemove={() => false}
              disabled={uploading}
            >
              <p><UploadOutlined /></p>
              <p>点击或拖拽上传文件</p>
              <Text type="secondary" style={{ fontSize: 12 }}>支持 CSV、XLSX、XLS、JSON、TXT</Text>
            </Upload.Dragger>
          </Space>
        </Card>
      )}

      {taskId && fileList.length > 0 && (
        <Card title="已上传文件">
          <List
            size="small"
            dataSource={fileList}
            renderItem={(f: any) => (
              <List.Item>
                <Space>
                  <FileOutlined />
                  <Text>{f.name}</Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  )
}
