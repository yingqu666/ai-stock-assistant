# AI投资研究助手生产部署说明

## 部署目标

- 前端：Vercel 静态 PWA
- 后端：Railway 或 Render Node.js Express 服务
- 数据库：Supabase PostgreSQL
- 自动任务：后端常驻运行，08:00 / 20:00 / 21:00 自动执行

## 1. 后端部署：Railway 或 Render

启动命令：

```bash
npm run server
```

健康检查：

```text
GET /api/health
```

数据库检查：

```text
GET /api/db-status
```

生产环境变量：

```bash
NODE_ENV=production
PORT=8787
TZ=Asia/Shanghai
CORS_ORIGIN=https://your-vercel-domain.vercel.app

DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
DATABASE_SSL=true
DATABASE_CONNECTION_TIMEOUT_MS=8000

JWT_SECRET=replace-with-a-long-random-secret

AI_MODE=fallback
AI_PROVIDER=openai-compatible
AI_API_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4.1-mini
AI_API_KEY=

SMS_PROVIDER=mock
SMS_MOCK_CODE=888888

ENABLE_SCHEDULER=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
```

DeepSeek 示例：

```bash
AI_MODE=api
AI_PROVIDER=deepseek
AI_API_ENDPOINT=https://api.deepseek.com/chat/completions
AI_MODEL=deepseek-chat
AI_API_KEY=replace-with-real-key
```

通义千问示例：

```bash
AI_MODE=api
AI_PROVIDER=qwen
AI_API_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
AI_MODEL=qwen-plus
AI_API_KEY=replace-with-real-key
```

## 2. 前端部署：Vercel

Vercel 设置：

- Framework Preset: Other
- Build Command: 留空
- Output Directory: `.`
- Root Directory: 项目根目录

前端生产 API 地址：

将根目录 `config.js` 中的线上默认地址改为后端公网地址：

```js
window.__AI_INVESTMENT_API_BASE__ = "https://your-backend-domain.com/api";
```

也可以参考：

```text
config.production.example.js
```

PWA 文件：

- `manifest.json`
- `sw.js`
- `index.html`
- `config.js`
- `src/`

## 3. Supabase PostgreSQL

后端启动时会自动执行：

```text
server/db/schema.sql
```

预期数据表：

- `users`
- `watchlists`
- `portfolio`
- `reports`
- `settings`
- `ai_history`
- `ai_feedback`
- `knowledge`
- `investment_journal`

验收标准：

```json
{
  "mode": "postgres",
  "connected": true
}
```

## 4. 自动任务

`ENABLE_SCHEDULER=true` 时启用：

- 08:00 生成早盘报告
- 20:00 生成收盘复盘
- 21:00 执行 AI 判断复盘

状态接口：

```text
GET /api/scheduler/status
```

手动触发：

```text
POST /api/scheduler/run/morning
POST /api/scheduler/run/close
POST /api/scheduler/run/review
```

早盘和收盘任务采用后台执行，接口会先返回 `accepted=true`，避免页面等待长任务。

## 5. 上线验收流程

1. 打开后端 `/api/health`，确认服务在线。
2. 打开 `/api/db-status`，确认 `mode=postgres`。
3. 手机号验证码登录。
4. 添加自选股，刷新后确认数据仍存在。
5. 修改系统设置，刷新后确认同步。
6. 生成 AI 日报。
7. 测试 AI 问答。
8. 手动触发早盘、收盘、AI复盘任务。
9. 手机浏览器打开前端地址，确认 PWA 可添加到桌面。

## 6. 安全检查

- 不要提交 `.env`。
- `JWT_SECRET` 使用长随机字符串。
- `CORS_ORIGIN` 只允许正式前端域名。
- `AI_API_KEY` 只放在后端环境变量。
- Supabase 开启备份。
- 生产日志不要输出密钥。
