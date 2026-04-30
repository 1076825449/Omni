// 分析工作模块 - 分析结果页
import { useEffect, useState } from 'react'
import { Card, Tag, Button, Space, Typography, Skeleton, Result, Descriptions, List, Alert, Divider, Modal, Segmented, Select } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi, AnalysisTaskDetail, taxOfficerWorkbenchApi } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Title, Text, Paragraph } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  queued: { text: '排队中', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  succeeded: { text: '已完成', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
}

const severityMap: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
}

const reviewStatusMap: Record<string, { label: string; color: string }> = {
  pending_review: { label: '待核实', color: 'processing' },
  confirmed: { label: '已确认', color: 'red' },
  false_positive: { label: '误报', color: 'default' },
  rectified: { label: '已整改', color: 'green' },
  transferred: { label: '已移交', color: 'purple' },
  not_synced: { label: '未形成风险事项', color: 'default' },
}

export default function Results() {
  const { id } = useParams<{ id: string }>()
  const [task, setTask] = useState<AnalysisTaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [docOpen, setDocOpen] = useState(false)
  const [docType, setDocType] = useState<'analysis' | 'notice'>('analysis')
  const [docContent, setDocContent] = useState('')
  const [docLoading, setDocLoading] = useState(false)
  const navigate = useNavigate()
  const message = useAppMessage()

  useEffect(() => {
    if (!id) return
    analysisApi.getTask(id).then(data => {
      setTask(data)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [id])

  if (loading) return <Skeleton active style={{ padding: 24 }} />

  if (!task) return (
    <Result
      status="error"
      title="分析记录不存在"
      subTitle="可能是记录已被删除，或当前账号无权查看。"
      extra={<Button onClick={() => navigate('/modules/analysis-workbench/history')}>返回分析记录</Button>}
    />
  )

  const status = statusMap[task.status] || { text: task.status, color: 'default' }

  const handleRerun = async () => {
    if (!task) return
    try {
      const next = await analysisApi.rerunTask(task.task_id)
      navigate(`/modules/analysis-workbench/results/${next.task_id}`)
    } catch {
      // ignore
    }
  }

  const handlePreviewDoc = async (type: 'analysis' | 'notice') => {
    if (!task) return
    setDocType(type)
    setDocOpen(true)
    setDocLoading(true)
    try {
      const content = await analysisApi.reportText(task.task_id, type)
      setDocContent(content)
    } catch {
      setDocContent('文书预览加载失败')
    } finally {
      setDocLoading(false)
    }
  }

  const handleReviewChange = async (recordId: string | null | undefined, status: string) => {
    if (!task || !recordId) return
    try {
      await analysisApi.updateRiskReview(task.task_id, recordId, status)
      setTask({
        ...task,
        risks: task.risks.map((risk) =>
          risk.review_record_id === recordId ? { ...risk, review_status: status } : risk,
        ),
      })
      message.success('复核状态已更新')
    } catch {
      message.error('复核状态更新失败')
    }
  }

  const handleLedgerSync = async (recordId: string | null | undefined) => {
    if (!recordId) {
      message.error('该风险尚未形成可记录事项')
      return
    }
    try {
      const result = await taxOfficerWorkbenchApi.syncRiskToLedger(recordId)
      message.success(result.message)
    } catch {
      message.error('记入风险台账失败')
    }
  }

  return (
    <div>
      <Card title="分析结果" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Title level={4} style={{ margin: 0 }}>{task.name}</Title>
            <Tag color={status.color} style={{ fontSize: 14 }}>{status.text}</Tag>
          </Space>

          <Descriptions size="small" column={2}>
            <Descriptions.Item label="分析编号">{task.task_id}</Descriptions.Item>
            <Descriptions.Item label="企业名称">{task.company_name || '未识别'}</Descriptions.Item>
            <Descriptions.Item label="纳税人识别号">{task.taxpayer_id || '未识别'}</Descriptions.Item>
            <Descriptions.Item label="文件数">{task.file_count}</Descriptions.Item>
            <Descriptions.Item label="日志数">{task.log_count}</Descriptions.Item>
            <Descriptions.Item label="形成风险事项">{task.related_record_count}</Descriptions.Item>
            <Descriptions.Item label="识别风险">{task.risk_count}</Descriptions.Item>
            <Descriptions.Item label="分析期间">{task.periods.length ? task.periods.join(' / ') : '未识别'}</Descriptions.Item>
            {task.taxpayer_id && (
              <Descriptions.Item label="一户式工作台">
                <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/taxpayer-workbench?taxpayer_id=${task.taxpayer_id}`)}>
                  查看该户全部风险和整改记录
                </Button>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">{new Date(task.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
            {task.completed_at && (
              <Descriptions.Item label="完成时间">{new Date(task.completed_at).toLocaleString('zh-CN')}</Descriptions.Item>
            )}
          </Descriptions>
        </Space>
      </Card>

      <Card title="分析摘要">
        {task.status === 'running' && (
          <Result
            status="info"
            title="分析执行中..."
            subTitle="请稍候，结果将在分析完成后显示"
          />
        )}
        {task.status === 'succeeded' && (
          <Result
            status="success"
            title="分析完成"
            subTitle={task.result_summary || '分析已完成，报告可导出'}
            extra={
              <Space>
                <Button
                  type="primary"
                  onClick={() => navigate(`/modules/analysis-workbench/reports/${task?.task_id}`)}
                >
                  导出分析报告
                </Button>
                <Button onClick={() => handlePreviewDoc('analysis')}>
                  预览分析报告
                </Button>
                <Button onClick={() => handlePreviewDoc('notice')}>
                  预览税务事项通知书
                </Button>
                <Button onClick={handleRerun}>
                  用当前资料重新分析
                </Button>
              </Space>
            }
          />
        )}
        {task.status === 'failed' && (
          <Result
            status="error"
            title="分析未完成"
            subTitle={task.result_summary || '分析过程出错。建议先检查上传资料是否为空、表头是否包含期间/金额/纳税人识别号等关键字段，再重新分析。'}
            extra={
              <Space>
                <Button onClick={() => navigate('/modules/analysis-workbench/history')}>返回分析记录</Button>
                <Button type="primary" onClick={handleRerun}>用当前资料重新分析</Button>
              </Space>
            }
          />
        )}
        {task.status === 'queued' && (
          <Result
            status="warning"
            title="等待分析"
            subTitle="分析事项已建立，正在等待处理。"
          />
        )}
        {task.status === 'cancelled' && (
          <Result
            status="warning"
            title="分析已取消"
          />
        )}
      </Card>

      {task.status === 'succeeded' && (
        <Card title="结果详情" style={{ marginTop: 16 }}>
          <Paragraph>{task.result_summary || '本次分析未生成额外摘要。'}</Paragraph>
          {task.data_warnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="数据提醒"
              description={task.data_warnings.join('；')}
            />
          )}
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="已处理文件">{task.file_count}</Descriptions.Item>
            <Descriptions.Item label="形成风险事项">{task.related_record_count}</Descriptions.Item>
            <Descriptions.Item label="结果页">
              <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/tasks')}>
              查看运行记录
              </Button>
            </Descriptions.Item>
            <Descriptions.Item label="操作日志">
              <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/logs')}>
                查看操作记录
              </Button>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {task.status === 'succeeded' && (
        <Card title="税务风险清单" style={{ marginTop: 16 }}>
          {task.risks.length === 0 ? (
            <Result
              status="success"
              title="未识别出明确风险"
              subTitle="当前更接近资料不完整或未形成足够交叉校验条件，建议补齐申报、报表与发票明细后再次分析。"
            />
          ) : (
            <List
              dataSource={task.risks}
              renderItem={(risk, index) => {
                const severity = severityMap[risk.severity] || { label: risk.severity, color: 'default' }
                return (
                  <List.Item>
                    <Card
                      size="small"
                      style={{ width: '100%' }}
                      title={
                        <Space>
                          <Text strong>{index + 1}. {risk.risk_type}</Text>
                          <Tag color={severity.color}>{severity.label}风险</Tag>
                          <Tag>{risk.period}</Tag>
                          <Tag color="geekblue">置信度 {Math.round((risk.confidence || 0) * 100)}%</Tag>
                          <Tag color={reviewStatusMap[risk.review_status || 'not_synced']?.color}>
                            {reviewStatusMap[risk.review_status || 'not_synced']?.label || risk.review_status}
                          </Tag>
                        </Space>
                      }
                      extra={risk.review_record_id ? (
                        <Select
                          size="small"
                          value={risk.review_status || 'pending_review'}
                          style={{ width: 120 }}
                          onChange={(value) => handleReviewChange(risk.review_record_id, value)}
                          options={[
                            { label: '待核实', value: 'pending_review' },
                            { label: '已确认', value: 'confirmed' },
                            { label: '误报', value: 'false_positive' },
                            { label: '已整改', value: 'rectified' },
                            { label: '已移交', value: 'transferred' },
                          ]}
                        />
                      ) : null}
                    >
                      <Paragraph>{risk.issue}</Paragraph>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="规则命中明细"
                        description={
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Text>风险类型：{risk.risk_type}</Text>
                            <Text>规则名称：{risk.rule_name || '规则待补充'}</Text>
                            <Text>为什么发现：{risk.trigger_reason || risk.issue}</Text>
                            <Text>计算过程：{risk.calculation_text || '未生成计算说明'}</Text>
                            <Text>判断阈值：{risk.threshold_text || risk.judgment_rule}</Text>
                            <Text>建议核实资料：{risk.required_materials.join('、') || '—'}</Text>
                            <div>
                              <Text>涉及数据：</Text>
                              <List
                                size="small"
                                dataSource={risk.source_data_refs || []}
                                locale={{ emptyText: '暂无明确数据引用' }}
                                renderItem={(ref) => (
                                  <List.Item>
                                    {ref.dataset_label || ref.dataset_kind}（{ref.period || '期间待核实'}）：
                                    {ref.field_label || ref.field_name} = {String(ref.value)}
                                  </List.Item>
                                )}
                              />
                            </div>
                          </Space>
                        }
                      />
                      <Text strong>为什么发现这个问题</Text>
                      <List
                        size="small"
                        dataSource={risk.evidence}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                      <Divider style={{ margin: '12px 0' }} />
                      <Text strong>企业整改要求</Text>
                      <Paragraph>{risk.rectify_advice}</Paragraph>
                      <Text strong>税务核查方向</Text>
                      <Paragraph>{risk.verification_focus}</Paragraph>
                      <Text strong>需调取资料</Text>
                      <Paragraph>{risk.required_materials.join('、') || '—'}</Paragraph>
                      <Text strong>判断标准</Text>
                      <Paragraph>{risk.judgment_rule}</Paragraph>
                      <Space wrap>
                        <Button type="primary" size="small" onClick={() => handleLedgerSync(risk.review_record_id)}>
                          记入风险台账
                        </Button>
                        <Button size="small" onClick={() => handlePreviewDoc('notice')}>
                          生成税务事项通知书
                        </Button>
                        <Button size="small" onClick={() => handleReviewChange(risk.review_record_id, 'false_positive')}>
                          标记无需处理
                        </Button>
                      </Space>
                    </Card>
                  </List.Item>
                )
              }}
            />
          )}
        </Card>
      )}

      {task.status === 'succeeded' && task.material_gap_list.length > 0 && (
        <Card title="资料缺口清单" style={{ marginTop: 16 }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="建议优先向企业调取以下资料"
            description="该清单由已识别风险的核查材料要求汇总生成，用于下一步核实和通知书准备。"
          />
          <Space wrap>
            {task.material_gap_list.map((item) => <Tag key={item}>{item}</Tag>)}
          </Space>
        </Card>
      )}

      {task.files.length > 0 && (
        <Card title="输入文件" style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={task.files}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Card>
      )}

      {task.status === 'succeeded' && task.related_record_count > 0 && (
        <Card
          title="已形成的风险事项"
          style={{ marginTop: 16 }}
          extra={
            <Button size="small" onClick={() => navigate('/my-risk-list')}>
              查看全部 {task.related_record_count} 条
            </Button>
          }
        >
              <Text>分析完成后已形成 <strong>{task.related_record_count}</strong> 条风险事项，可继续记入风险台账并跟踪整改。</Text>
          <br />
          <Button type="link" onClick={() => navigate('/my-risk-list')}>
            → 查看管户风险清单
          </Button>
        </Card>
      )}

      <Modal
        title={docType === 'analysis' ? '分析报告预览' : '税务事项通知书预览'}
        open={docOpen}
        onCancel={() => setDocOpen(false)}
        footer={null}
        width={900}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Segmented
            value={docType}
            onChange={(value) => handlePreviewDoc(value as 'analysis' | 'notice')}
            options={[
              { label: '分析报告', value: 'analysis' },
              { label: '通知书', value: 'notice' },
            ]}
          />
          {docLoading ? (
            <Skeleton active paragraph={{ rows: 12 }} />
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'Menlo, monospace', fontSize: 13 }}>
              {docContent}
            </pre>
          )}
        </Space>
      </Modal>
    </div>
  )
}
