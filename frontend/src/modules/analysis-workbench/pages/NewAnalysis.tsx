// 分析工作模块 - 新建分析
import { Card, Form, Input, Button, Upload, Typography, Space, List, Row, Col, Alert, Tag, Select, InputNumber } from 'antd'
import { UploadOutlined, FileOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analysisApi, UploadProfile } from '../../../services/api'
import { useAppMessage } from '../../../hooks/useAppMessage'

const { Text, Paragraph } = Typography

const uploadGuides = [
  { key: 'sales', title: '销项发票', examples: '期间、企业名称、纳税人识别号、金额、购方名称、商品名称', tag: 'sales_invoice' },
  { key: 'purchase', title: '进项发票', examples: '期间、企业名称、纳税人识别号、金额、供应商名称、商品名称', tag: 'purchase_invoice' },
  { key: 'vat', title: '增值税申报', examples: '期间、申报销售额、申报销项、申报进项', tag: 'vat_return' },
  { key: 'cit', title: '企业所得税', examples: '期间、收入总额、主营业务成本、利润总额、应纳税所得额', tag: 'cit_return' },
  { key: 'pit', title: '个人所得税', examples: '期间、工资薪金、申报人数、个税税额、应纳税所得额', tag: 'pit_return' },
  { key: 'finance', title: '财务报表', examples: '期间、主营业务收入、主营业务成本、期初存货、期末存货', tag: 'financial_statement' },
  { key: 'expense', title: '费用/报销', examples: '期间、费用金额、凭证类型', tag: 'expense_detail' },
]

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
  const [form] = Form.useForm()
  const [manualForm] = Form.useForm()
  const [fileList, setFileList] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const navigate = useNavigate()
  const message = useAppMessage()

  const handleUpload = async (file: File) => {
    const filename = file.name.toLowerCase()
    if (filename.endsWith('.xls')) {
      message.error('当前优先支持 CSV、XLSX、JSON、TXT；旧版 XLS 请先另存为 XLSX 或 CSV 后上传')
      return false
    }
    if (!taskId) {
      message.warning('请先创建任务再上传文件')
      return false
    }
    setUploading(true)
    try {
      const result = await analysisApi.uploadFile(taskId, file)
      message.success(`${file.name} 上传成功`)
      setFileList(prev => [...prev, { name: file.name, status: 'done', profile: result.profile }])
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

  const handleManualSubmit = async (values: Record<string, string | number>) => {
    if (!taskId) {
      message.warning('请先创建任务再补录数据')
      return
    }
    const dataKind = values.data_kind as 'vat_return' | 'cit_return' | 'pit_return'
    try {
      const result = await analysisApi.addManualData(taskId, dataKind, values)
      setFileList(prev => [...prev, { name: `手工补录-${kindLabel[dataKind]}`, status: 'done', profile: result.profile }])
      manualForm.resetFields(['sales_declared', 'output_declared', 'input_declared', 'revenue', 'cost', 'profit', 'taxable_income', 'salary_amount', 'employee_count', 'pit_tax_amount'])
      message.success('补录数据已纳入本次分析')
    } catch {
      message.error('补录失败')
    }
  }

  return (
    <div>
      <Card title="税务资料上传规范" style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="推荐上传顺序"
          description="先传发票明细，再传增值税/所得税申报，再传财务报表和费用明细。这样风险识别更完整，通知书与分析报告也会更具体。"
        />
        <Row gutter={[12, 12]}>
          {uploadGuides.map((item) => (
            <Col xs={24} md={12} xl={8} key={item.key}>
              <Card size="small">
                <Space direction="vertical" size={6}>
                  <Space>
                    <Text strong>{item.title}</Text>
                    <Tag>{item.tag}</Tag>
                  </Space>
                  <Text type="secondary">{item.examples}</Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="新建分析任务" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ maxWidth: 600 }}>
          <Form.Item label="分析名称" name="name" rules={[{ required: true, message: '请输入分析名称' }]}>
            <Input placeholder="如：2026年3月某企业税务专项案头分析" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="写明企业、期间、分析重点，例如：核查某企业 2026-01 至 2026-03 是否存在有进无销、白条入账等风险" rows={3} />
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
          <Space style={{ width: '100%' }} direction="vertical">
            <Text type="secondary">当前任务 ID：{taskId}</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              文件名建议直接包含资料类型，例如 `sales_invoices_2026-03.xlsx`、`vat_return_2026-03.csv`、`financial_statement_2026Q1.xlsx`。
            </Paragraph>
            <Upload.Dragger
              accept=".csv,.xlsx,.json,.txt,.png,.jpg,.jpeg,.webp,.pdf"
              customRequest={({ file }) => handleUpload(file as File)}
              fileList={fileList.map((item) => ({ uid: item.name, name: item.name, status: item.status }))}
              onRemove={() => false}
              disabled={uploading}
            >
              <p><UploadOutlined /></p>
              <p>点击或拖拽上传文件</p>
              <Text type="secondary" style={{ fontSize: 12 }}>支持 CSV、XLSX、JSON、TXT、图片和 PDF。图片/PDF 当前作为佐证留存，请配合补录关键指标。</Text>
            </Upload.Dragger>
          </Space>
        </Card>
      )}

      {taskId && (
        <Card title="无表格/无图片时：申报数据手工补录" style={{ marginBottom: 16 }}>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="现实资料不完整时不要中断分析"
            description="如果没有申报表格，甚至没有截图，可以把税务人员掌握的关键指标先补录进来；系统会把补录数据当作结构化资料参与风险识别。"
          />
          <Form
            form={manualForm}
            layout="vertical"
            onFinish={handleManualSubmit}
            initialValues={{ data_kind: 'vat_return' }}
          >
            <Row gutter={12}>
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
                  <Input placeholder="例如：2026-03" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="企业名称" name="company_name">
                  <Input placeholder="可选，但建议填写" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="纳税人识别号" name="taxpayer_id">
                  <Input placeholder="可选" />
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
      )}

      {taskId && fileList.length > 0 && (
        <Card title="已上传文件">
          <List
            size="small"
            dataSource={fileList}
            renderItem={(f) => (
              <List.Item>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space wrap>
                    <FileOutlined />
                    <Text>{f.name}</Text>
                    <Tag color={f.profile.dataset_kind === 'unknown' ? 'warning' : 'blue'}>
                      {kindLabel[f.profile.dataset_kind] || f.profile.dataset_kind}
                    </Tag>
                    <Tag>{f.profile.source_type.toUpperCase()}</Tag>
                    <Text type="secondary">读取 {f.profile.row_count} 行</Text>
                  </Space>
                  {f.profile.headers.length > 0 && (
                    <Text type="secondary">字段：{f.profile.headers.slice(0, 10).join('、')}</Text>
                  )}
                  {f.profile.required_fields.length > 0 && (
                    <Text type={f.profile.missing_required_fields.length > 0 ? 'warning' : 'success'}>
                      字段确认：建议字段 {f.profile.required_fields.join('、')}
                      {f.profile.missing_required_fields.length > 0 ? `；缺少 ${f.profile.missing_required_fields.join('、')}` : '；已满足建议字段'}
                    </Text>
                  )}
                  {f.profile.warnings.length > 0 && (
                    <Text type="warning">{f.profile.warnings.join('；')}</Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  )
}
