import { metricCard, opportunityCard, riskCard } from "../components/cards.js";
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
  const rankedSectors = rankSectors(hotSectors).slice(0, 12);
  const marketStats = buildMarketStats(marketOverview, marketSentiment);
  const marketNews = mergeMarketNews(importantNews, news).slice(0, 8);

  return `
    <div class="dashboard-grid">
      <section class="wide-section">
        <div class="section-head"><h2>全市场热点板块</h2><span>综合涨跌幅、成交金额、资金活跃度和市场热度，TOP12</span></div>
        <div class="card-grid">${rankedSectors.map(enhancedSectorCard).join("") || missingSectorCard(source)}</div>
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
          <div><span>当前市场</span><strong>${marketStats.state}</strong></div>
          <div><span>赚钱效应</span><strong>${marketStats.moneyEffect}</strong></div>
          <div><span>成交情况</span><strong>${marketStats.turnover}</strong></div>
        </div>
        <div class="metrics market-snapshot">
          ${[
            { label: "上证指数", value: marketStats.shanghai, change: marketStats.shanghaiChange },
            { label: "深证指数", value: marketStats.shenzhen, change: marketStats.shenzhenChange },
            { label: "创业板指", value: marketStats.chinext, change: marketStats.chinextChange },
            { label: "上涨数量", value: marketStats.upCount, change: "市场广度" },
            { label: "下跌数量", value: marketStats.downCount, change: marketSentiment.riskLevel ?? "风险" },
            { label: "平盘数量", value: marketStats.flatCount, change: "中性" },
            { label: "涨停数量", value: marketStats.limitUpCount, change: "情绪强度" },
            { label: "跌停数量", value: marketStats.limitDownCount, change: "风险温度" },
          ].map(metricCard).join("")}
        </div>
        <p class="answer"><b>AI总结：</b>${marketStateReason(strategy, marketSentiment, marketOverview)}</p>
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
        <div class="section-head"><h2>AI投资经理</h2><span>${aiSummary.source ?? "AI/fallback"} · 只给仓位参考，不直接买卖股票</span></div>
        <p class="answer"><b>AI核心结论：</b>${buildManagerConclusion(decision, strategy, marketStats, rankedSectors, marketNews)}</p>
        <div class="detail-grid">
          <article class="data-card"><strong>市场状态判断</strong><p>${marketStats.state}；${decision.shortTerm ?? strategy.summary}</p></article>
          <article class="data-card"><strong>仓位参考</strong><p>${positionPercent(decision.positionAdvice ?? strategy.position)}。仅作为风险暴露参考，不代表买卖指令。</p></article>
          <article class="data-card"><strong>判断依据</strong>${tagListSafe(extractBasis(aiSummary, rankedSectors, marketSentiment, marketStats, marketNews).slice(0, 8))}</article>
          <article class="data-card"><strong>风险因素</strong>${tagListSafe((decision.risks ?? aiSummary.risks ?? []).slice(0, 5))}</article>
          <article class="data-card"><strong>操作思路</strong><p>${buildOperationPlan(decision, aiSummary, marketStats)}</p></article>
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
        <div class="section-head"><h2>市场新闻AI解读</h2><span>新闻更新时间：${refreshStatus.updatedAt}</span></div>
        <div class="card-grid">
          ${marketNews.map(newsInsightCard).join("") || missingNewsCard(refreshStatus.updatedAt)}
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

function tagListSafe(items = []) {
  const clean = [...new Set(items.filter(Boolean))].slice(0, 5);
  return `<ul class="tag-list">${clean.map((item) => `<li>${item}</li>`).join("") || "<li>暂无</li>"}</ul>`;
}
function positionPercent(value = "") {
  if (/半仓/.test(value)) return "50%-60%";
  if (/低仓位/.test(value)) return "20%-30%";
  if (/降低/.test(value)) return "0%-20%";
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
      <div class="card-head"><strong>${sector.name}</strong><span>${sector.changePercent ?? sector.change ?? sector.status ?? "表现待更新"}</span></div>
      <p><b>涨跌幅</b>${sector.changePercent ?? sector.change ?? "数据源未返回"}</p>
      <p><b>资金表现</b>${sector.flow ?? sector.amount ?? sector.turnover ?? "资金数据待更新"}</p>
      <p><b>热度依据</b>${sector.heatBasis ?? sector.reason ?? "结合涨跌幅、成交额、资金活跃度和市场热度筛选"}</p>
      <p><b>AI分析原因</b>${sector.aiReason ?? sector.reason ?? "数据不足时不生成确定原因，等待行情源补充。"}</p>
      <p><b>持续性</b>${sector.sustainability ?? sectorSustainability(sector)}</p>
      <p><b>风险</b>${sector.risk ?? "短线热度过高时需防止回落"}</p>
    </article>`;
}

function missingSectorCard(source) {
  return `
    <article class="data-card sector-card">
      <div class="card-head"><strong>热点板块数据不足</strong><span>数据缺失</span></div>
      <p><b>涨跌幅</b>真实板块行情未返回</p>
      <p><b>资金表现</b>资金字段缺失</p>
      <p><b>热度依据</b>${source ?? "行情接口"} 暂未返回TOP12板块数据</p>
      <p><b>AI分析原因</b>数据不足，不生成虚假热点原因。</p>
      <p><b>持续性</b>无法判断</p>
      <p><b>风险</b>缺少板块真实行情时，不应据此做交易判断。</p>
    </article>`;
}

function marketStateReason(strategy = {}, sentiment = {}, overview = []) {
  const state = normalizeMarketState(strategy.state, sentiment.summary);
  const amount = overview.find((item) => /成交|金额|成交额/.test(String(item.label ?? "")))?.value ?? "成交数据待更新";
  const breadth = `上涨${sentiment.upCount ?? "?"}家、下跌${sentiment.downCount ?? "?"}家`;
  if (state === "上涨") return `当前市场偏强，主要依据是${breadth}，成交情况为${amount}，热点板块活跃度较高。`;
  if (state === "下跌") return `当前市场偏弱，主要依据是${breadth}，成交情况为${amount}，需优先控制回撤和追高风险。`;
  return `当前市场震荡，主要依据是${breadth}，成交情况为${amount}，适合精选方向而不是扩大交易频率。`;
}

function sectorSustainability(sector = {}) {
  const text = `${sector.status ?? ""}${sector.reason ?? ""}${sector.flow ?? ""}${sector.amount ?? ""}`;
  if (/流入|放量|强|领涨|活跃/.test(text)) return "持续性偏强，但需要继续观察成交额和龙头股反馈。";
  if (/缩量|分化|回落|冲高/.test(text)) return "持续性一般，容易出现轮动和冲高回落。";
  return "持续性待确认，需要结合成交额、资金活跃度和后续新闻验证。";
}

function buildMarketStats(overview = [], sentiment = {}) {
  const findMetric = (...keys) => overview.find((item) => {
    const label = String(item.label ?? item.name ?? "");
    return keys.some((key) => label.includes(key));
  }) ?? {};
  const up = Number(sentiment.upCount ?? 0);
  const down = Number(sentiment.downCount ?? 0);
  const total = Number(sentiment.totalCount ?? sentiment.total ?? 0);
  const flat = sentiment.flatCount ?? sentiment.unchangedCount ?? (total > up + down ? total - up - down : "数据源未返回");
  const limitUp = sentiment.limitUpCount ?? sentiment.upLimitCount ?? "数据源未返回";
  const limitDown = sentiment.limitDownCount ?? sentiment.downLimitCount ?? "数据源未返回";
  const turnoverMetric = findMetric("成交", "成交额", "成交金额");
  const shanghai = findMetric("上证");
  const shenzhen = findMetric("深证", "深成");
  const chinext = findMetric("创业");

  return {
    state: normalizeMarketState(sentiment.state, sentiment.summary),
    shanghai: shanghai.value ?? "数据源未返回",
    shanghaiChange: shanghai.change ?? "",
    shenzhen: shenzhen.value ?? "数据源未返回",
    shenzhenChange: shenzhen.change ?? "",
    chinext: chinext.value ?? "数据源未返回",
    chinextChange: chinext.change ?? "",
    upCount: sentiment.upCount ?? "数据源未返回",
    downCount: sentiment.downCount ?? "数据源未返回",
    flatCount: flat,
    limitUpCount: limitUp,
    limitDownCount: limitDown,
    turnover: turnoverMetric.value ?? "成交数据待更新",
    moneyEffect: sentiment.moneyEffect ?? moneyEffectLabel(up, down, limitUp, limitDown),
    moneyEffectBasis: sentiment.moneyEffectBasis ?? "依据上涨比例、成交活跃度和热点集中程度判断。",
  };
}

function moneyEffectLabel(up, down, limitUp, limitDown) {
  const safeUp = Number(up || 0);
  const safeDown = Number(down || 0);
  const safeLimitUp = Number(limitUp || 0);
  const safeLimitDown = Number(limitDown || 0);
  if (!safeUp && !safeDown) return "数据源未返回";
  if (safeUp > safeDown * 1.4 && safeLimitUp >= safeLimitDown) return "偏强";
  if (safeDown > safeUp * 1.4 || safeLimitDown > safeLimitUp * 1.5) return "偏弱";
  return "分化";
}

function buildManagerConclusion(decision = {}, strategy = {}, stats = {}, sectors = [], marketNews = []) {
  const leading = sectors.slice(0, 3).map((item) => item.name).filter(Boolean).join("、") || "热点方向待确认";
  const newsFactor = marketNews[0]?.title ? `新闻因素方面，重点关注“${marketNews[0].title}”。` : "新闻因素暂未返回有效数据。";
  const action = decision.action ?? "观察";
  return `当前AI判断市场处于${stats.state ?? "震荡"}状态，赚钱效应${stats.moneyEffect ?? "待确认"}，重点跟踪${leading}。${newsFactor}策略上以${action}和控制仓位暴露为主，仓位参考${positionPercent(decision.positionAdvice ?? strategy.position)}，等待成交额和资金方向进一步验证。`;
}

function buildOperationPlan(decision = {}, aiSummary = {}, stats = {}) {
  const action = decision.action ?? "观察";
  const risk = (decision.risks ?? aiSummary.risks ?? [])[0] ?? "若成交额不足或热点快速轮动，需要降低交易频率。";
  return `当前以${action}为主。市场${stats.state ?? "震荡"}且赚钱效应${stats.moneyEffect ?? "待确认"}时，优先跟踪低风险回调和热点持续性；若${risk}，则以控制仓位和等待确认信号为主。`;
}

function mergeMarketNews(importantNews = [], news = []) {
  const seen = new Set();
  return [...importantNews, ...news].filter((item) => {
    const title = item?.title ?? item?.headline;
    if (!title || seen.has(title)) return false;
    seen.add(title);
    return true;
  });
}

function newsInsightCard(item = {}) {
  const impact = normalizeImpact(item.impact ?? item.sentiment ?? item.direction);
  const type = item.newsType ?? item.category ?? item.target ?? "市场新闻";
  return `
    <article class="data-card news-insight-card">
      <div class="card-head"><strong>${item.title ?? item.headline ?? "新闻标题待更新"}</strong><span>${impact}</span></div>
      <p><b>类型</b>${type}</p>
      <p><b>来源</b>${item.source ?? "新闻源待确认"} · <b>时间</b>${item.time ?? item.date ?? "时间待更新"}</p>
      <p><b>影响方向</b>${impact}</p>
      <p><b>AI影响总结</b>${newsImpactSummary(item, impact)}</p>
    </article>`;
}

function missingNewsCard(updatedAt) {
  return `
    <article class="data-card news-insight-card">
      <div class="card-head"><strong>新闻数据不足</strong><span>中性</span></div>
      <p><b>类型</b>市场新闻</p>
      <p><b>来源</b>新闻接口未返回 · <b>时间</b>${updatedAt ?? "时间待更新"}</p>
      <p><b>影响方向</b>中性</p>
      <p><b>AI影响总结</b>当前没有可验证的市场、行业或公告新闻返回，因此不生成利好或利空判断，等待新闻接口恢复后再分析。</p>
    </article>`;
}

function normalizeImpact(value = "") {
  const text = String(value);
  if (/利好|正面|上涨|提振|增长|受益/.test(text)) return "利好";
  if (/利空|负面|下跌|承压|下降|风险/.test(text)) return "利空";
  return "中性";
}

function newsImpactSummary(item = {}, impact = "中性") {
  const raw = item.summary ?? item.content ?? item.aiSummary ?? item.title ?? "";
  const base = String(raw).replace(/\s+/g, " ").trim();
  const prefix = impact === "利好"
    ? "短期可能提升相关方向关注度，"
    : impact === "利空"
      ? "短期可能压制相关方向风险偏好，"
      : "短期影响偏中性，";
  const summary = `${prefix}${base || "仍需结合行情、成交额和后续公告验证，不宜单独放大新闻影响。"}`;
  return summary.length > 100 ? `${summary.slice(0, 97)}...` : summary;
}

function extractBasis(aiSummary = {}, sectors = [], sentiment = {}, stats = {}, marketNews = []) {
  const evidence = aiSummary.evidence ?? aiSummary.conclusionBasis ?? {};
  return [
    `指数：上证${stats.shanghai ?? "待更新"}、深证${stats.shenzhen ?? "待更新"}、创业板${stats.chinext ?? "待更新"}`,
    `涨跌家数：上涨${stats.upCount ?? sentiment.upCount ?? "?"}家、下跌${stats.downCount ?? sentiment.downCount ?? "?"}家、平盘${stats.flatCount ?? "待更新"}家`,
    `成交额：${stats.turnover ?? "成交数据待更新"}`,
    `赚钱效应：${stats.moneyEffect ?? "待确认"}，${stats.moneyEffectBasis ?? "依据上涨比例、成交活跃度和热点集中程度判断"}`,
    `热点持续性：${sectors.slice(0, 3).map((item) => `${item.name}(${item.sustainability ?? sectorSustainability(item)})`).join("；") || "热点方向待确认"}`,
    `资金方向：${sectors.slice(0, 3).map((item) => `${item.name}:${item.flow ?? item.amount ?? "资金待更新"}`).join("；") || "资金方向待确认"}`,
    `新闻因素：${marketNews.slice(0, 3).map((item) => `${item.title}(${item.source ?? "来源待确认"}，${item.impact ?? "中性"})`).join("；") || "新闻数据不足"}`,
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
