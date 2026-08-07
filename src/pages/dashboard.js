import { metricCard, opportunityCard, riskCard, sectorCard } from "../components/cards.js";
import { newsList } from "../components/lists.js";
import { getDashboardData, refreshWorkbenchData } from "../services/mockService.js";

export async function renderDashboard() {
  const {
    strategy,
    marketOverview,
    marketSentiment,
    hotSectors,
    opportunities,
    news,
    importantNews,
    riskAlerts,
    watchlist,
    aiSummary,
    taskStatus,
    riskSignals,
    refreshStatus,
    updatedAt,
    source,
  } = await getDashboardData();
  const activeWatch = watchlist.filter((stock) => stock.alerts?.length > 0).slice(0, 3);

  return `
    <div class="dashboard-grid">
      <section class="hero-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">今日策略</p>
            <h2>每天 10 分钟研究 A 股</h2>
          </div>
          <button id="refresh-data-button" type="button">刷新数据</button>
        </div>
        <div class="strategy-grid">
          <div><span>今日市场状态</span><strong>${strategy.state}</strong></div>
          <div><span>AI综合评分</span><strong>${strategy.score}分</strong></div>
          <div><span>建议仓位</span><strong>${strategy.position}</strong></div>
        </div>
        <p class="ai-summary">${strategy.summary}</p>
        <div class="driver-strip">${strategy.drivers.map((item) => `<span>${item}</span>`).join("")}</div>
        <p id="refresh-message" class="form-message">数据更新时间：${updatedAt ?? refreshStatus.updatedAt}｜来源：${source ?? "行情服务"}｜${refreshStatus.message}</p>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>市场概况</h2><span>数据更新时间：${updatedAt ?? refreshStatus.updatedAt}</span></div>
        <div class="metrics">${marketOverview.map(metricCard).join("")}</div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>市场情绪</h2><span>${marketSentiment.summary}</span></div>
        <div class="metrics">
          ${[
            { label: "市场热度", value: `${marketSentiment.heat}分`, change: "实时" },
            { label: "多空情绪", value: marketSentiment.longShort, change: "情绪" },
            { label: "上涨/下跌", value: `${marketSentiment.upCount}/${marketSentiment.downCount}`, change: marketSentiment.riskLevel },
          ].map(metricCard).join("")}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>AI市场总结</h2><span>自动分析生成</span></div>
        <p class="answer">${aiSummary.summary}</p>
        <div class="detail-grid">
          <article class="data-card"><strong>关注方向</strong><p>${aiSummary.opportunities.join("、")}</p></article>
          <article class="data-card"><strong>风险提醒</strong><p>${aiSummary.risks.join("；")}</p></article>
          <article class="data-card"><strong>研究建议</strong><p>${aiSummary.stockAdvice}</p></article>
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>今日AI任务状态</h2><span>本地调度框架</span></div>
        <div class="metrics">
          ${[
            { label: "行情已更新", value: refreshStatus.marketOk ? "是" : "待刷新", change: refreshStatus.marketOk ? "✓" : "待执行" },
            { label: "新闻已获取", value: refreshStatus.newsOk ? "是" : "待刷新", change: refreshStatus.newsOk ? "✓" : "待执行" },
            { label: "报告已生成", value: taskStatus.reportGenerated ? "是" : "待生成", change: taskStatus.lastRunAt },
          ].map(metricCard).join("")}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>数据来源状态</h2><span>可信程度提示</span></div>
        <div class="metrics">
          ${[
            { label: "行情", value: source?.includes("模拟") ? "🟡 部分回退" : "🟢 东方财富真实数据", change: updatedAt ?? refreshStatus.updatedAt },
            { label: "新闻", value: refreshStatus.newsOk ? "🟢 东方财富公告/快讯" : "🟡 备用新闻", change: refreshStatus.updatedAt },
            { label: "AI", value: "🟡 fallback模式", change: "可在设置中切API" },
          ].map(metricCard).join("")}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>风险追踪</h2><span>riskService 自动识别</span></div>
        <div class="card-grid">
          ${riskSignals.slice(0, 3).map((item) => `
            <article class="data-card">
              <div class="card-head"><strong>${item.type}</strong><span>${item.level}</span></div>
              <p>${item.message}</p>
              <small>${item.target}</small>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>今日重要新闻摘要</h2><span>新闻更新时间：${refreshStatus.updatedAt}</span></div>
        <div class="card-grid">
          ${importantNews.map((item) => `
            <article class="data-card">
              <div class="card-head"><strong>${item.category}</strong><span>${item.impact}</span></div>
              <p>${item.title}</p>
              <small>${item.source}｜${item.time}</small>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>热点板块</h2><span>关注状态、原因和风险</span></div>
        <div class="card-grid">${hotSectors.map(sectorCard).join("")}</div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>自选股提醒摘要</h2><span>行情和新闻变化</span></div>
        <div class="card-grid">
          ${activeWatch.map((stock) => `
            <article class="data-card">
              <div class="card-head"><strong>${stock.name}</strong><span>${stock.code}</span></div>
              ${(stock.alerts ?? []).map((alert) => `<p>${alert}</p>`).join("")}
            </article>
          `).join("")}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>AI研究机会</h2><span>仅作研究观察，不构成投资建议</span></div>
        <div class="card-grid">${opportunities.slice(0, 3).map(opportunityCard).join("")}</div>
      </section>

      <section class="split-section">
        <div class="wide-section flat">
          <div class="section-head"><h2>新闻速览</h2></div>
          ${newsList(news)}
        </div>
        <div class="wide-section flat">
          <div class="section-head"><h2>风险提醒</h2><span>${strategy.risk}</span></div>
          ${riskAlerts.map(riskCard).join("")}
        </div>
      </section>
    </div>`;
}

export function mountDashboard({ rerender }) {
  const button = document.querySelector("#refresh-data-button");
  const message = document.querySelector("#refresh-message");
  button?.addEventListener("click", async () => {
    if (message) message.textContent = "正在刷新行情、股票、新闻和AI分析...";
    await refreshWorkbenchData();
    rerender();
  });
}
