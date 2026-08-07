# Backend Interface Draft

当前项目仍然是浏览器本地运行。`src/backend/` 只定义未来后端边界，后续可以迁移到 Node.js + PostgreSQL。

## API Boundaries

- `userApi.js`: 用户、登录态、投资档案
- `reportApi.js`: AI日报、报告中心、复盘历史
- `stockApi.js`: 股票查询、自选股、持仓关联行情
- `settingsApi.js`: 数据刷新频率、AI配置、风险偏好

## Database Tables

### users

- `id`
- `phone`
- `created_time`

### watchlist

- `id`
- `user_id`
- `stock_code`
- `stock_name`
- `reason`
- `ai_level`
- `created_time`

### portfolio

- `id`
- `user_id`
- `stock_code`
- `stock_name`
- `cost_price`
- `quantity`
- `created_time`

### reports

- `id`
- `user_id`
- `date`
- `type`
- `score`
- `content`
- `source_data`
- `created_time`

### settings

- `id`
- `user_id`
- `refresh_interval`
- `industries`
- `risk_level`
- `ai_mode`
- `updated_time`
