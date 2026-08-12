import { metricCard } from "../components/cards.js";
import { getSystemStatusData } from "../services/systemStatusService.js";

export async function renderSystemStatus() {
  const status = await getSystemStatusData();
  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>系统状态中心</h2>
          <span>行情、股票、新闻、公告、AI和数据库运行状态</span>
        </div>
        <span class="notice">更新时间：${status.updatedAt}</span>
      </div>
      <div class="metrics">
        ${[
          { label: "数据库", value: status.database.connected ? "已连接" : "fallback", change: status.database.mode },
          { label: "AI", value: status.ai.status, change: status.ai.provider },
          { label: "AI日报", value: "手动生成", change: "用户点击生成" },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>数据接口状态</h2><span>真实、部分真实和fallback明确标记</span></div>
      <div class="detail-grid">
        ${status.dataSources.map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.name}</strong><span>${item.status}</span></div>
            <p>${item.detail}</p>
            <small>${item.source} | ${item.updatedAt}</small>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI状态</h2><span>来自后端 /api/ai/status，API失败时自动fallback</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>AI Provider</strong><p>${status.ai.provider}</p></article>
        <article class="data-card"><strong>AI Key</strong><p>${status.ai.keyStatus}</p></article>
        <article class="data-card"><strong>AI Mode</strong><p>${status.ai.aiMode}</p></article>
        <article class="data-card"><strong>模型</strong><p>${status.ai.provider === "deepseek" ? "DeepSeek" : (status.ai.model || "未配置")}</p></article>
        <article class="data-card"><strong>投资判断</strong><p>已启用</p></article>
        <article class="data-card"><strong>连接状态</strong><p>${status.ai.connected ? "真实AI可用" : "fallback可用"}</p></article>
        <article class="data-card"><strong>接口配置</strong><p>${status.ai.endpointConfigured ? "已配置" : "未配置"}</p></article>
        <article class="data-card"><strong>说明</strong><p>${status.ai.message}</p></article>
        <article class="data-card"><strong>最近调用</strong><p>${status.ai.updatedAt}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>数据库状态</h2><span>Supabase PostgreSQL / memory fallback</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>模式</strong><p>${status.database.mode}</p></article>
        <article class="data-card"><strong>连接</strong><p>${status.database.connected ? "正常" : "未连接，使用fallback"}</p></article>
        <article class="data-card"><strong>表</strong><p>${(status.database.tables ?? []).join("、") || "暂无"}</p></article>
        <article class="data-card"><strong>错误</strong><p>${status.database.error || "无"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI日报模式</h2><span>固定时间自动任务默认关闭，改为用户主动生成</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>运行方式</strong><p>手动生成今日AI日报</p></article>
        <article class="data-card"><strong>生成入口</strong><p>AI日报页面的“生成今日报告”按钮</p></article>
        <article class="data-card"><strong>数据输入</strong><p>行情、新闻、自选股、持仓、投资档案</p></article>
        <article class="data-card"><strong>自动任务</strong><p>${status.scheduler.enabled ? "已通过环境变量启用" : "默认关闭"}</p></article>
        <article class="data-card"><strong>错误</strong><p>${status.scheduler.lastError || "无"}</p></article>
      </div>
    </section>`;
}
