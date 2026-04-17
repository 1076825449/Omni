// 对象管理模块 - 对象详情页
import { useEffect, useState } from 'react'
import { Card, Descriptions, Tag, Button, Space, Typography, Spin, Form, Input, message, Popconfirm } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { recordsApi, RecordItem } from '../../../services/api'

const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '活跃', color: 'green' },
  archived: { text: '已归档', color: 'default' },
  locked: { text: '已锁定', color: 'red' },
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<RecordItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const load = () => {
    if (!id) return
    setLoading(true)
    recordsApi.get(id).then(data => {
      setRecord(data)
      form.setFieldsValue(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleSave = async () => {
    try {
      const values = form.getFieldsValue()
      await recordsApi.update(id!, values)
      message.success('保存成功')
      setEditing(false)
      load()
    } catch {
      message.error('保存失败')
    }
  }

  const handleArchive = async () => {
    try {
      await recordsApi.delete(id!)
      message.success('已归档')
      navigate('/modules/record-operations/list')
    } catch {
      message.error('操作失败')
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
  if (!record) return <Card><Text>对象不存在</Text></Card>

  const status = statusMap[record.status] || { text: record.status, color: 'default' }

  return (
    <Card
      title="对象详情"
      extra={
        <Space>
          {editing ? (
            <>
              <Button type="primary" onClick={handleSave}>保存</Button>
              <Button onClick={() => { setEditing(false); form.setFieldsValue(record) }}>取消</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setEditing(true)}>编辑</Button>
              <Popconfirm title="确认归档此对象？" onConfirm={handleArchive}>
                <Button danger>归档</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="ID">{record.record_id}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={status.color}>{status.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="名称">
            {editing
              ? <Form.Item name="name" noStyle><Input /></Form.Item>
              : record.name}
          </Descriptions.Item>
          <Descriptions.Item label="分类">
            {editing
              ? <Form.Item name="category" noStyle><Input /></Form.Item>
              : record.category || <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">
            {editing
              ? <Form.Item name="assignee" noStyle><Input /></Form.Item>
              : record.assignee || <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="标签">
            {editing
              ? <Form.Item name="tags" noStyle><Input /></Form.Item>
              : record.tags || <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(record.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{new Date(record.updated_at).toLocaleString('zh-CN')}</Descriptions.Item>
          <Descriptions.Item label="详情" span={2}>
            {editing
              ? <Form.Item name="detail" noStyle><Input.TextArea rows={3} /></Form.Item>
              : record.detail || <Text type="secondary">—</Text>}
          </Descriptions.Item>
        </Descriptions>
      </Form>
    </Card>
  )
}
