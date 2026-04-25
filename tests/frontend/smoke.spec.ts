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
  await expect(page.getByText('欢迎回来')).toBeVisible()

  await page.goto('/modules')
  await expect(page.getByRole('heading', { name: '模块中心' })).toBeVisible()
  await expect(page.getByText('分析工作模块')).toBeVisible()

  await page.goto('/modules/schedule-workbench')
  await expect(page.getByText('创建定时任务')).toBeVisible()
  await page.getByPlaceholder('例如：每日分析同步').fill(scheduleName)
  await page.getByPlaceholder('说明该任务的用途').fill('Playwright 自动创建的调度任务')
  await page.getByPlaceholder('例如：0 9 * * *').fill('15 10 * * *')
  await page.getByPlaceholder('例如：analysis / backup').fill('analysis')
  await page.getByRole('button', { name: '创建任务' }).click()
  await expect(page.getByText(scheduleName)).toBeVisible()

  await page.goto('/modules/analysis-workbench/new')
  await expect(page.getByText('新建分析任务')).toBeVisible()
  await page.getByLabel('分析名称').fill(analysisName)
  await page.getByLabel('描述').fill('Playwright 自动创建的分析任务')
  await page.getByRole('button', { name: '创建任务' }).click()
  await expect(page.getByText('当前任务 ID：')).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles({
    name: `smoke-analysis-${suffix}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from(`smoke analysis payload ${suffix}`, 'utf-8'),
  })
  await expect(page.getByText(`smoke-analysis-${suffix}.txt`).first()).toBeVisible()
  await page.getByRole('button', { name: '发起分析' }).click()

  await expect(page).toHaveURL(/\/modules\/analysis-workbench\/history$/)
  await expect(page.getByRole('button', { name: analysisName }).first()).toBeVisible()
  await page.getByRole('button', { name: analysisName }).first().click()
  await expect(page.getByText('分析结果')).toBeVisible()

  await page.goto('/modules/dashboard-workbench')
  await expect(page.getByText('平台联动')).toBeVisible()
  await expect(page.getByText('🕐 最近活动')).toBeVisible()

  await page.goto('/modules/learning-lab/sets')
  await expect(page.getByText('选择训练集')).toBeVisible()
  await expect(page.getByRole('button', { name: '开始练习' }).first()).toBeVisible()

  await page.goto('/modules/record-operations')
  await expect(page.getByText('快捷操作')).toBeVisible()
  await expect(page.getByRole('button', { name: '查看列表' })).toBeVisible()

  await page.goto('/modules/record-operations/list')
  await expect(page.getByRole('tab', { name: '对象列表' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建对象' })).toBeVisible()

  await page.goto('/modules/risk-ledger')
  await expect(page.getByText('风险记录台账').first()).toBeVisible()
  await expect(page.getByRole('tab', { name: '单户记录' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '批量记录' })).toBeVisible()

  await page.goto('/modules/info-query')
  await expect(page.getByText('信息查询表').first()).toBeVisible()
  await expect(page.getByText('纳税人总数')).toBeVisible()
  await expect(page.getByRole('heading', { name: '信息查询' })).toBeVisible()

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()
})
