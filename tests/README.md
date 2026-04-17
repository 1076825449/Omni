# Omni 平台测试

## 运行方式

### 后端测试（pytest）
```bash
cd backend
pip install pytest httpx
pytest ../tests/backend/ -v
```

### 前端测试（Playwright）
```bash
cd frontend
npm install
npx playwright install --with-deps chromium
npx playwright test ../tests/frontend/
```

## 测试说明

- `backend/` — API 冒烟测试（登录/任务/文件/搜索）
- `frontend/` — 页面冒烟测试（登录/首页/模块跳转）

## 通过标准

- 后端：至少 5 个测试通过
- 前端：至少 3 个页面测试通过
