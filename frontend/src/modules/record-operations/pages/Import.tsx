// 对象管理模块 - 导入页
import { Card, Upload, Button, Typography, message, List, Space } from 'antd'
import { UploadOutlined, FileOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { recordsApi } from '../../../services/api'

const { Title, Text } = Typography

export default function RecordImport() {
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState<{ name: string; count: number } | null>(null)
  const navigate = useNavigate()

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const res = await recordsApi.importFile(file)
      if (res.success) {
        const count = parseInt(res.message?.match(/\d+/) || '0')
        setDone({ name: file.name, count })
        message.success(res.message)
      } else {
        message.error('导入失败')
      }
    } catch {
      message.error('导入失败，请检查文件格式')
    } finally {
      setUploading(false)
    }
    return false
  }

  return (
    <Card title="导入对象数据">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Title level={5}>上传 CSV 文件</Title>
          <Text type="secondary">
            CSV 文件应包含 <code>name</code> 列（必填），可选列：<code>category</code>、<code>assignee</code>、<code>tags</code>、<code>detail</code>
          </Text>
        </div>

        <Upload.Dragger
          accept=".csv"
          customRequest={({ file }) => handleUpload(file as File)}
          disabled={uploading}
        >
          <p><UploadOutlined style={{ fontSize: 32, color: '#1677ff' }} /></p>
          <p>点击或拖拽上传 CSV 文件</p>
          <p><Text type="secondary" style={{ fontSize: 12 }}>支持 CSV 格式，第一行需为表头</Text></p>
        </Upload.Dragger>

        {done && (
          <Card type="inner" title="导入结果">
            <List size="small">
              <List.Item>
                <Space>
                  <FileOutlined />
                  <Text>{done.name}</Text>
                </Space>
              </List.Item>
            </List>
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" onClick={() => navigate('/modules/record-operations/list')}>查看列表</Button>
              <Button onClick={() => setDone(null)}>继续导入</Button>
            </Space>
          </Card>
        )}

        <Card type="inner" title="CSV 示例" style={{ background: '#f5f5f5' }}>
          <pre style={{ fontSize: 12, overflow: 'auto' }}>{`name,category,assignee,tags,detail\n测试对象1,北京,张三,重要,测试详情\n测试对象2,上海,李四,常规,测试详情2`}</pre>
        </Card>
      </Space>
    </Card>
  )
}
