// 文件中心
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Input, Select, Typography, Empty, Pagination, Modal, Image } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { FilePreview, FileRecord, Module } from '../../services/api'
import { filesApi, modulesApi } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'

const { Title, Text } = Typography

const columns: ColumnsType<FileRecord> = [
  {
    title: '文件名',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '所属模块',
    dataIndex: 'module',
    key: 'module',
    width: 160,
  },
  {
    title: '类型',
    dataIndex: 'mime_type',
    key: 'mime_type',
    width: 120,
  },
  {
    title: '大小',
    dataIndex: 'size',
    key: 'size',
    width: 100,
    render: (s: number) => s < 1024 ? `${s} B` : s < 1024 * 1024 ? `${(s / 1024).toFixed(1)} KB` : `${(s / 1024 / 1024).toFixed(1)} MB`,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '正常' : s === 'archived' ? '已归档' : '已删除'}</Tag>,
  },
  {
    title: '时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
    render: (t: string) => new Date(t).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render: (_: any, record: FileRecord) => (
      <Space>
        <Button size="small" onClick={() => window.open(filesApi.downloadUrl(record.file_id), '_blank')}>下载</Button>
        <Button size="small">详情</Button>
      </Space>
    ),
  },
]

export default function FileCenter() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [module, setModule] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const message = useAppMessage()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const load = (p = 1, q?: string, m?: string, s?: string) => {
    setLoading(true)
    filesApi.list({ q, module: m, status: s, limit: 10, offset: (p - 1) * 10 })
      .then(({ files: data, total: n }) => {
        setFiles(data)
        setTotal(n)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    modulesApi.list().then(({ modules: data }) => {
      setModules(data.filter(item => item.status === 'active'))
    }).catch(() => {})
    const q = searchParams.get('q') || ''
    const moduleValue = searchParams.get('module') || undefined
    const statusValue = searchParams.get('status') || undefined
    setQuery(q)
    setModule(moduleValue)
    setStatus(statusValue)
    load(1, q || undefined, moduleValue, statusValue)
  }, [])

  const handleArchive = async (fileId: string) => {
    try {
      await filesApi.archive(fileId)
      void message.success('文件已归档')
      load(page, query || undefined, module, status)
    } catch {
      void message.error('归档失败')
    }
  }

  const handlePreview = async (fileId: string) => {
    setPreviewLoading(true)
    setPreviewOpen(true)
    try {
      const data = await filesApi.preview(fileId)
      setPreview(data)
    } catch {
      void message.error('加载预览失败')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const columnsWithAction: ColumnsType<FileRecord> = columns.map(column => {
    if (column.key !== 'action') return column
    return {
      ...column,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => void handlePreview(record.file_id)}>
            预览
          </Button>
          <Button size="small" onClick={() => navigate(`/modules/${record.module}`)}>来源模块</Button>
          <Button size="small" disabled={record.status !== 'active'} onClick={() => void handleArchive(record.file_id)}>
            归档
          </Button>
        </Space>
      ),
    }
  })

  return (
    <div className="omni-page">
      <div className="omni-page-header">
        <Title level={4} style={{ margin: 0 }}>文件中心</Title>
        <Text type="secondary">全平台文件统一管理</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索文件名"
            style={{ width: 200 }}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Select
            placeholder="所属模块"
            style={{ width: 180 }}
            allowClear
            value={module}
            onChange={v => setModule(v ?? undefined)}
          >
            {modules.map(item => (
              <Select.Option key={item.key} value={item.key}>{item.name}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="文件状态"
            style={{ width: 120 }}
            allowClear
            value={status}
            onChange={v => setStatus(v ?? undefined)}
          >
            <Select.Option value="active">正常</Select.Option>
            <Select.Option value="archived">已归档</Select.Option>
            <Select.Option value="deleted">已删除</Select.Option>
          </Select>
          <Button onClick={() => {
            const next = new URLSearchParams()
            if (query) next.set('q', query)
            if (module) next.set('module', module)
            if (status) next.set('status', status)
            setSearchParams(next)
            setPage(1)
            load(1, query || undefined, module, status)
          }}>搜索</Button>
        </Space>
      </Card>

      <Card>
        {files.length === 0 && !loading ? (
          <Empty description="暂无文件记录" />
        ) : (
          <>
            <Table
              columns={columnsWithAction}
              dataSource={files}
              rowKey="id"
              size="small"
              pagination={false}
              loading={loading}
            />
            {total > 10 && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Pagination
                  current={page}
                  total={total}
                  pageSize={10}
                  onChange={p => { setPage(p); load(p, query || undefined, module, status) }}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <Modal
        title={preview?.original_name || '文件预览'}
        open={previewOpen}
        onCancel={() => { setPreviewOpen(false); setPreview(null) }}
        footer={null}
        width={800}
      >
        {previewLoading ? (
          <Text type="secondary">加载中...</Text>
        ) : !preview ? (
          <Text type="secondary">暂无预览内容</Text>
        ) : preview.preview_type === 'image' && preview.preview_url ? (
          <Image src={preview.preview_url} alt={preview.original_name} style={{ maxHeight: 480, objectFit: 'contain' }} />
        ) : (
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 480, overflow: 'auto', margin: 0 }}>
            {preview.content || '暂无可展示内容'}
          </pre>
        )}
      </Modal>
    </div>
  )
}
