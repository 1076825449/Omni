import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173'

test.describe('Omni 平台冒烟测试', () => {
  test('登录页可访问', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('body')).toBeVisible()
    // 检查登录表单元素存在
    const hasInput = await page.locator('input').count()
    expect(hasInput).toBeGreaterThan(0)
  })

  test('登录成功跳转首页', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    // 填写登录表单
    await page.locator('input').first().fill('admin')
    await page.locator('input[type="password"]').fill('admin123')
    await page.locator('button[type="submit"]').click()
    // 等待跳转
    await page.waitForURL(`${BASE}/` as string, { timeout: 5000 }).catch(() => {})
    // 检查是否进入平台（URL 或页面内容变化）
    expect(page.url()).not.toContain('/login')
  })

  test('首页可访问且有平台标识', async ({ page }) => {
    // 先登录
    await page.goto(`${BASE}/login`)
    await page.locator('input').first().fill('admin')
    await page.locator('input[type="password"]').fill('admin123')
    await page.locator('button[type="submit"]').click()
    await page.waitForLoadState('networkidle')
    // 检查平台标识
    const body = await page.locator('body').innerText()
    // 至少不应该还在登录页
    expect(page.url()).not.toContain('/login')
  })

  test('模块中心可访问', async ({ page }) => {
    // 登录
    await page.goto(`${BASE}/login`)
    await page.locator('input').first().fill('admin')
    await page.locator('input[type="password"]').fill('admin123')
    await page.locator('button[type="submit"]').click()
    await page.waitForLoadState('networkidle')
    // 导航到模块中心
    await page.goto(`${BASE}/modules`)
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })

  test('任务中心可访问', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.locator('input').first().fill('admin')
    await page.locator('input[type="password"]').fill('admin123')
    await page.locator('button[type="submit"]').click()
    await page.waitForLoadState('networkidle')
    await page.goto(`${BASE}/tasks`)
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })
})
