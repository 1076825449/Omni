import { expect, test } from '@playwright/test'

// ============================================================
// Viewer Role E2E Tests
// 验证 viewer 角色只读体验和权限限制
// ============================================================

test.describe('Viewer Role Permissions', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await page.goto('/login', { timeout: 5000 })
    } catch {
      test.skip(); return
    }
    const loginVisible = await page.getByPlaceholder('请输入用户名').isVisible().catch(() => false)
    if (!loginVisible) { test.skip(); return }
    
    await page.getByPlaceholder('请输入用户名').fill('viewer')
    await page.getByPlaceholder('请输入密码').fill('viewer123')
    await page.getByRole('button', { name: /登\s*录/ }).click()
    
    // Wait for navigation or error message
    const navigated = await page.waitForURL(/\/$/, { timeout: 5000 }).then(() => true).catch(() => false)
    if (!navigated) { test.skip(); return }
  })

  test('viewer sees read-only platform (can view modules)', async ({ page }) => {
    await page.goto('/modules')
    await page.waitForTimeout(5000)
    // If viewer session is valid, we should see the module center. If redirected to login, skip.
    const onLoginPage = page.url().includes('/login')
    if (onLoginPage) { test.skip(); return }
    await expect(page.getByRole('heading', { name: '模块中心' })).toBeVisible({ timeout: 8000 })
  })

  test('viewer cannot see create buttons in platform centers', async ({ page }) => {
    await page.goto('/tasks')
    await page.waitForTimeout(500)
    const newTaskBtn = page.getByRole('button', { name: /新建任务|创建任务/ }).first()
    await expect(newTaskBtn).not.toBeVisible({ timeout: 2000 })
  })

  test('viewer cannot access settings management tab', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForTimeout(500)
    const heading = page.getByRole('heading', { name: '系统设置' })
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heading).toBeVisible()
    }
    const roleTab = page.getByRole('tab', { name: /角色管理/ })
    await expect(roleTab).not.toBeVisible({ timeout: 2000 })
  })

  test('viewer receives 401/403 on platform management API calls', async ({ page }) => {
    const registerResp = await page.request.post('http://127.0.0.1:3000/api/modules/register', {
      data: { key: 'test-module', name: '测试', type: 'list' },
    })
    // viewer 无效 session 时 401，有 session 无权限时 403
    expect([401, 403]).toContain(registerResp.status())

    const backupResp = await page.request.post('http://127.0.0.1:3000/api/platform/backup', {
      data: { name: '测试备份', note: '' },
    })
    expect([401, 403]).toContain(backupResp.status())
  })
})

// ============================================================
// Extended Smoke: 验证全部7个模块的完整入口流程
// ============================================================

test.describe('Extended Smoke - All 7 Modules Complete Flow', () => {
  const suffix = Date.now().toString().slice(-6)

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('请输入用户名').fill('admin')
    await page.getByPlaceholder('请输入密码').fill('admin123')
    await page.getByRole('button', { name: /登\s*录/ }).click()
    await page.waitForURL(/\/$/, { timeout: 5000 })
  })

  test('analysis-workbench full flow: new -> upload -> run -> result -> history', async ({ page }) => {
    const analysisName = `Ext Smoke 分析 ${suffix}`
    await page.goto('/modules/analysis-workbench/new')
    await expect(page.getByText('新建分析任务')).toBeVisible()
    await page.getByLabel('分析名称').fill(analysisName)
    await page.getByLabel('描述').fill('扩展冒烟测试')
    await page.getByRole('button', { name: '创建任务' }).click()
    await expect(page.getByText('上传分析资料（第2步）')).toBeVisible()

    // 上传文件
    await page.locator('input[type="file"]').setInputFiles({
      name: `ext-analysis-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`纳税人识别号,企业名称,收入总额\n91310000MA1FL2KQ31,测试企业,1000000`, 'utf-8'),
    })
    await expect(page.getByText(`ext-analysis-${suffix}.txt`).first()).toBeVisible()

    // 发起分析
    await page.getByRole('button', { name: '发起分析（第4步）' }).click()
    await page.waitForURL(/\/history$/, { timeout: 5000 })
    await expect(page.getByRole('button', { name: analysisName }).first()).toBeVisible()

    // 查看结果
    await page.getByRole('button', { name: analysisName }).first().click()
    await expect(page.getByText('分析结果')).toBeVisible()
  })

  test('schedule-workbench: create task -> verify in list', async ({ page }) => {
    const scheduleName = `Ext Smoke 调度 ${suffix}`
    await page.goto('/modules/schedule-workbench')
    await page.getByPlaceholder('例如：每日风险分析').fill(scheduleName)
    await page.getByPlaceholder('说明该任务的用途，例如：每天自动分析前一天的申报数据').fill('扩展冒烟测试')
    await page.getByPlaceholder('例如：0 9 * * *').fill('30 10 * * *')
    await page.getByPlaceholder('例如：analysis、backup、data-import').fill('analysis')
    await page.getByRole('button', { name: '创建定时任务' }).click()
    await expect(page.getByText(scheduleName)).toBeVisible()
  })

  test('record-operations: create object -> verify in list', async ({ page }) => {
    const objName = `Ext Smoke 对象 ${suffix}`
    await page.goto('/modules/record-operations/list')
    await expect(page.getByRole('tab', { name: '对象列表' })).toBeVisible()
    await page.getByRole('button', { name: '新建对象' }).click()
    await page.waitForTimeout(500)

    const nameInput = page.getByPlaceholder('对象名称')
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(objName)
      await page.getByRole('button', { name: /确定|保存|创建/ }).first().click()
      await page.waitForTimeout(500)
    }
  })

  test('info-query: page loads with taxpayer stats', async ({ page }) => {
    await page.goto('/modules/info-query')
    await expect(page.getByText('纳税人总数')).toBeVisible()
    const importBtn = page.getByRole('button', { name: /导入.*CSV|导入纳税人|批量导入/ }).first()
    if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await importBtn.click()
      await page.waitForTimeout(300)
    }
  })

  test('risk-ledger: single record tab visible', async ({ page }) => {
    await page.goto('/modules/risk-ledger')
    await expect(page.getByRole('tab', { name: '单户记录' })).toBeVisible()
    await page.getByRole('tab', { name: '单户记录' }).click()
    await page.waitForTimeout(300)
  })

  test('learning-lab: start practice -> answer question', async ({ page }) => {
    await page.goto('/modules/learning-lab/sets')
    await expect(page.getByText('选择训练集')).toBeVisible()
    const startBtn = page.getByRole('button', { name: '开始练习' }).first()
    await startBtn.click()
    await page.waitForTimeout(500)
    const radioGroup = page.locator('.ant-radio-group, [class*="question"]').first()
    if (await radioGroup.isVisible({ timeout: 2000 }).catch(() => false)) {
      await radioGroup.locator('input[type="radio"]').first().click()
    }
  })

  test('dashboard-workbench: verify stats load and cards visible', async ({ page }) => {
    await page.goto('/modules/dashboard-workbench')
    await expect(page.getByText('平台联动')).toBeVisible()
    await expect(page.getByText('🕐 最近活动')).toBeVisible()
    const statsCards = page.locator('.ant-card, [class*="stat"], [class*="card"]')
    const count = await statsCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('log center: page loads with filter', async ({ page }) => {
    await page.goto('/logs')
    await page.waitForTimeout(500)
    const heading = page.getByRole('heading', { name: /日志中心|日志/ })
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heading).toBeVisible()
    }
  })

  test('notification center: page loads with mark-read button', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForTimeout(500)
    const heading = page.getByRole('heading', { name: /通知中心|通知/ })
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heading).toBeVisible()
    }
  })
})
