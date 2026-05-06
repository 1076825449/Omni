// 分析工作模块 - 新建分析
import { Card, Form, Input, Button, Upload, Typography, Space, List, Row, Col, Alert, Tag, Select, InputNumber } from 'antd'
import { UploadOutlined, FileOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { analysisApi, taxOfficerWorkbenchApi, TaxpayerProfile, UploadProfile } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'
import { useAuthStore } from '../../../stores/auth'

const { Text, Paragraph } = Typography

const kindLabel: Record<string, string> = {
  sales_invoice: '销项发票',
  purchase_invoice: '进项发票',
  vat_return: '增值税申报',
  cit_return: '企业所得税',
  pit_return: '个人所得税',
  financial_statement: '财务报表',
  expense_detail: '费用/报销',
  image_evidence: '图片/扫描件佐证',
  unknown: '未识别',
  empty: '空文件',
}

type UploadedFile = {
  name: string
  status: 'done'
  profile: UploadProfile
}

export default function NewAnalysis() {
  const [manualForm] = Form.useForm()
  const [fileList, setFileList] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taxpayerOptions, setTaxpayerOptions] = useState<TaxpayerProfile[]>([])
  const [selectedTaxpayer, setSelectedTaxpayer] = useState<TaxpayerProfile | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const message = useAppMessage()
  const { user } = useAuthStore()
  const isViewer = user?.role === 'viewer'

  const taxpayerContext = {
    taxpayer_id: selectedTaxpayer?.taxpayer_id || searchParams.get('taxpayer_id') || '',
    company_name: selectedTaxpayer?.company_name || searchParams.get('company_name') || '',
  }

  const searchTaxpayers = async (keyword: string) => {
    if (!keyword.trim()) return
    try {
      const result = await taxOfficerWorkbenchApi.searchTaxpayers(keyword)
      setTaxpayerOptions(result.items)
    } catch {
      setTaxpayerOptions([])
    }
  }

  const chooseTaxpayer = (taxpayerId: string) => {
    const item = taxpayerOptions.find(option => option.taxpayer_id === taxpayerId)
    if (!item) return
    setSelectedTaxpayer(item)
  }

  const ensureTask = async () => {
    if (taskId) return taskId
    const name = taxpayerContext.company_name ? `${taxpayerContext.company_name}案头分析` : `案头分析_${new Date().toLocaleDateString('zh-CN')}`
    const description = taxpayerContext.taxpayer_id ? `针对纳税人识别号 ${taxpayerContext.taxpayer_id} 开展案头分析` : '上传或补录资料后开展案头分析'
    const res = await analysisApi.createTask(name, description, taxpayerContext)
    setTaskId(res.task_id)
    return res.task_id
  }

  const handleUpload = async (file: File) => {
    if (isViewer) {
      message.warning('只读用户不能上传文件')
      return false
    }
    setUploading(true)
    try {
      const currentTaskId = await ensureTask()
      const result = await analysisApi.uploadFile(currentTaskId, file)
      message.success(`${file.name} 上传成功`)
      setFileList(prev => [...prev, { name: file.name, status: 'done', profile: result.profile }])
    } catch {
      message.error(`${file.name} 上传失败，请检查文件是否加密或格式是否正确`)
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleRun = async () => {
    if (isViewer) {
      message.warning('只读用户不能发起分析')
      return
    }
    const currentTaskId = taskId || await ensureTask()
    try {
      await analysisApi.runTask(currentTaskId)
      message.success('分析已开始，完成后可进入结果页查看疑点并生成文书')
      navigate(`/modules/analysis-workbench/results/${currentTaskId}`)
    } catch {
      message.error('发起分析失败，请确认已上传资料或补录关键数据')
    }
  }

  const handleManualSubmit = async (values: Record<string, string | number>) => {
    const dataKind = values.data_kind as 'vat_return' | 'cit_return' | 'pit_return'
    try {
      const currentTaskId = await ensureTask()
      const result = await analysisApi.addManualData(currentTaskId, dataKind, {
        ...values,
        company_name: values.company_name || taxpayerContext.company_name,
        taxpayer_id: values.taxpayer_id || taxpayerContext.taxpayer_id,
      })
      setFileList(prev => [...prev, { name: `手工补录-${kindLabel[dataKind]}`, status: 'done', profile: result.profile }])
      manualForm.resetFields(['sales_declared', 'output_declared', 'input_declared', 'revenue', 'cost', 'profit', 'taxable_income', 'salary_amount', 'employee_count', 'pit_tax_amount'])
      message.success('补录数据已纳入本次分析')
    } catch {
      message.error('补录失败')
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 20 } }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
          <Space direction="vertical" size={4}>
            <Typography.Title level={4} style={{ margin: 0 }}>案头分析</Typography.Title>
            <Text type="secondary">直接上传资料或补录关键数据，系统自动建立本次分析并识别疑点</Text>
            {taxpayerContext.taxpayer_id && (
              <Space wrap style={{ marginTop: 8 }}>
                <Tag color="blue">已带入企业</Tag>
                <Text>{taxpayerContext.company_name || '未填写名称'}</Text>
                <Text type="secondary">{taxpayerContext.taxpayer_id}</Text>
              </Space>
            )}
          </Space>
          <Button type="primary" disabled={isViewer} onClick={handleRun}>开始识别疑点</Button>
        </Space>
        {isViewer && (
          <Alert
            type="warning"
            showIcon
            message="只读用户不能上传资料、补录数据或发起分析"
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={12}>
          <Card title="上传资料" style={{ height: '100%' }}>
            <Space style={{ width: '100%' }} direction="vertical" size={12}>
            <Upload.Dragger
              accept=".csv,.xls,.xlsx,.json,.txt,.png,.jpg,.jpeg,.webp,.pdf"
              customRequest={({ file }) => handleUpload(file as File)}
              fileList={fileList.map((item) => ({ uid: item.name, name: item.name, status: item.status }))}
              onRemove={() => false}
              disabled={uploading}
            >
              <p><UploadOutlined /></p>
              <p>点击或拖拽上传文件</p>
              <Text type="secondary" style={{ fontSize: 12 }}>支持发票、增值税、所得税、财报、费用明细、图片和 PDF，不限制分析年度</Text>
            </Upload.Dragger>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="手工补录关键数据" style={{ height: '100%' }}>
          <Form
            form={manualForm}
            layout="vertical"
            onFinish={handleManualSubmit}
            initialValues={{ data_kind: 'vat_return' }}
          >
            <Row gutter={12}>
              <Col xs={24}>
                <Form.Item label="选择企业">
                  <Select
                    showSearch
                    allowClear
                    placeholder="输入企业名称、税号、法人或管理员，选择后自动带出全称和识别号"
                    filterOption={false}
                    onSearch={searchTaxpayers}
                    onChange={value => value ? chooseTaxpayer(value) : setSelectedTaxpayer(null)}
                    options={taxpayerOptions.map(item => ({
                      value: item.taxpayer_id,
                      label: `${item.company_name}（${item.taxpayer_id}）`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="资料类型" name="data_kind" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { label: '增值税申报', value: 'vat_return' },
                      { label: '企业所得税申报', value: 'cit_return' },
                      { label: '个人所得税申报', value: 'pit_return' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="期间" name="period" rules={[{ required: true, message: '请输入期间' }]}>
                  <Input placeholder="例如：2026-03、2024-2026、2024年至2026年" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item shouldUpdate noStyle>
              {({ getFieldValue }) => {
                const dataKind = getFieldValue('data_kind')
                if (dataKind === 'vat_return') {
                  return (
                    <Row gutter={12}>
                      <Col xs={24} md={8}><Form.Item label="申报销售额" name="sales_declared"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="申报销项" name="output_declared"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item label="申报进项" name="input_declared"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                    </Row>
                  )
                }
                if (dataKind === 'cit_return') {
                  return (
                    <Row gutter={12}>
                      <Col xs={24} md={6}><Form.Item label="收入总额" name="revenue"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                      <Col xs={24} md={6}><Form.Item label="成本费用" name="cost"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                      <Col xs={24} md={6}><Form.Item label="利润总额" name="profit"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                      <Col xs={24} md={6}><Form.Item label="应纳税所得额" name="taxable_income"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                  )
                }
                return (
                  <Row gutter={12}>
                    <Col xs={24} md={6}><Form.Item label="工资薪金/劳务报酬" name="salary_amount"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                    <Col xs={24} md={6}><Form.Item label="申报人数" name="employee_count"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                    <Col xs={24} md={6}><Form.Item label="个税税额" name="pit_tax_amount"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                    <Col xs={24} md={6}><Form.Item label="应纳税所得额" name="taxable_income"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )
              }}
            </Form.Item>
            <Button type="primary" htmlType="submit">保存补录数据</Button>
          </Form>
          </Card>
        </Col>
      </Row>

      {taskId && fileList.length > 0 && (
        <Card title="已纳入本次分析的资料" style={{ marginBottom: 16 }}>
          <List
            size="small"
            dataSource={fileList}
            renderItem={(f) => (
              <List.Item>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space wrap>
                    <FileOutlined />
                    <Text strong>{f.name}</Text>
                    <Tag color={f.profile.dataset_kind === 'unknown' ? 'warning' : 'blue'}>
                      {kindLabel[f.profile.dataset_kind] || f.profile.dataset_kind}
                    </Tag>
                    <Tag>{f.profile.source_type.toUpperCase()}</Tag>
                    <Text type="secondary">读取 {f.profile.row_count} 行</Text>
                  </Space>
                  {f.profile.headers.length > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>识别的字段：{f.profile.headers.slice(0, 10).join('、')}{f.profile.headers.length > 10 ? '...' : ''}</Text>
                  )}
                  {f.profile.required_fields.length > 0 && (
                    <Text type={f.profile.missing_required_fields.length > 0 ? 'warning' : 'success'} style={{ fontSize: 12 }}>
                      {f.profile.missing_required_fields.length > 0
                        ? `⚠️ 缺少建议字段：${f.profile.missing_required_fields.join('、')}，分析结果可能受影响`
                        : '✅ 字段已满足要求'}
                    </Text>
                  )}
                  {f.profile.warnings.length > 0 && (
                    <Text type="warning" style={{ fontSize: 12 }}>提醒：{f.profile.warnings.join('；')}</Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button type="primary" onClick={handleRun} size="large">
              发起分析
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
