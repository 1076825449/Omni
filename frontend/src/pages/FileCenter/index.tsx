// 文件中心
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Input, Select, Typography, Empty, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FileRecord } from '../../services/api'
import { filesApi } from '../../services/api'

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
    render: () => (
      <Space>
        <Button size="small">下载</Button>
        <Button size="small">详情</Button>
      </Space>
    ),
  },
]

export default function FileCenter() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [module, setModule] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()

  const load = (p = 1, m?: string, s?: string) => {
    setLoading(true)
    filesApi.list({ module: m, status: s, limit: 10, offset: (p - 1) * 10 })
      .then(({ files: data, total: n }) => {
        setFiles(data)
        setTotal(n)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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
            onChange={e => load(1, e.target.value || undefined, status)}
          />
          <Select
            placeholder="所属模块"
            style={{ width: 180 }}
            allowClear
            onChange={v => { setModule(v ?? undefined); load(1, v ?? module, status) }}
          >
            <Select.Option value="analysis-workbench">分析工作模块</Select.Option>
            <Select.Option value="record-operations">对象管理模块</Select.Option>
            <Select.Option value="learning-lab">学习训练模块</Select.Option>
          </Select>
          <Select
            placeholder="文件状态"
            style={{ width: 120 }}
            allowClear
            onChange={v => { setStatus(v ?? undefined); load(1, module, v ?? undefined) }}
          >
            <Select.Option value="active">正常</Select.Option>
            <Select.Option value="archived">已归档</Select.Option>
            <Select.Option value="deleted">已删除</Select.Option>
          </Select>
          <Button onClick={() => load(1, module, status)}>搜索</Button>
        </Space>
      </Card>

      <Card>
        {files.length === 0 && !loading ? (
          <Empty description="暂无文件记录" />
        ) : (
          <>
            <Table
              columns={columns}
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
                  onChange={p => { setPage(p); load(p, module, status) }}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
