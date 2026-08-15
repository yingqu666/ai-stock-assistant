import { metricCard, riskCard } from "../components/cards.js";
import { timelineList } from "../components/lists.js";
import { getStockSearchData, selectStock } from "../services/mockService.js";

const empty = "数据源未返回";

export async function renderStockSearch() {
  const { stockDetail, stockNews, stockEvents, aiAnalysis } = await getStockSearchData();
  const financials = stockDetail.financials ?? {};
  const valuation = stockDetail.valuationRange ?? {};
  const announcements = stockDetail.announcements ?? [];
  const isEtf = stockDetail.assetType === "ETF";
  const decision = aiAnalysis.investmentDecision ?? {};
  const hasAiDecision = Boolean(aiAnalysis.investmentDecision);
  const aiPending = aiAnalysis.source === "AI\u5206\u6790\u751f\u6210\u4e2d";
  const aiStateText = aiPending ? "AI\u751f\u6210\u4e2d" : hasAiDecision ? (aiAnalysis.source ?? "AI") : (aiAnalysis.source ?? "AI\u672a\u751f\u6210");
  const report = buildAiDisplayReport(stockDetail, stockNews, aiAnalysis);
  const breakdown = scoreBreakdown(stockDetail, decision, aiAnalysis);
  const qualityOpportunity = buildQualityOpportunity(stockDetail, breakdown, decision, aiAnalysis);
  const newsImpact = report.newsImpact
    ?? (stockNews.map((item) => `${item.title}：${item.impact}`).slice(0, 2).join("；") || `新闻更新时间：${stockDetail.sourceTimes?.newsUpdatedAt ?? stockDetail.updatedAt ?? empty}`);

  const quoteMetrics = [
    { label: "当前价格", value: stockDetail.price ?? empty, change: stockDetail.changePercent ?? empty },
    { label: "涨跌幅", value: stockDetail.changePercent ?? empty, change: stockDetail.changeAmount ?? empty },
    { label: "成交额", value: stockDetail.amount ?? empty, change: stockDetail.volume ?? "成交量由行情源补充" },
    { label: "换手率", value: stockDetail.turnoverRate ?? empty, change: stockDetail.market ?? "市场由证券池识别" },
    { label: isEtf ? "基金规模" : "市值", value: stockDetail.fundScale ?? stockDetail.marketCap ?? empty, change: stockDetail.industry ?? "行业由数据源补充" },
    { label: "PE / PB", value: `${stockDetail.pe ?? empty} / ${stockDetail.pb ?? empty}`, change: stockDetail.valuationStatus ?? "继续观察" },
  ];

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>股票分析</h2>
          <span>支持A股和ETF，输入代码、名称、简称或拼音，例如 600176 / 512760 / AI</span>
        </div>
      </div>
      <form class="stock-search stock-query-form">
        <input name="stockQuery" value="${escapeHtml(stockDetail.code ?? "")}" aria-label="股票或ETF代码、名称、简称或拼音" placeholder="例如：600176、512760、贵州茅台、GZMT、AI" />
        <button type="submit">查询</button>
      </form>
      <p id="stock-query-message" class="form-message">
        数据来源：${stockDetail.dataSource ?? "数据源未返回"} | 更新时间：${stockDetail.updatedAt ?? empty} | 状态：${stockDetail.dataStatus ?? "部分真实"} | 类型：${stockDetail.assetType ?? "股票"}
        ${stockDetail.dataMessage ? ` | 说明：${stockDetail.dataMessage}` : ""}
      </p>
      <div class="section-head compact">
        <h2>${stockDetail.name ?? "未选择标的"} ${stockDetail.code ?? ""}</h2>
        <span>${stockDetail.market ?? "市场由证券池识别"} | ${stockDetail.industry ?? "行业由数据源补充"} | ${stockDetail.companyName ?? stockDetail.name ?? ""}</span>
      </div>
      <div class="metrics">${quoteMetrics.map(metricCard).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI投资经理判断</h2><span>${stockDetail.name ?? ""} ${stockDetail.code ?? ""}</span></div>
      <div class="metrics">
        ${[
          { label: "当前判断", value: hasAiDecision ? decision.rating : aiStateText, change: hasAiDecision ? `综合评分${decision.score}/100` : "尚无AI判断" },
          { label: "股票质量评分", value: `${qualityOpportunity.quality}/100`, change: qualityOpportunity.qualityLabel },
          { label: "当前机会评分", value: `${qualityOpportunity.opportunity}/100`, change: qualityOpportunity.opportunityLabel },
          { label: "短期判断", value: hasAiDecision ? decision.shortTerm : aiStateText, change: hasAiDecision ? decision.marketTrend : "等待AI返回" },
          { label: "一周判断", value: hasAiDecision ? decision.midTerm : aiStateText, change: hasAiDecision ? decision.action : "等待AI返回" },
          { label: "仓位建议", value: hasAiDecision ? decision.positionAdvice : "暂不生成", change: hasAiDecision ? `上涨${decision.probability?.up ?? "需观察"}` : "基础行情不受影响" },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        ${infoCard("已有仓位", decision.action === "降低仓位" || decision.action === "回避" ? "降低仓位并观察风险变化" : "继续持有观察，跟踪成交和公告变化")}
        ${infoCard("没有仓位", decision.action === "关注" ? "关注回调后的研究机会" : "等待更明确的价格、成交和消息确认")}
        ${infoCard("判断依据", buildDecisionBasis(stockDetail, stockNews, financials, breakdown).join("；"))}
        ${infoCard("核心原因", (decision.reasons ?? []).join("；"))}
        ${infoCard("风险", ensureAtLeast(decision.risks, ["行情波动", "数据延迟", "行业预期变化"], 3).join("；"))}
        ${infoCard("操作思路", buildOperationIdea(qualityOpportunity, decision))}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>五维评分</h2><span>技术、资金、基本面、消息、市场环境</span></div>
      <div class="metrics">
        ${[
          { label: "综合评分", value: hasAiDecision ? `${decision.score}/100` : aiStateText, change: hasAiDecision ? "AI综合" : "尚无AI评分" },
          { label: "技术面", value: `${breakdown.technical}/20`, change: stockDetail.changePercent ?? empty },
          { label: "资金面", value: `${breakdown.capital}/20`, change: stockDetail.amount ?? empty },
          { label: "基本面", value: `${breakdown.fundamental}/20`, change: isEtf ? "ETF看指数和成分" : (financials.status ?? "财务") },
          { label: "消息面", value: `${breakdown.news}/20`, change: `${stockNews.length + announcements.length}条` },
          { label: "市场环境", value: `${breakdown.market}/20`, change: "结合大盘环境" },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        ${infoCard("明日判断", decision.shortTerm ?? "等待行情、成交和消息进一步确认")}
        ${infoCard("一周判断", decision.midTerm ?? "震荡观察")}
        ${infoCard("买入观察条件", buyWatchConditions(stockDetail, decision).join("；"))}
        ${infoCard("卖出风险条件", sellRiskConditions(stockDetail, decision).join("；"))}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>基础资料</h2><span>公司基础、主营业务和行业位置</span></div>
      <div class="detail-grid">
        ${infoCard("名称", stockDetail.name)}
        ${infoCard("代码", stockDetail.code)}
        ${infoCard("所属市场", stockDetail.market)}
        ${infoCard("所属行业", stockDetail.industry)}
        ${infoCard(isEtf ? "成立时间" : "上市时间", stockDetail.inceptionDate ?? stockDetail.listingDate)}
        ${infoCard(isEtf ? "ETF说明" : "公司简介", stockDetail.profile)}
        ${infoCard(isEtf ? "跟踪方向" : "主营业务", stockDetail.mainBusiness)}
        ${infoCard(isEtf ? "成分方向" : "行业地位", isEtf ? (stockDetail.components ?? []).join("、") : stockDetail.industryPosition)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>${isEtf ? "ETF专项数据" : "市场数据与财务"}</h2><span>${isEtf ? "跟踪指数、规模、方向和资金活跃度" : "行情、成交、估值和财务指标"}</span></div>
      <div class="metrics">
        ${(isEtf ? etfMetrics(stockDetail) : stockFinancialMetrics(financials, valuation, stockDetail)).map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>公司公告</h2><span>公告、财报、股东变化和重大事项</span></div>
      ${announcements.length ? announcements.map((item) => `
        <article class="timeline-row">
          <span>${item.date ?? stockDetail.sourceTimes?.announcementUpdatedAt ?? empty}</span>
          <div>
            <strong>${linkOrText(item.title, item.link)}</strong>
            <p>${item.source ?? "公告"} | ${item.type ?? "公告"} | 涉及股票：${item.relatedStock ?? stockDetail.code ?? empty} | 方向：${item.analysis?.direction ?? item.impact ?? "中性"}</p>
            <p>事件：${item.analysis?.event ?? item.title}</p>
            <p>影响：${item.analysis?.impact ?? item.impact ?? "需要继续观察"}</p>
            <p>风险：${item.analysis?.risk ?? "需要阅读公告原文并结合财务和行情验证。"}</p>
          </div>
        </article>
      `).join("") : `<article class="data-card"><strong>公告接口状态</strong><p>公告接口本次未返回记录；公告更新时间：${stockDetail.sourceTimes?.announcementUpdatedAt ?? stockDetail.updatedAt ?? empty}</p></article>`}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>新闻时间线</h2><span>公司、行业和政策消息</span></div>
      ${renderCompanyNews(stockNews, stockDetail)}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>股票事件记录</h2><span>公告、新闻和跟踪事件</span></div>
      ${timelineList((stockEvents.length ? stockEvents : stockDetail.timeline ?? []).map((item) => ({ date: item.date, title: item.event ?? item.title, impact: item.analysis ?? item.impact ?? item.level })))}
    </section>

    ${hasAiDecision ? `<section class="wide-section">
      <div class="section-head"><h2>AI个股研究报告</h2><span>只做机会观察和风险提示，不输出确定买卖结论</span></div>
      <div class="detail-grid">
        ${infoCard("1. 公司基本情况", report.company)}
        ${infoCard("2. 所属行业分析", report.industry)}
        ${infoCard("3. 核心竞争力", report.moat)}
        ${infoCard("4. 当前热点关联", report.hotspotRelation ?? stockDetail.hotspotRelation)}
        ${infoCard("5. 上涨因素", (report.upFactors ?? []).join("；"))}
        ${infoCard("6. 下跌风险", (report.downsideRisks ?? report.risks ?? []).join("；"))}
        ${infoCard("7. 最新新闻影响", newsImpact)}
        ${infoCard("8. 资金情况", report.capitalFlow)}
        ${infoCard("9. 技术走势", report.technicalTrend)}
        ${infoCard("10. AI综合评价", `${report.aiScore ?? aiAnalysis.score ?? "待评分"} 分。${report.summary ?? "当前只作研究观察。"}`)}
      </div>
    </section>` : `<section class="wide-section">
      <div class="section-head"><h2>AI个股研究报告</h2><span>${aiStateText}</span></div>
      <article class="data-card">
        <strong>${aiPending ? "AI分析正在后台生成" : "AI分析未生成"}</strong>
        <p>${aiAnalysis.stockAnalysis ?? aiAnalysis.summary ?? "基础行情可以正常查看，当前没有可展示的AI投资判断。"}</p>
      </article>
    </section>`}

    <section class="wide-section">
      <div class="section-head"><h2>AI分析区域</h2><span>${aiAnalysis.source ?? "AI/fallback"}</span></div>
      <div class="detail-grid">
        ${infoCard("市场总结", aiAnalysis.summary ?? aiAnalysis.marketSummary)}
        ${infoCard("个股分析", aiAnalysis.stockAdvice ?? aiAnalysis.stockAnalysis)}
        ${infoCard("关注方向", (aiAnalysis.opportunities ?? []).join("；"))}
      </div>
      <p class="answer">${(aiAnalysis.risks ?? []).join("；")}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>数据可信度</h2><span>来源、更新时间和数据状态</span></div>
      <div class="detail-grid">
        ${infoCard("数据来源", stockDetail.dataSource)}
        ${infoCard("行情更新时间", stockDetail.sourceTimes?.quoteUpdatedAt ?? stockDetail.updatedAt)}
        ${infoCard("新闻更新时间", stockDetail.sourceTimes?.newsUpdatedAt ?? stockDetail.updatedAt)}
        ${infoCard("数据状态", stockDetail.dataStatus)}
        ${infoCard("财务状态", financials.status ?? (isEtf ? "ETF不适用" : "部分真实"))}
        ${infoCard("财务来源", financials.source)}
        ${infoCard("财务可信度", `${financials.credibility?.level ?? "中"}：${financials.credibility?.reason ?? "需要结合公告原文复核"}`)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>风险提示</h2></div>
      ${(stockDetail.riskTips ?? []).map(riskCard).join("")}
    </section>`;
}

function stockFinancialMetrics(financials, valuation, stockDetail) {
  return [
    { label: "营收", value: financials.revenue ?? empty, change: financials.revenueYoY ? `同比 ${financials.revenueYoY}` : "财务" },
    { label: "净利润", value: financials.netProfit ?? empty, change: financials.netProfitYoY ? `同比 ${financials.netProfitYoY}` : "财务" },
    { label: "毛利率", value: financials.grossMargin ?? empty, change: "盈利" },
    { label: "ROE", value: financials.roe ?? empty, change: "回报" },
    { label: "资产负债率", value: financials.debtRatio ?? empty, change: "负债" },
    { label: "经营现金流", value: financials.cashFlow ?? empty, change: financials.source ?? "财务" },
    { label: "财报期", value: financials.reportDate ?? empty, change: financials.updatedAt ?? stockDetail.updatedAt ?? empty },
    { label: "历史PE范围", value: valuation.pe ?? "历史PE由数据源补充", change: "估值" },
    { label: "历史PB范围", value: valuation.pb ?? "历史PB由数据源补充", change: "估值" },
    { label: "估值状态", value: stockDetail.valuationStatus ?? "继续观察", change: stockDetail.dataStatus ?? "状态" },
  ];
}

function etfMetrics(stockDetail) {
  return [
    { label: "ETF名称", value: stockDetail.name ?? empty, change: stockDetail.code ?? empty },
    { label: "跟踪指数", value: stockDetail.trackingIndex ?? "跟踪指数由基金公告复核", change: stockDetail.industry ?? "ETF" },
    { label: "基金规模", value: stockDetail.fundScale ?? stockDetail.marketCap ?? empty, change: stockDetail.dataStatus ?? "状态" },
    { label: "成立时间", value: stockDetail.inceptionDate ?? stockDetail.listingDate ?? "成立时间由基金公告补充", change: "基金资料" },
    { label: "管理机构", value: stockDetail.fundManager ?? "管理机构由基金公告补充", change: "基金公司" },
    { label: "行业方向", value: stockDetail.industry ?? "ETF", change: stockDetail.market ?? "ETF" },
    { label: "成分方向", value: (stockDetail.components ?? []).slice(0, 5).join("、") || "成分方向由基金资料补充", change: "持仓方向" },
    { label: "资金变化", value: stockDetail.capitalFlow ?? `成交额 ${stockDetail.amount ?? empty}`, change: stockDetail.changePercent ?? empty },
    { label: "估值水平", value: stockDetail.valuationLevel ?? stockDetail.valuationStatus ?? "结合跟踪指数观察", change: "ETF不使用公司PE/ROE" },
  ];
}

export function mountStockSearch({ rerender }) {
  const form = document.querySelector(".stock-query-form");
  const message = document.querySelector("#stock-query-message");
  if (!window.__stockAiReportReadyHandler) {
    window.__stockAiReportReadyHandler = () => rerender();
    window.addEventListener("stock-ai-report-ready", window.__stockAiReportReadyHandler);
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const query = String(formData.get("stockQuery") ?? "").trim();
    if (!query) {
      if (message) message.textContent = "\u8bf7\u8f93\u5165\u80a1\u7968/ETF\u4ee3\u7801\u3001\u540d\u79f0\u3001\u7b80\u79f0\u6216\u62fc\u97f3\u3002";
      return;
    }
    if (message) message.textContent = "\u6b63\u5728\u67e5\u8be2\uff1a" + query;
    selectStock(query);
    rerender();
  });
}

function infoCard(title, value) {
  return `<article class="data-card"><strong>${title}</strong><p>${value || empty}</p></article>`;
}

function linkOrText(title, link) {
  const safeTitle = escapeHtml(title || empty);
  return link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">${safeTitle}</a>` : safeTitle;
}

function renderCompanyNews(news = [], stockDetail = {}) {
  if (!news.length) {
    return `<article class="data-card"><strong>新闻接口状态</strong><p>新闻接口本次未返回记录；新闻更新时间：${stockDetail.sourceTimes?.newsUpdatedAt ?? stockDetail.updatedAt ?? empty}</p></article>`;
  }
  const latest = news.slice(0, 3).map((item) => newsRow(item, stockDetail)).join("");
  const rest = news.slice(3);
  return `
    ${latest}
    ${rest.length ? `
      <details class="data-card">
        <summary>查看更多公司相关新闻（${rest.length}条）</summary>
        ${rest.map((item) => newsRow(item, stockDetail)).join("")}
      </details>
    ` : ""}`;
}

function newsRow(item, stockDetail) {
  return `
    <article class="timeline-row">
      <span>${item.time ?? item.date ?? stockDetail.sourceTimes?.newsUpdatedAt ?? empty}</span>
      <div>
        <strong>${linkOrText(item.title, item.link)}</strong>
        <p>${item.source ?? "新闻"} | ${item.category ?? "新闻"} | 影响：${normalizeImpact(item.impact ?? item.category)}</p>
        <p><b>短期影响</b>${shortTermNewsImpact(item, stockDetail)}</p>
        <p><b>长期影响</b>${longTermNewsImpact(item, stockDetail)}</p>
        ${(item.relatedIndustries ?? item.relatedThemes ?? []).length ? `<p>关联方向：${(item.relatedIndustries ?? item.relatedThemes).join("、")}</p>` : ""}
      </div>
    </article>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeTomorrowAction(action = "") {
  if (action === "关注") return "买入机会";
  if (["买入机会", "等待", "持有", "降低仓位"].includes(action)) return action;
  return "等待";
}

function ensureAtLeast(items = [], fallback = [], count = 3) {
  const values = [...items, ...fallback].filter(Boolean);
  return [...new Set(values)].slice(0, Math.max(count, values.length));
}

function buildAiDisplayReport(stockDetail = {}, stockNews = [], aiAnalysis = {}) {
  const local = stockDetail.researchReport ?? {};
  const company = aiAnalysis.companyAnalysis ?? {};
  const changes = aiAnalysis.recentChanges ?? {};
  const logic = aiAnalysis.investmentLogic ?? {};
  const risks = aiAnalysis.riskAnalysis ?? {};
  const decision = aiAnalysis.investmentDecision ?? {};
  const riskList = [
    ...asList(risks.industryRisks),
    ...asList(risks.companyRisks),
    ...asList(risks.marketRisks),
    ...asList(decision.risks),
    ...asList(aiAnalysis.risks),
  ];
  return {
    ...local,
    company: company.profile ?? local.company ?? stockDetail.profile,
    industry: company.industry ?? local.industry ?? stockDetail.industry,
    moat: company.industryPosition ?? company.coreBusiness ?? local.moat ?? stockDetail.industryPosition,
    hotspotRelation: changes.priceMoveReason ?? local.hotspotRelation ?? stockDetail.hotspotRelation,
    upFactors: asList(logic.positiveFactors).length ? asList(logic.positiveFactors) : local.upFactors,
    downsideRisks: riskList.length ? riskList : local.downsideRisks,
    newsImpact: changes.newsImpact
      ?? changes.announcementImpact
      ?? local.newsImpact
      ?? stockNews.map((item) => `${item.title}：${item.impact ?? item.category ?? "中性"}`).slice(0, 2).join("；"),
    capitalFlow: local.capitalFlow ?? `成交额 ${stockDetail.amount ?? empty}，成交量 ${stockDetail.volume ?? empty}`,
    technicalTrend: decision.shortTerm ?? local.technicalTrend ?? aiAnalysis.stockAnalysis,
    aiScore: decision.score ?? local.aiScore ?? aiAnalysis.score,
    summary: aiAnalysis.conclusion ?? aiAnalysis.stockAnalysis ?? local.summary,
  };
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [String(value)];
}

function scoreBreakdown(stock, decision = {}, aiAnalysis = {}) {
  const total = Number(decision.score ?? aiAnalysis.score ?? 60);
  const technical = scoreByChange(stock.changePercent);
  const capital = String(stock.amount ?? "").includes("亿") || String(stock.amount ?? "").includes("万") ? 14 : 8;
  const fundamental = stock.assetType === "ETF" ? 12 : (stock.financials?.revenue || stock.marketCap ? 14 : 9);
  const news = Math.min(20, 10 + ((stock.announcements ?? []).length * 2));
  const market = Math.max(5, Math.min(20, total - technical - capital - fundamental - news));
  return { total, technical, capital, fundamental, news, market };
}

function buildQualityOpportunity(stock, breakdown, decision = {}, aiAnalysis = {}) {
  const financialReview = aiAnalysis.financialReview ?? {};
  const valuationReview = aiAnalysis.valuationReview ?? {};
  const quality = stock.assetType === "ETF"
    ? clamp(Math.round(breakdown.fundamental * 3 + breakdown.capital * 2 + 24))
    : clamp(Math.round(breakdown.fundamental * 3 + scoreFinancialQuality(stock, financialReview) + scoreValuationQuality(stock, valuationReview)));
  const opportunity = clamp(Math.round(
    breakdown.technical * 2
    + breakdown.capital * 2
    + breakdown.news
    + breakdown.market
    + (Number(decision.score) || breakdown.total) * 0.2,
  ));
  return {
    quality,
    opportunity,
    qualityLabel: quality >= 75 ? "标的质量较好" : quality >= 55 ? "质量中等，继续验证" : "质量数据不足或偏弱",
    opportunityLabel: opportunity >= 75 ? "当前机会较强" : opportunity >= 55 ? "适合观察等待" : "当前参与性偏弱",
  };
}

function buildDecisionBasis(stock, news = [], financials = {}, breakdown = {}) {
  return [
    `行业趋势：${stock.industry ?? "行业数据暂缺"}`,
    `市场环境：成交额${stock.amount ?? empty}，涨跌幅${stock.changePercent ?? empty}`,
    stock.assetType === "ETF"
      ? "财务数据：ETF不适用公司财务，重点看跟踪指数和资金变化"
      : `财务数据：营收${financials.revenue ?? empty}，净利润${financials.netProfit ?? empty}，ROE${financials.roe ?? empty}`,
    `新闻事件：${news[0]?.title ?? "暂无强相关新闻"}`,
    `技术走势：技术面${breakdown.technical ?? "--"}/20，资金面${breakdown.capital ?? "--"}/20`,
  ];
}

function buildOperationIdea(scores, decision = {}) {
  if (scores.quality >= 70 && scores.opportunity >= 70) return `标的质量和当前机会都较好，适合放入重点观察，策略为${decision.action ?? "关注"}，但仍需等待成交和风险确认。`;
  if (scores.quality >= 70 && scores.opportunity < 60) return "标的质量较好，但当前机会不足，更适合等待回调、缩量企稳或板块重新走强。";
  if (scores.quality < 60 && scores.opportunity >= 70) return "短线机会较活跃，但标的质量或数据完整度不足，需要降低仓位预期并控制追高风险。";
  return "质量和机会都需要继续验证，当前以观察和风险控制为主。";
}

function scoreFinancialQuality(stock, review = {}) {
  if (stock.assetType === "ETF") return 20;
  const financials = stock.financials ?? {};
  let score = 10;
  if (financials.netProfit && !String(financials.netProfit).includes("未返回")) score += 8;
  if (financials.roe && !String(financials.roe).includes("未返回")) score += 8;
  if (financials.grossMargin && !String(financials.grossMargin).includes("未返回")) score += 6;
  if (/真实|partial/.test(String(review.status ?? financials.status ?? ""))) score += 4;
  return Math.min(35, score);
}

function scoreValuationQuality(stock, review = {}) {
  if (stock.assetType === "ETF") return 15;
  const pe = Number(String(stock.pe ?? "").replace(",", ""));
  const pb = Number(String(stock.pb ?? "").replace(",", ""));
  let score = 12;
  if (Number.isFinite(pe) && pe > 0 && pe < 35) score += 10;
  if (Number.isFinite(pb) && pb > 0 && pb < 4) score += 8;
  if (/偏高/.test(String(review.level ?? stock.valuationStatus ?? ""))) score -= 8;
  return Math.max(0, Math.min(30, score));
}

function normalizeImpact(value = "") {
  const text = String(value);
  if (/利好|增长|回购|增持|中标|订单|向好/.test(text)) return "利好";
  if (/利空|下滑|减持|亏损|处罚|风险/.test(text)) return "利空";
  return "中性";
}

function shortTermNewsImpact(item = {}, stock = {}) {
  const impact = normalizeImpact(item.impact ?? item.category);
  const title = item.title ?? "该新闻";
  if (impact === "利好") return `${title}短期可能提升${stock.name ?? "标的"}关注度，但不等于趋势已经确立。重点看成交额、涨跌幅和板块联动是否同步放大，若无量上涨则持续性需要打折。`;
  if (impact === "利空") return `${title}短期可能压制风险偏好，但影响大小需要看市场是否已经提前反映。需观察价格是否放量走弱，以及同行业是否出现扩散。`;
  return `${title}短期影响偏中性，更多体现为信息补充。需要等待行情、成交额、公告原文和后续新闻确认，不单独作为参与依据。`;
}

function longTermNewsImpact(item = {}, stock = {}) {
  const impact = normalizeImpact(item.impact ?? item.category);
  const industry = stock.industry ?? "相关行业";
  if (impact === "利好") return `长期看需验证该事件能否转化为${industry}景气改善、订单增长、利润率提升或现金流改善。单条新闻只能作为跟踪线索，不能直接推导长期结论。`;
  if (impact === "利空") return `长期看需跟踪该事件是否影响${industry}需求、盈利能力、现金流或估值中枢。若后续公告和财务也验证负面变化，需要降低预期。`;
  return `长期影响取决于事件是否持续发酵，并与财务数据、公司公告、行业趋势和市场表现相互验证。若缺少后续证据，应维持中性观察。`;
}

function clamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 60;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreByChange(value) {
  const change = Number(String(value ?? "").replace("%", "").replace("+", ""));
  if (!Number.isFinite(change)) return 8;
  if (change >= 3) return 18;
  if (change >= 1) return 15;
  if (change >= 0) return 12;
  if (change > -2) return 9;
  return 5;
}

function buyWatchConditions(stock, decision = {}) {
  return [
    "回调到关键支撑位置后不再放量下跌",
    `成交量或成交额恢复，当前成交额：${stock.amount ?? empty}`,
    "所属板块继续保持强势或跌幅收敛",
    decision.rating === "积极关注" || decision.rating === "强烈关注" ? "AI评级维持积极且风险未放大" : "等待AI评级从观察转为积极",
  ];
}

function sellRiskConditions(stock, decision = {}) {
  return [
    "跌破短期趋势并且反弹无量",
    "资金持续流出或成交放大但价格走弱",
    "行业逻辑、政策环境或公告出现反向变化",
    decision.action === "降低仓位" ? "AI策略已提示降低仓位，需要优先控制风险" : "若评级降至降低仓位或回避，需要重新评估",
  ];
}
