import { metricCard } from "../components/cards.js";
import { getSystemStatusData } from "../services/systemStatusService.js";

export async function renderSystemStatus() {
  const status = await getSystemStatusData();
  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>系统状态中心</h2>
          <span>行情、新闻、公告、AI、数据库和自动任务运行状态</span>
        </div>
        <span class="notice">更新时间：${status.updatedAt}</span>
      </div>
      <div class="metrics">
        ${[
          { label: "数据库", value: status.database.connected ? "已连接" : "fallback", change: status.database.mode },
          { label: "AI", value: status.ai.status, change: status.ai.provider },
          { label: "自动任务", value: status.scheduler.enabled ? "已启用" : "未启用", change: status.scheduler.timezone },
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
      <div class="section-head"><h2>AI状态</h2><span>API失败时自动fallback</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>运行模式</strong><p>${status.ai.mode}</p></article>
        <article class="data-card"><strong>连接状态</strong><p>${status.ai.connected ? "API连接可用" : "fallback可用"}</p></article>
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
      <div class="section-head"><h2>自动任务</h2><span>08:00早报，20:00复盘，21:00 AI复盘</span></div>
      <div class="detail-grid">
        ${(status.scheduler.tasks ?? []).map((task) => `
          <article class="data-card">
            <strong>${task.time} ${task.name}</strong>
            <p>${task.status}</p>
          </article>
        `).join("") || "<article class='data-card'><strong>暂无任务状态</strong><p>后端 scheduler 状态暂不可用。</p></article>"}
        <article class="data-card"><strong>最近早报</strong><p>${status.scheduler.lastMorningAt ?? "等待执行"}</p></article>
        <article class="data-card"><strong>最近收盘</strong><p>${status.scheduler.lastCloseAt ?? "等待执行"}</p></article>
        <article class="data-card"><strong>最近复盘</strong><p>${status.scheduler.lastReviewAt ?? "等待执行"}</p></article>
        <article class="data-card"><strong>错误</strong><p>${status.scheduler.lastError || "无"}</p></article>
      </div>
    </section>`;
}
