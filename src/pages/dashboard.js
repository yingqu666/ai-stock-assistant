import { metricCard } from "../components/cards.js";
import { getDashboardData, refreshWorkbenchData } from "../services/mockService.js";

export async function renderDashboard() {
  const {
    strategy,
    marketOverview,
    marketSentiment,
    hotSectors,
    news,
    importantNews,
    watchlist,
    aiSummary,
    riskSignals,
    refreshStatus,
    portfolioSummary,
    userDataOverview,
    stockReviewSummary,
    updatedAt,
    source,
  } = await getDashboardData();
  const decision = aiSummary.investmentDecision ?? {};
  const rankedSectors = rankSectors(hotSectors).slice(0, 12);
  const marketStats = buildMarketStats(marketOverview, marketSentiment);
  const marketNews = mergeMarketNews(importantNews, news).slice(0, 8);
  const specificRisks = buildSpecificRisks(rankedSectors, marketNews, marketStats, riskSignals).slice(0, 5);

  return `
    <div class="dashboard-grid">
      <section class="hero-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">个人投资助手 · 每日决策流</p>
            <h2>市场判断 → 今日机会 → 持仓风险 → 自选变化 → 新闻影响</h2>
          </div>
          <button id="refresh-data-button" type="button">刷新数据</button>
        </div>
        <div class="strategy-grid">
          <div><span>市场判断</span><strong>${aiSummary.currentMarketJudgment ?? marketStatusLabel(marketStats, rankedSectors)}</strong></div>
          <div><span>赚钱效应</span><strong>${marketStats.moneyEffect}</strong></div>
          <div><span>仓位参考</span><strong>${positionPercent(decision.positionAdvice ?? strategy.position)}</strong></div>
        </div>
        <p class="answer"><b>AI核心结论：</b>${aiSummary.marketSummary ?? buildMarketStatusDecision(marketStats, rankedSectors, marketNews)}</p>
        <p class="ai-summary"><b>判断依据：</b>${extractBasis(aiSummary, rankedSectors, marketSentiment, marketStats, marketNews).slice(0, 5).join("；")}</p>
        <p id="refresh-message" class="form-message">数据更新时间：${updatedAt ?? refreshStatus.updatedAt}｜来源：${source ?? "行情服务"}｜${refreshStatus.message}</p>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>今日重点方向</h2><span>来自全市场热点板块，首页只保留摘要</span></div>
        <div class="card-grid">${rankedSectors.slice(0, 7).map(compactSectorSummaryCard).join("") || missingSectorCard(source)}</div>
        <p class="form-message">完整机会池和深度筛选请进入“AI研究机会”或“AI研究团队”。</p>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>风险提醒</h2><span>只展示今天最需要避开的对象</span></div>
        <div class="card-grid">
          ${specificRisks.slice(0, 4).map(specificRiskCard).join("") || `<article class="data-card"><strong>风险数据不足</strong><p>当前缺少可验证的板块、新闻或资金风险，不输出空泛风险结论。</p></article>`}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>自选变化</h2><span>观察池价格、新闻和AI观点</span></div>
        <div class="detail-grid compact">
          ${watchlist.slice(0, 4).map((item) => `
            <article class="data-card">
              <div class="card-head"><strong>${item.name}</strong><span>${item.code} · ${item.changePercent ?? "涨跌待更新"}</span></div>
              <p><b>价格</b>${item.price ?? "数据源未返回"} · <b>风险</b>${item.riskLevel ?? item.riskTips?.[0] ?? "常规跟踪"}</p>
              <p><b>新闻影响</b>${item.latestNews ?? "暂无强相关新闻"}</p>
              <p><b>AI观点</b>${item.aiOpinion ?? "等待AI结合行情、新闻和公告继续更新。"}</p>
            </article>
          `).join("") || `<article class="data-card"><strong>暂无自选股</strong><p>添加观察标的后，这里会显示变化。</p></article>`}
        </div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>新闻影响</h2><span>这里只放摘要，完整日报在“AI日报”查看</span></div>
        <div class="card-grid">${marketNews.slice(0, 4).map(newsSummaryCard).join("") || missingNewsCard(refreshStatus.updatedAt)}</div>
      </section>

      <section class="wide-section">
        <div class="section-head"><h2>我的数据摘要</h2><span>详细历史、复盘和报告进入对应页面</span></div>
        <div class="metrics">
          ${[
            { label: "自选股", value: `${userDataOverview?.watchlistCount ?? watchlist.length}只`, change: "观察池" },
            { label: "投资组合", value: `${userDataOverview?.portfolioCount ?? portfolioSummary?.positions?.length ?? 0}项`, change: "真实持仓" },
            { label: "历史日报", value: `${userDataOverview?.reportCount ?? 0}份`, change: "报告中心" },
            { label: "AI复盘", value: `${stockReviewSummary?.successRate ?? 0}%`, change: `${stockReviewSummary?.success ?? 0}成/${stockReviewSummary?.failed ?? 0}败/${stockReviewSummary?.pending ?? 0}待看` },
          ].map(metricCard).join("")}
        </div>
      </section>
    </div>`;
}

export function mountDashboard({ rerender }) {
  const button = document.querySelector("#refresh-data-button");
  const message = document.querySelector("#refresh-message");
  window.addEventListener("ai-opportunity-pool-updated", rerender, { once: true });
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

function compactSectorSummaryCard(sector = {}) {
  return `
    <article class="data-card sector-card">
      <div class="card-head"><strong>${sector.name}</strong><span>${sector.changePercent ?? sector.change ?? sector.status ?? "表现待更新"}</span></div>
      <p><b>关注原因</b>${sector.aiReason ?? sector.reason ?? "位于今日热点板块前列，需继续验证成交和资金活跃度。"}</p>
      <p><b>资金/成交</b>${sector.flow ?? sector.amount ?? sector.turnover ?? "资金字段待更新"}</p>
      <p><b>持续性</b>${sector.sustainability ?? sectorSustainability(sector)}</p>
      <p><b>风险</b>${sector.risk ?? "短线热度过高或成交缩量时，容易冲高回落。"}</p>
    </article>`;
}

function newsSummaryCard(item = {}) {
  const impact = normalizeImpact(item.impact ?? item.sentiment ?? item.direction);
  return `
    <article class="data-card news-insight-card">
      <div class="card-head"><strong>${item.title ?? item.headline ?? "新闻标题待更新"}</strong><span>${impact}</span></div>
      <p><b>来源</b>${item.source ?? "新闻源待确认"} · <b>时间</b>${item.time ?? item.date ?? "时间待更新"}</p>
      <p><b>摘要</b>${newsImpactSummary(item, impact)}</p>
      <p><b>影响</b>${newsAffectedSectors(item).slice(0, 3).join("、") || "影响板块待确认"}；${newsShortTermImpact(item, impact)}</p>
      <p class="form-message">完整新闻解读请在AI日报或新闻详情中查看。</p>
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

function marketStatusLabel(stats = {}, sectors = []) {
  const strongSectors = sectors.filter((item) => parseNumber(item.changePercent ?? item.change) > 1).length;
  const up = Number(stats.upCount ?? 0);
  const down = Number(stats.downCount ?? 0);
  if (stats.moneyEffect === "偏强" && strongSectors >= 3 && up > down) return "强势上涨";
  if ((stats.moneyEffect === "偏强" || stats.moneyEffect === "分化") && strongSectors >= 2 && up >= down) return "震荡偏强";
  if (stats.moneyEffect === "偏弱" || (up > 0 && down > up * 1.2)) return "风险阶段";
  return "震荡等待";
}

function marketActionJudgment(stats = {}, sectors = []) {
  const status = marketStatusLabel(stats, sectors);
  if (status === "强势上涨") return "重点关注";
  if (status === "震荡偏强" && sectors.length >= 3) return "可以观察";
  if (status === "震荡等待") return "等待机会";
  if (status === "风险阶段") return "暂不参与";
  return "风险较高";
}

function buildManagerConclusion(decision = {}, strategy = {}, stats = {}, sectors = [], marketNews = []) {
  const leading = sectors.slice(0, 3).map((item) => item.name).filter(Boolean).join("、") || "热点方向待确认";
  const newsFactor = marketNews[0]?.title ? `新闻因素方面，重点关注“${marketNews[0].title}”。` : "新闻因素暂未返回有效数据。";
  const action = decision.action ?? "观察";
  return `当前AI根据全市场热点、涨跌家数、成交额、涨停数量、资金活跃度和新闻因素判断，市场处于${stats.state ?? "震荡"}状态，赚钱效应${stats.moneyEffect ?? "待确认"}，主动筛选方向为${leading}。${newsFactor}策略上以${action}和控制仓位暴露为主，仓位参考${positionPercent(decision.positionAdvice ?? strategy.position)}，等待成交额和资金方向进一步验证。`;
}

function formatMarketMainDirections(mainDirections = [], hotDirections = []) {
  const rows = Array.isArray(mainDirections) && mainDirections.length ? mainDirections : hotDirections;
  return (rows ?? []).slice(0, 3).map((item) => {
    if (typeof item === "string") return item;
    return `${item.name ?? "主线方向"}：${item.reason ?? item.catalyst ?? "依据待补充"}；持续性：${item.sustainability ?? "需要继续观察"}；风险：${item.risk ?? "热点退潮或成交缩量"}`;
  }).join(" ");
}

function formatMarketRiskReminders(riskReminders = [], risks = []) {
  const rows = Array.isArray(riskReminders) && riskReminders.length ? riskReminders : risks;
  return (rows ?? []).slice(0, 4).map((item) => {
    if (typeof item === "string") return item;
    return `${item.target ?? "风险对象"}：${item.reason ?? "风险原因待补充"}；短期：${item.shortTermImpact ?? "可能加剧波动"}；中期：${item.midTermImpact ?? "需要继续观察"}`;
  }).join("；");
}

function buildActionJudgment(stats = {}, sectors = []) {
  const top = sectors[0];
  const focus = top?.name ?? "热点方向待确认";
  if (marketStatusLabel(stats, sectors) === "强势上涨") return `优先观察${focus}等前排方向，适合参与的前提是板块成交额延续、资金不快速流出、龙头不冲高回落。`;
  if (marketStatusLabel(stats, sectors) === "风险阶段") return `当前不急于参与，等待上涨家数修复、跌停数量下降、热点重新集中后再观察${focus}。`;
  return `以等待价格确认为主，关注${focus}是否在回落时仍有资金承接；若热点轮动过快，不追高。`;
}

function buildMarketStatusDecision(stats = {}, sectors = [], news = []) {
  const status = marketStatusLabel(stats, sectors);
  const topSector = sectors[0]?.name ?? "热点板块待确认";
  const newsTitle = news[0]?.title ?? "新闻数据不足";
  return `${status}。依据：上涨${stats.upCount}家、下跌${stats.downCount}家，成交额${stats.turnover}，赚钱效应${stats.moneyEffect}；热点集中在${topSector}，新闻侧重点为“${newsTitle}”。`;
}

function buildMainDirectionDecision(sectors = [], news = []) {
  const top = sectors.slice(0, 3);
  if (!top.length) return "热点板块TOP数据不足，暂不主动生成主线方向。";
  return top.map((sector) => {
    const relatedNews = findNewsForSector(sector, news);
    return `${sector.name}：涨跌幅${sector.changePercent ?? sector.change ?? "待更新"}，资金${sector.flow ?? sector.amount ?? "待更新"}，${relatedNews ? `新闻催化“${relatedNews.title}”` : "暂未匹配强新闻催化"}。`;
  }).join(" ");
}

function buildRiskDirectionDecision(stats = {}, sectors = [], news = []) {
  const hotRisk = sectors
    .filter((sector) => parseNumber(sector.changePercent ?? sector.change) >= 3 || /高|回落|分化/.test(String(sector.risk ?? "")))
    .slice(0, 3)
    .map((sector) => `${sector.name}短线热度偏高，风险点：${sector.risk ?? "成交缩量或龙头冲高回落"}`);
  const badNews = news.filter((item) => normalizeImpact(item.impact ?? item.direction) === "利空").slice(0, 2).map((item) => `${item.relatedIndustry ?? item.newsType ?? "相关方向"}：${item.title}`);
  const breadthRisk = stats.moneyEffect === "偏弱" ? [`市场宽度偏弱，上涨${stats.upCount}家、下跌${stats.downCount}家`] : [];
  return [...hotRisk, ...badNews, ...breadthRisk].join("；") || "暂未出现明确高风险方向，但仍需观察成交额、跌停数量和热点持续性。";
}

function buildMarketPriceZones(sectors = [], stats = {}) {
  const top = sectors[0];
  if (!top) return "热点板块数据不足，不能给出观察区域。";
  return `关注区域：${top.name}回落但资金仍活跃；风险区域：板块涨跌幅转弱、成交额缩小或龙头跌破当日均线；压力区域：短线涨幅过高且资金流入减弱。依据：${stats.moneyEffectBasis ?? "上涨比例、成交额和热点集中度"}`;
}

function buildGiveUpConditions(stats = {}, sectors = []) {
  const topNames = sectors.slice(0, 3).map((item) => item.name).join("、") || "热点方向";
  return `若${topNames}出现成交缩量、资金转弱、涨停数量下降、跌停数量上升，或相关新闻催化被证伪，则放弃追随热点，等待下一次确认。`;
}

function buildSpecificRisks(sectors = [], news = [], stats = {}, riskSignals = []) {
  const sectorRisks = sectors.slice(0, 3).map((sector) => {
    const relatedNews = findNewsForSector(sector, news);
    return {
      object: sector.name,
      level: parseNumber(sector.changePercent ?? sector.change) > 3 ? "偏高" : "中",
      reason: {
        news: relatedNews?.title ?? "暂未匹配到强新闻催化",
        quote: `板块涨跌幅${sector.changePercent ?? sector.change ?? "待更新"}，成交/资金${sector.flow ?? sector.amount ?? "待更新"}`,
        capital: sector.flow ?? sector.capitalFlow ?? "资金字段待更新",
      },
      impact: {
        short: "短期可能出现冲高回落或轮动分化。",
        long: "长期需要看行业景气、业绩和政策是否继续验证。",
      },
    };
  });
  const signalRisks = riskSignals.slice(0, 2).map((item) => ({
    object: item.target ?? item.type ?? "风险信号",
    level: item.level ?? "中",
    reason: {
      news: item.message ?? "风险服务返回",
      quote: `市场赚钱效应${stats.moneyEffect ?? "待确认"}`,
      capital: stats.turnover ?? "成交额待更新",
    },
    impact: {
      short: "短期需要降低追高频率。",
      long: "若连续出现，需要降低相关方向预期。",
    },
  }));
  return [...sectorRisks, ...signalRisks];
}

function specificRiskCard(item = {}) {
  return `
    <article class="data-card">
      <div class="card-head"><strong>${item.object}</strong><span>${item.level}</span></div>
      <p><b>新闻</b>${item.reason.news}</p>
      <p><b>行情</b>${item.reason.quote}</p>
      <p><b>资金</b>${item.reason.capital}</p>
      <p><b>短期影响</b>${item.impact.short}</p>
      <p><b>长期影响</b>${item.impact.long}</p>
    </article>`;
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
    <details class="data-card news-insight-card">
      <summary class="card-head"><strong>${item.title ?? item.headline ?? "新闻标题待更新"}</strong><span>${impact}</span></summary>
      <p><b>类型</b>${type}</p>
      <p><b>来源</b>${item.source ?? "新闻源待确认"} · <b>时间</b>${item.time ?? item.date ?? "时间待更新"}</p>
      <p><b>原新闻内容摘要</b>${newsOriginalSummary(item)}</p>
      <p><b>AI解读</b>${newsImpactSummary(item, impact)}</p>
      <p><b>市场影响</b>${newsMarketImpact(item, impact)}</p>
      <p><b>影响板块</b>${newsAffectedSectors(item).join("、") || "待确认"}</p>
      <p><b>影响股票</b>${newsAffectedStocks(item).join("、") || "待确认"}</p>
      <p><b>短期影响</b>${impact}：${newsShortTermImpact(item, impact)}</p>
      <p><b>长期影响</b>${normalizeImpact(item.longTermImpact ?? item.impact ?? item.category)}：${newsLongTermImpact(item, impact)}</p>
      <p><b>风险提示</b>${item.riskWarning ?? item.aiInterpretation?.riskWarning ?? "需要结合行情、成交额和后续公告继续验证。"}</p>
    </details>`;
}

function missingNewsCard(updatedAt) {
  return `
    <details class="data-card news-insight-card" open>
      <summary class="card-head"><strong>新闻数据不足</strong><span>中性</span></summary>
      <p><b>类型</b>市场新闻</p>
      <p><b>来源</b>新闻接口未返回 · <b>时间</b>${updatedAt ?? "时间待更新"}</p>
      <p><b>原新闻内容摘要</b>新闻接口未返回可验证正文摘要。</p>
      <p><b>AI解读</b>当前没有可验证的市场、行业或公告新闻返回，因此不生成利好或利空判断，等待新闻接口恢复后再分析。</p>
      <p><b>市场影响</b>影响暂不能确认。</p>
      <p><b>影响板块</b>待确认</p>
      <p><b>影响股票</b>待确认</p>
      <p><b>短期影响</b>中性：缺少新闻数据，不做短线影响推断。</p>
      <p><b>长期影响</b>中性：长期影响需要公告、财报和行业新闻继续验证。</p>
    </details>`;
}

function normalizeImpact(value = "") {
  const text = String(value);
  if (/利好|正面|上涨|提振|增长|受益/.test(text)) return "利好";
  if (/利空|负面|下跌|承压|下降|风险/.test(text)) return "利空";
  return "中性";
}

function newsImpactSummary(item = {}, impact = "中性") {
  const raw = item.aiInterpretation?.factSummary ?? item.factSummary ?? item.aiSummary ?? item.summary ?? item.content ?? item.title ?? "";
  const base = String(raw).replace(/\s+/g, " ").trim();
  if (item.aiInterpretation?.factSummary || item.factSummary || item.aiSummary) {
    return base.length > 100 ? `${base.slice(0, 97)}...` : base;
  }
  const prefix = impact === "利好"
    ? "短期可能提升相关方向关注度，"
    : impact === "利空"
      ? "短期可能压制相关方向风险偏好，"
      : "短期影响偏中性，";
  const summary = `${prefix}${base || "仍需结合行情、成交额和后续公告验证，不宜单独放大新闻影响。"}`;
  return summary.length > 100 ? `${summary.slice(0, 97)}...` : summary;
}

function newsOriginalSummary(item = {}) {
  const text = String(item.factSummary ?? item.summary ?? item.content ?? item.title ?? "新闻正文摘要未返回。").replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function newsMarketImpact(item = {}, impact = "中性") {
  if (impact === "利好") return "可能提升相关板块风险偏好，但需要成交额和龙头股反馈确认。";
  if (impact === "利空") return "可能压制相关板块情绪，若与资金流出共振，短线风险会放大。";
  return "影响偏信息补充，需继续观察是否扩散到板块成交和个股表现。";
}

function newsAffectedSectors(item = {}) {
  const explicit = [...(item.relatedIndustries ?? []), item.relatedIndustry].filter(Boolean);
  if (explicit.length) return [...new Set(explicit)].slice(0, 5);
  const text = `${item.title ?? ""}${item.summary ?? ""}`;
  const sectors = [];
  if (/光模块|光通信|CPO/.test(text)) sectors.push("光模块");
  if (/AI|人工智能|算力|服务器/.test(text)) sectors.push("AI算力");
  if (/半导体|芯片|晶圆|光刻机/.test(text)) sectors.push("半导体");
  if (/机器人|人形机器人/.test(text)) sectors.push("机器人");
  if (/电力|储能|电网/.test(text)) sectors.push("电力储能");
  return sectors;
}

function newsAffectedStocks(item = {}) {
  const explicit = [...(item.relatedStocks ?? []), item.relatedStock].filter((value) => value && !["A股", "市场"].includes(value));
  if (explicit.length) return [...new Set(explicit)].slice(0, 6);
  return newsAffectedSectors(item).flatMap(relatedStocksForSector).slice(0, 6);
}

function newsShortTermImpact(item = {}, impact = "中性") {
  const explicit = item.shortTermImpact ?? item.aiInterpretation?.shortTermImpact;
  if (explicit) return String(explicit).slice(0, 120);
  const sectors = newsAffectedSectors(item).join("、") || "相关方向";
  if (impact === "利好") return `${sectors}短线关注度可能提升，重点看板块涨幅、成交额和龙头股是否同步放大。`;
  if (impact === "利空") return `${sectors}短线可能承压，若资金流出和跌幅扩大，需要降低参与意愿。`;
  return `${sectors}短线影响待确认，单条新闻不足以形成交易判断。`;
}

function newsLongTermImpact(item = {}, impact = "中性") {
  const explicit = item.longTermImpact ?? item.aiInterpretation?.longTermImpact;
  if (explicit) return String(explicit).slice(0, 120);
  const sectors = newsAffectedSectors(item).join("、") || "相关方向";
  if (impact === "利好") return `长期需要验证${sectors}是否出现订单、业绩、政策或产业趋势持续兑现。`;
  if (impact === "利空") return `长期需要观察${sectors}盈利预期、估值中枢或政策环境是否被实质削弱。`;
  return `长期影响取决于后续公告、财报和行业景气能否继续验证。`;
}

function findNewsForSector(sector = {}, news = []) {
  const name = String(sector.name ?? "");
  return news.find((item) => {
    const text = `${item.title ?? ""}${item.summary ?? ""}${item.relatedIndustry ?? ""}${(item.relatedIndustries ?? []).join("")}`;
    return name && text.includes(name);
  });
}

function relatedStocksForSector(name = "") {
  const text = String(name);
  if (/光模块|通信|CPO/.test(text)) return ["中际旭创", "新易盛", "天孚通信", "光迅科技", "通信ETF"];
  if (/AI|算力|服务器/.test(text)) return ["工业富联", "浪潮信息", "中科曙光", "寒武纪", "人工智能ETF"];
  if (/半导体|芯片|光刻机/.test(text)) return ["中芯国际", "北方华创", "华虹公司", "芯片ETF", "科创半导体ETF"];
  if (/机器人/.test(text)) return ["机器人ETF", "汇川技术", "绿的谐波", "埃斯顿"];
  if (/电力|储能|电网/.test(text)) return ["宁德时代", "阳光电源", "国电南瑞", "储能ETF"];
  if (/资源|煤炭|有色/.test(text)) return ["中国神华", "紫金矿业", "陕西煤业", "资源ETF"];
  return [];
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

function marketSourceStatus(source = "", sentiment = {}) {
  const text = `${source} ${sentiment.failureReason ?? ""} ${sentiment.summary ?? ""}`;
  if (/模拟|本地备用/.test(text)) return "🟡 mock/备用";
  if (/失败|数据不足|未返回|缺失|不可用/.test(text)) return "🔴 数据不足";
  if (/部分|新浪|腾讯/.test(text)) return "🟡 部分真实";
  return "🟢 真实数据";
}
