// 分析工作模块 - 新建分析
import { Card, Form, Input, Button, Upload, Typography, Space, List, Row, Col, Alert, Tag, Select, InputNumber } from 'antd'
import { UploadOutlined, FileOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { analysisApi, UploadProfile } from '../../../services/api'
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
  const [form] = Form.useForm()
  const [manualForm] = Form.useForm()
  const [fileList, setFileList] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const message = useAppMessage()
  const { user } = useAuthStore()
  const isViewer = user?.role === 'viewer'

  const taxpayerContext = {
    taxpayer_id: searchParams.get('taxpayer_id') || '',
    company_name: searchParams.get('company_name') || '',
  }

  const ensureTask = async () => {
    if (taskId) return taskId
    const values = form.getFieldsValue()
    const name = values.name || (taxpayerContext.company_name ? `${taxpayerContext.company_name}案头分析` : `案头分析_${new Date().toLocaleDateString('zh-CN')}`)
    const description = values.description || (taxpayerContext.taxpayer_id ? `针对纳税人识别号 ${taxpayerContext.taxpayer_id} 开展案头分析` : '上传或补录资料后开展案头分析')
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

  const handleCreate = async (values: { name: string; description: string }) => {
    if (isViewer) {
      message.warning('只读用户不能建立分析事项')
      return
    }
    try {
      const taxpayer = {
        taxpayer_id: searchParams.get('taxpayer_id') || '',
        company_name: searchParams.get('company_name') || '',
      }
      const res = await analysisApi.createTask(values.name, values.description, taxpayer)
      if (res.success) {
        setTaskId(res.task_id)
        message.success('分析事项已建立，可以上传资料了')
      }
    } catch {
      message.error('分析事项建立失败，请检查名称后重试')
    }
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
      const result = await analysisApi.addManualData(currentTaskId, dataKind, values)
      setFileList(prev => [...prev, { name: `手工补录-${kindLabel[dataKind]}`, status: 'done', profile: result.profile }])
      manualForm.resetFields(['sales_declared', 'output_declared', 'input_declared', 'revenue', 'cost', 'profit', 'taxable_income', 'salary_amount', 'employee_count', 'pit_tax_amount'])
      message.success('补录数据已纳入本次分析')
    } catch {
      message.error('补录失败')
    }
  }

  return (
    <div>
      <Card title={taxpayerContext.taxpayer_id ? '为该户开展案头分析' : '发起税务风险分析'} style={{ marginBottom: 16 }}>
        {taxpayerContext.taxpayer_id && (
          <Alert
            type="info"
            showIcon
            message="已从一户式工作台带入纳税人信息"
            description={`纳税人：${taxpayerContext.company_name || '未填写名称'}；识别号：${taxpayerContext.taxpayer_id}`}
            style={{ marginTop: 12 }}
          />
        )}
        {isViewer && (
          <Alert
            type="warning"
            showIcon
            message="您当前是只读用户（访客账号）"
            description="只读用户不能建立分析事项、上传资料或发起分析。您可以查看历史分析结果，但不能进行任何修改操作。"
            style={{ marginTop: 12 }}
          />
        )}
      </Card>

      <Card title="分析事项" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          style={{ maxWidth: 600 }}
          initialValues={{
            name: taxpayerContext.company_name ? `${taxpayerContext.company_name}案头分析` : undefined,
            description: taxpayerContext.taxpayer_id ? `针对纳税人识别号 ${taxpayerContext.taxpayer_id} 开展案头分析` : undefined,
          }}
        >
          <Form.Item label="分析名称" name="name" rules={[{ required: true, message: '请输入分析名称' }]}>
            <Input placeholder="如：2026年3月某企业税务专项案头分析" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="写明企业、期间、分析重点，例如：核查某企业 2026-01 至 2026-03 是否存在有进无销、白条入账等风险" rows={3} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              {taskId ? '已建立，可继续上传' : '保存分析事项'}
            </Button>
            {taskId && (
              <Button style={{ marginLeft: 8 }} onClick={handleRun}>
                立即分析
              </Button>
            )}
          </Form.Item>
        </Form>
      </Card>

      <Card title="上传分析资料" style={{ marginBottom: 16 }}>
          <Space style={{ width: '100%' }} direction="vertical">
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              可一次上传任意期间的发票、增值税、企业所得税、个人所得税、财务报表、费用明细等资料；期间不限制为单个年度。
            </Paragraph>
            <Upload.Dragger
              accept=".csv,.xls,.xlsx,.json,.txt,.png,.jpg,.jpeg,.webp,.pdf"
              customRequest={({ file }) => handleUpload(file as File)}
              fileList={fileList.map((item) => ({ uid: item.name, name: item.name, status: item.status }))}
              onRemove={() => false}
              disabled={uploading}
            >
              <p><UploadOutlined /></p>
              <p>点击或拖拽上传文件</p>
              <Text type="secondary" style={{ fontSize: 12 }}>支持 CSV、XLS、XLSX、JSON、TXT、图片和 PDF</Text>
            </Upload.Dragger>
          </Space>
        </Card>

      <Card title="手工填写关键数据" style={{ marginBottom: 16 }}>
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
            initialValues={{ data_kind: 'vat_return', company_name: taxpayerContext.company_name, taxpayer_id: taxpayerContext.taxpayer_id }}
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

      {taskId && fileList.length > 0 && (
        <Card title="已上传文件确认（第3步）" style={{ marginBottom: 16 }}>
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
