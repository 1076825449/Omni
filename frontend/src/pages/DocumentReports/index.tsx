import { useEffect, useState } from 'react'
import { Button, Card, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { analysisApi, AnalysisTask } from '../../services/api'
import { useAppMessage } from '../../hooks/useAppMessage'
import BusinessPageHeader from '../../components/BusinessPageHeader'

const { Text } = Typography

export default function DocumentReports() {
  const [rows, setRows] = useState<AnalysisTask[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const message = useAppMessage()
  const pageSize = 20

  const load = async (keyword = q, nextPage = page, nextStatus = status) => {
    setLoading(true)
    try {
      const result = await analysisApi.listTasks({
        q: keyword,
        status: nextStatus,
        limit: pageSize,
        offset: (nextPage - 1) * pageSize,
      })
      setRows(result.tasks)
      setTotal(result.total)
    } catch {
      void message.error('文书报告暂时无法加载，请确认案头分析服务正常后刷新')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    setPage(1)
    void load(q, 1, status)
  }, [status])

  const columns: ColumnsType<AnalysisTask> = [
    { title: '分析事项', dataIndex: 'name', key: 'name', width: 360, render: (value) => <Text strong>{value}</Text> },
    { title: '任务编号', dataIndex: 'task_id', key: 'task_id', width: 190, render: value => <Text type="secondary">{value}</Text> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: value => <Tag color={value === 'succeeded' ? 'green' : value === 'failed' ? 'red' : 'blue'}>{value === 'succeeded' ? '已完成' : value === 'failed' ? '失败' : '处理中'}</Tag> },
    { title: '资料数', dataIndex: 'file_count', key: 'file_count', width: 90 },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: value => new Date(value).toLocaleString('zh-CN') },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/modules/analysis-workbench/results/${record.task_id}`)}>查看疑点</Button>
          <Button size="small" type="primary" onClick={() => navigate(`/modules/analysis-workbench/reports/${record.task_id}`)}>生成文书</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="business-page">
      <div className="business-page-wide">
      <BusinessPageHeader
        title="文书报告"
        description="集中查看案头分析结果，生成税务事项通知书和疑点核实报告。"
        extra={
          <Space wrap>
            <Input.Search
              placeholder="搜索企业、事项名称或任务编号"
              allowClear
              value={q}
              onChange={event => setQ(event.target.value)}
              onSearch={(value) => {
                setPage(1)
                void load(value, 1, status)
              }}
              style={{ width: 360 }}
            />
            <Select
              placeholder="处理状态"
              allowClear
              value={status}
              onChange={setStatus}
              style={{ width: 140 }}
              options={[
                { value: 'succeeded', label: '已完成' },
                { value: 'running', label: '处理中' },
                { value: 'queued', label: '排队中' },
                { value: 'failed', label: '失败' },
              ]}
            />
            <Button onClick={() => load(q, page, status)}>刷新</Button>
          </Space>
        }
      />
      <Card
        className="business-section"
        styles={{ body: { padding: 16 } }}
        style={{ width: '100%' }}
      >
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="task_id"
          loading={loading}
          size="small"
          scroll={{ x: 1160 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: value => `共 ${value} 条分析结果`,
            onChange: nextPage => {
              setPage(nextPage)
              void load(q, nextPage, status)
            },
          }}
          locale={{
            emptyText: (
              <Empty description={q || status ? '没有符合当前条件的文书报告' : '暂无案头分析结果。请先进入案头分析上传资料或补录数据。'}>
                <Space>
                  <Button onClick={() => { setQ(''); setStatus(undefined); setPage(1); void load('', 1, undefined) }}>清空筛选</Button>
                  <Button type="primary" onClick={() => navigate('/modules/analysis-workbench')}>发起案头分析</Button>
                </Space>
              </Empty>
            ),
          }}
        />
      </Card>
      </div>
    </div>
  )
}
