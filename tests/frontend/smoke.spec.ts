import { expect, test } from '@playwright/test'

test('login and open key platform pages', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  const scheduleName = `Smoke 调度任务 ${suffix}`
  const analysisName = `Smoke 分析任务 ${suffix}`

  await page.goto('/login')

  await page.getByPlaceholder('请输入用户名').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('税源管理员今日工作台').first()).toBeVisible()
  await expect(page.getByText('常用工作').first()).toBeVisible()
  await expect(page.getByText('今日应处理').first()).toBeVisible()
  await expect(page.getByPlaceholder('输入税号、名称、法人或管理员，直接查询')).toBeVisible()
  // Homepage shows role info
  await expect(page.getByText('当前账号').first()).toBeVisible()

  await page.goto('/modules')
  await expect(page.getByRole('heading', { name: '系统管理：全部功能' })).toBeVisible()
  // Module center shows user-friendly names (e.g. 涉税风险分析)
  await expect(page.getByText('涉税风险分析')).toBeVisible()

  await page.goto('/modules/schedule-workbench')
  await expect(page.getByText('创建定时任务').first()).toBeVisible()
  // Cron template guidance text
  await expect(page.getByText('看不懂 Cron 表达式').first()).toBeVisible()
  await page.getByPlaceholder('例如：每日风险分析').fill(scheduleName)
  await page.getByPlaceholder('说明该任务的用途').fill('Playwright 自动创建的调度任务')
  await page.getByPlaceholder('例如：0 9 * * *').fill('15 10 * * *')
  await page.getByPlaceholder('例如：analysis、backup、data-import').fill('analysis')
  await page.getByRole('button', { name: '创建定时任务' }).click()
  await expect(page.getByText(scheduleName)).toBeVisible()

  await page.goto('/modules/analysis-workbench/new')
  await expect(page.getByText('分析事项', { exact: true })).toBeVisible()
  await expect(page.getByText('上传分析资料')).toBeVisible()
  await page.getByLabel('分析名称').fill(analysisName)
  await page.getByLabel('描述').fill('Playwright 自动创建的分析任务')
  await page.getByRole('button', { name: '保存分析事项' }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: `purchase_invoices-${suffix}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(`期间,企业名称,纳税人识别号,金额,供应商名称,商品名称\n2026-03,冒烟企业,91310000SMOKE${suffix},120000,供应商A,材料\n`, 'utf-8'),
  })
  await expect(page.getByText(`purchase_invoices-${suffix}.csv`).first()).toBeVisible()
  await page.getByRole('button', { name: '发起分析', exact: true }).click()

  await expect(page).toHaveURL(/\/modules\/analysis-workbench\/results\//)
  await expect(page.getByText('分析结果')).toBeVisible()
  await expect(page.getByText('规则命中明细').first()).toBeVisible()
  const resultTaskId = page.url().split('/').pop()
  await page.goto(`/modules/analysis-workbench/reports/${resultTaskId}`)
  await expect(page.getByText('文书信息确认')).toBeVisible()
  await page.getByLabel('税务机关名称').fill('国家税务总局冒烟税务局')
  await page.getByLabel('文号').fill('冒烟税通〔2026〕001号')

  await page.goto('/modules/dashboard-workbench')
  // Dashboard shows module cards
  await expect(page.getByText('模块统计')).toBeVisible()

  await page.goto('/modules/learning-lab/sets')
  await expect(page.getByText('选择训练集')).toBeVisible()
  await expect(page.getByRole('button', { name: '开始练习' }).first()).toBeVisible()

  await page.goto('/modules/record-operations')
  await expect(page.getByText('快捷操作')).toBeVisible()
  await expect(page.getByRole('button', { name: '查看列表' })).toBeVisible()

  await page.goto('/modules/record-operations/list')
  await expect(page.getByRole('tab', { name: '辅助记录列表' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建对象' })).toBeVisible()

  await page.goto('/modules/risk-ledger')
  await expect(page.getByText('管户记录列表').first()).toBeVisible()
  await expect(page.getByRole('tab', { name: '单户补充' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '批量记录' })).toBeVisible()

  await page.goto('/taxpayer-workbench')
  await expect(page.getByRole('heading', { name: '信息查询' })).toBeVisible()
  await expect(page.getByPlaceholder('输入税号、企业名称、法定代表人或税收管理员')).toBeVisible()

  await page.goto('/my-risk-list')
  await expect(page.getByText('管户记录列表').first()).toBeVisible()

  await page.goto('/modules/info-query')
  await expect(page.getByText('管户分配').first()).toBeVisible()
  // Wait for stats to load
  await page.waitForTimeout(1000)
  await expect(page.getByText('纳税人总数')).toBeVisible({ timeout: 5000 })

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()

  // Help pages
  await page.goto('/help/getting-started')
  await expect(page.getByText('3 分钟上手指南')).toBeVisible()
  await expect(page.getByText('快速开始流程')).toBeVisible()

  await page.goto('/help')
  await expect(page.getByRole('heading', { name: '帮助中心' })).toBeVisible()
  await expect(page.getByText('税务工作路径').first()).toBeVisible()
})
