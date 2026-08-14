import { metricCard, opportunityCard, riskCard } from "../components/cards.js";
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
    aiStatus,
    taskStatus,
    riskSignals,
    refreshStatus,
    portfolioSummary,
    updatedAt,
    source,
  } = await getDashboardData();
  const activeWatch = watchlist.filter((stock) => stock.alerts?.length > 0).slice(0, 3);
  const decision = aiSummary.investmentDecision ?? {};
  const rankedSectors = rankSectors(hotSectors).slice(0, 7);

  return `
    <div class="dashboard-grid">
      <section class="wide-section">
        <div class="section-head"><h2>今日重点板块</h2><span>综合涨幅、成交额、资金活跃度和市场热度，最多7个</span></div>
        <div class="card-grid">${rankedSectors.map(enhancedSectorCard).join("")}</div>
      </section>

      <section class="hero-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">今日市场状态</p>
            <h2>${normalizeMarketState(strategy.state, marketSentiment.summary)} · ${marketSentiment.summary}</h2>
          </div>
          <button id="refresh-data-button" type="button">刷新数据</button>
        </div>
        <div class="strategy-grid">
          <div><span>今日市场状态</span><strong>${strategy.state}</strong></div>
          <div><span>市场热度</span><strong>${marketSentiment.heat ?? strategy.score}分</strong></div>
          <div><span>建议仓位</span><strong>${strategy.position}</strong></div>
        </div>
        <p class="ai-summary">${strategy.summary}</p>
        <div class="driver-strip">${strategy.drivers.map((item) => `<span>${item}</span>`).join("")}</div>
        <p id="refresh-message" class="form-message">数据更新时间：${updatedAt ?? refreshStatus.updatedAt}｜来源：${source ?? "行情服务"}｜${refreshStatus.message}</p>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>自选股变化</h2><span>价格、风险、新闻和AI观点</span></div>
        <div class="detail-grid compact">
          ${watchlist.slice(0, 5).map((item) => `
            <article class="data-card">
              <div class="card-head"><strong>${item.name}</strong><span>${item.code} · ${item.changePercent ?? "涨跌待更新"}</span></div>
              <p><b>价格</b>${item.price ?? "数据源未返回"} · <b>AI评级</b>${item.aiRating ?? item.aiLevel ?? "观察"} · <b>风险</b>${item.riskLevel ?? item.riskTips?.[0] ?? "常规跟踪"}</p>
              <p><b>新闻</b>${item.latestNews ?? "暂无强相关新闻，继续观察公告和行情变化。"}</p>
              <p><b>AI观点</b>${item.aiOpinion ?? "等待AI结合行情、新闻和公告继续更新。"}</p>
            </article>
          `).join("") || `<article class="data-card"><strong>暂无自选股</strong><p>进入“我的关注股票”添加观察标的后，这里会显示变化。</p></article>`}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>AI策略建议</h2><span>${aiSummary.source ?? "AI/fallback"}</span></div>
        <div class="detail-grid">
          <article class="data-card"><strong>当前市场判断</strong><p>${decision.marketTrend ?? normalizeMarketState(strategy.state, marketSentiment.summary)}；${decision.shortTerm ?? strategy.summary}</p></article>
          <article class="data-card"><strong>当前股票参与判断</strong><p>${decision.action ?? "等待"}；仓位参考：${positionPercent(decision.positionAdvice ?? strategy.position)}</p></article>
          <article class="data-card"><strong>判断依据</strong>${tagListSafe(extractBasis(aiSummary, rankedSectors, marketSentiment).slice(0, 5))}</article>
          <article class="data-card"><strong>风险因素</strong>${tagListSafe((decision.risks ?? aiSummary.risks ?? []).slice(0, 5))}</article>
          <article class="data-card"><strong>操作思路</strong><p>${aiSummary.stockAdvice ?? "关注主线持续性，等待成交和新闻确认，不追高。"}</p></article>
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>市场概况</h2><span>数据更新时间：${updatedAt ?? refreshStatus.updatedAt}</span></div>
        <div class="metrics">${marketOverview.map(metricCard).join("")}</div>
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
            { label: "AI", value: aiStatus?.connected ? "🟢 真实AI模型" : "🟡 fallback模式", change: aiStatus?.provider ?? aiStatus?.label ?? "AI状态" },
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

function normalizeMarketState(state = "", summary = "") {
  const text = `${state} ${summary}`;
  if (/下跌|走弱|偏弱|回落/.test(text)) return "下跌";
  if (/上涨|走强|偏强|修复/.test(text)) return "上涨";
  return "震荡";
}

function normalizeRiskLevel(value = "") {
  if (/高|较高/.test(value)) return "高";
  if (/低|较低/.test(value)) return "低";
  return "中";
}

function tagListSafe(items = []) {
  const clean = [...new Set(items.filter(Boolean))].slice(0, 5);
  return `<ul class="tag-list">${clean.map((item) => `<li>${item}</li>`).join("") || "<li>暂无</li>"}</ul>`;
}
function normalizeTrend(value = "") {
  if (/上涨|偏强|涓婃定|鍋忓己/.test(value)) return "上涨";
  if (/下跌|偏弱|回避|涓嬭穼|鍋忓急/.test(value)) return "下跌";
  return "震荡";
}

function positionPercent(value = "") {
  if (/半仓|鍗婁粨/.test(value)) return "50%-60%";
  if (/低仓位|浣庝粨/.test(value)) return "20%-30%";
  if (/降低|闄嶄綆/.test(value)) return "0%-20%";
  if (/%/.test(value)) return value;
  return "30%-50%";
}

function rankSectors(sectors = []) {
  return [...sectors].map((sector) => {
    const changeScore = parseNumber(sector.changePercent ?? sector.change ?? sector.status) * 2;
    const amountScore = /亿/.test(String(sector.amount ?? sector.turnover ?? sector.flow ?? "")) ? 18 : /万/.test(String(sector.amount ?? sector.turnover ?? sector.flow ?? "")) ? 10 : 6;
    const activityScore = /流入|活跃|强|上涨|领涨|修复/.test(`${sector.status ?? ""}${sector.reason ?? ""}${sector.flow ?? ""}`) ? 18 : 10;
    const heatScore = parseNumber(sector.heat ?? sector.score ?? sector.rank) || 10;
    return { ...sector, compositeScore: Math.round(changeScore + amountScore + activityScore + Math.min(20, heatScore)) };
  }).sort((a, b) => b.compositeScore - a.compositeScore);
}

function enhancedSectorCard(sector) {
  return `
    <article class="data-card sector-card">
      <div class="card-head"><strong>${sector.name}</strong><span>综合${sector.compositeScore ?? "--"}分</span></div>
      <p><b>市场表现</b>${sector.status ?? sector.changePercent ?? "活跃度待确认"}</p>
      <p><b>成交/资金</b>${sector.amount ?? sector.flow ?? sector.turnover ?? "成交和资金由行情源补充"}</p>
      <p><b>关注原因</b>${sector.reason ?? "结合涨幅、成交额、资金活跃度和市场热度筛选"}</p>
      <p><b>风险</b>${sector.risk ?? "短线热度过高时需防止回落"}</p>
    </article>`;
}

function extractBasis(aiSummary = {}, sectors = [], sentiment = {}) {
  const evidence = aiSummary.evidence ?? aiSummary.conclusionBasis ?? {};
  return [
    `行业趋势：${sectors.slice(0, 3).map((item) => item.name).join("、") || "热点方向待确认"}`,
    `市场环境：${sentiment.summary ?? "市场情绪待更新"}，上涨${sentiment.upCount ?? "?"}家/下跌${sentiment.downCount ?? "?"}家`,
    ...flattenEvidence(evidence).slice(0, 3),
  ].filter(Boolean);
}

function flattenEvidence(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenEvidence);
  return value ? [String(value)] : [];
}

function parseNumber(value) {
  const match = String(value ?? "").replace("+", "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
