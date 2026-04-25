// 对象管理模块 - 对象详情页
import { useEffect, useState } from 'react'
import { Card, Descriptions, Tag, Button, Space, Typography, Spin, Form, Input, Popconfirm, List } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { recordsApi, RecordItem, RecordRelations } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '活跃', color: 'green' },
  archived: { text: '已归档', color: 'default' },
  locked: { text: '已锁定', color: 'red' },
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<RecordItem | null>(null)
  const [relations, setRelations] = useState<RecordRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const message = useAppMessage()

  const load = () => {
    if (!id) return
    setLoading(true)
    recordsApi.get(id).then(data => {
      setRecord(data)
      form.setFieldsValue(data)
      return recordsApi.relations(id)
    }).then(data => {
      setRelations(data)
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
    <Space direction="vertical" style={{ width: '100%' }} size="large">
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
            <Descriptions.Item label="来源批次">{record.import_batch || <Text type="secondary">人工创建</Text>}</Descriptions.Item>
            <Descriptions.Item label="来源任务">
              {relations?.source_task_id ? (
                <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/tasks?taskId=${relations.source_task_id}`)}>
                  {relations.source_task_id}
                </Button>
              ) : <Text type="secondary">—</Text>}
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

      <Card title="平台联动">
        <Space wrap>
          {relations?.source_task_id && (
            <Button onClick={() => navigate(`/modules/analysis-workbench/results/${relations.source_task_id}`)}>
              查看来源分析
            </Button>
          )}
          <Button onClick={() => navigate(`/logs?q=${encodeURIComponent(record.record_id)}`)}>
            查看对象日志
          </Button>
          {record.import_batch && (
            <Button onClick={() => navigate(`/modules/record-operations/list?batch=${encodeURIComponent(record.import_batch)}`)}>
              查看同批对象
            </Button>
          )}
        </Space>
      </Card>

      <Card title="关联文件">
        {relations?.files?.length ? (
          <List
            size="small"
            dataSource={relations.files}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key="files" size="small" onClick={() => navigate(`/files?q=${encodeURIComponent(item.original_name)}&module=${item.module}`)}>
                    在文件中心查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={item.original_name}
                  description={`${item.module} · ${new Date(item.created_at).toLocaleString('zh-CN')}`}
                />
              </List.Item>
            )}
          />
        ) : <Text type="secondary">暂无关联文件</Text>}
      </Card>

      <Card title="关联日志">
        {relations?.logs?.length ? (
          <List
            size="small"
            dataSource={relations.logs}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key="logs" size="small" onClick={() => navigate(`/logs?q=${encodeURIComponent(item.detail)}&module=${item.module}`)}>
                    在日志中心查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={`${item.action} · ${item.result === 'success' ? '成功' : '失败'}`}
                  description={`${item.detail} · ${new Date(item.created_at).toLocaleString('zh-CN')}`}
                />
              </List.Item>
            )}
          />
        ) : <Text type="secondary">暂无关联日志</Text>}
      </Card>
    </Space>
  )
}
