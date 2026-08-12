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
          { label: "AI评级", value: hasAiDecision ? decision.rating : aiStateText, change: hasAiDecision ? `${decision.score}/100` : "尚无AI判断" },
          { label: "短期判断", value: hasAiDecision ? decision.shortTerm : aiStateText, change: hasAiDecision ? decision.marketTrend : "等待AI返回" },
          { label: "一周判断", value: hasAiDecision ? decision.midTerm : aiStateText, change: hasAiDecision ? decision.action : "等待AI返回" },
          { label: "仓位建议", value: hasAiDecision ? decision.positionAdvice : "暂不生成", change: hasAiDecision ? `上涨${decision.probability?.up ?? "需观察"}` : "基础行情不受影响" },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        ${infoCard("已有仓位", decision.action === "降低仓位" || decision.action === "回避" ? "降低仓位并观察风险变化" : "继续持有观察，跟踪成交和公告变化")}
        ${infoCard("没有仓位", decision.action === "关注" ? "关注回调后的研究机会" : "等待更明确的价格、成交和消息确认")}
        ${infoCard("核心原因", (decision.reasons ?? []).join("；"))}
        ${infoCard("风险", ensureAtLeast(decision.risks, ["行情波动", "数据延迟", "行业预期变化"], 3).join("；"))}
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
      ${stockNews.map((item) => `
        <article class="timeline-row">
          <span>${item.time ?? item.date ?? stockDetail.sourceTimes?.newsUpdatedAt ?? empty}</span>
          <div>
            <strong>${linkOrText(item.title, item.link)}</strong>
            <p>${item.source ?? "新闻"} | ${item.category ?? "新闻"} | 影响：${item.impact ?? "中性"}</p>
            ${(item.relatedIndustries ?? item.relatedThemes ?? []).length ? `<p>关联方向：${(item.relatedIndustries ?? item.relatedThemes).join("、")}</p>` : ""}
          </div>
        </article>
      `).join("") || `<article class="data-card"><strong>新闻接口状态</strong><p>新闻接口本次未返回记录；新闻更新时间：${stockDetail.sourceTimes?.newsUpdatedAt ?? stockDetail.updatedAt ?? empty}</p></article>`}
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
