import { metricCard, riskCard } from "../components/cards.js";
import { timelineList } from "../components/lists.js";
import { getStockSearchData, selectStock } from "../services/mockService.js";
import { assessDataQuality, buildPriceLevels, classifySecurity } from "../../shared/securityClassifier.js";

const empty = "数据源未返回";

export async function renderStockSearch() {
  const { stockDetail, stockNews, stockEvents, aiAnalysis, aiInput } = await getStockSearchData();
  const financials = stockDetail.financials ?? {};
  const valuation = stockDetail.valuationRange ?? {};
  const announcements = stockDetail.announcements ?? [];
  const securityProfile = stockDetail.securityProfile ?? classifySecurity(stockDetail);
  const dataQuality = stockDetail.dataQuality ?? assessDataQuality({ ...stockDetail, securityProfile });
  const qualityView = buildDataQualityView(stockDetail, stockNews, announcements, financials, dataQuality, securityProfile);
  const priceLevels = stockDetail.priceLevels ?? buildPriceLevels({ ...stockDetail, securityProfile }, dataQuality);
  const isEtf = securityProfile.isEtf;
  const isSt = securityProfile.isSt;
  const isNewStock = securityProfile.isNewStock;
  const dataBlocked = dataQuality.blocked || dataQuality.level === "insufficient";
  const decisionBlocked = dataBlocked || dataQuality.canGenerateDecision === false;
  const canScore = dataQuality.canScore && !decisionBlocked && !isNewStock && !isSt;
  const canShowPriceLevels = dataQuality.canGeneratePriceLevels && !dataBlocked && !isNewStock && priceLevels.status === "available";
  const decision = aiAnalysis.investmentDecision ?? {};
  const hasAiDecision = Boolean(aiAnalysis.investmentDecision) && !decisionBlocked;
  const aiPending = aiAnalysis.source === "AI\u5206\u6790\u751f\u6210\u4e2d";
  const aiStateText = aiPending ? "AI\u751f\u6210\u4e2d" : hasAiDecision ? (aiAnalysis.source ?? "AI") : (aiAnalysis.source ?? "AI\u672a\u751f\u6210");
  const report = buildAiDisplayReport(stockDetail, stockNews, aiAnalysis);
  const breakdown = canScore ? scoreBreakdown(stockDetail, decision, aiAnalysis) : null;
  const qualityOpportunity = canScore ? buildQualityOpportunity(stockDetail, breakdown, decision, aiAnalysis) : { quality: "数据不足", opportunity: "数据不足", qualityLabel: qualityView.summary, opportunityLabel: qualityView.summary };
  const tradingPosition = buildTradingPosition(stockDetail, aiInput?.marketData, breakdown);
  const observation = buildObservationRange(stockDetail, tradingPosition, breakdown);
  const cycle = buildHoldingCycle(stockDetail, tradingPosition, decision, aiInput?.marketData);
  const newsImpact = report.newsImpact
    ?? (stockNews.map((item) => `${item.title}：${item.impact}`).slice(0, 2).join("；") || `新闻更新时间：${stockDetail.sourceTimes?.newsUpdatedAt ?? stockDetail.updatedAt ?? empty}`);

  const quoteMetrics = [
    { label: "当前价格", value: stockDetail.price ?? empty, change: stockDetail.changePercent ?? empty },
    { label: "涨跌幅", value: stockDetail.changePercent ?? empty, change: stockDetail.changeAmount ?? empty },
    { label: "成交额", value: stockDetail.amount ?? empty, change: stockDetail.volume ?? "成交量由行情源补充" },
    { label: "换手率", value: stockDetail.turnoverRate ?? empty, change: stockDetail.market ?? "市场由证券池识别" },
    { label: isEtf ? "基金规模" : "市值", value: stockDetail.fundScale ?? stockDetail.marketCap ?? empty, change: stockDetail.industry ?? "行业由数据源补充" },
    isEtf
      ? { label: "跟踪方向", value: stockDetail.trackingIndex ?? stockDetail.industry ?? empty, change: "ETF不使用公司PE/PB" }
      : { label: "PE / PB", value: `${stockDetail.pe ?? empty} / ${stockDetail.pb ?? empty}`, change: stockDetail.valuationStatus ?? "继续观察" },
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
        数据来源：${stockDetail.dataSource ?? "数据源未返回"} | 更新时间：${stockDetail.updatedAt ?? empty} | 数据质量：${qualityView.label} | 类型：${securityProfile.template}
        ${stockDetail.dataMessage ? ` | 说明：${stockDetail.dataMessage}` : ""}
      </p>
      ${renderDataStatusBreakdown(stockDetail, stockNews, announcements, financials, qualityView)}
      ${renderReliabilityNotice(securityProfile, dataQuality, priceLevels, qualityView)}
      <div class="section-head compact">
        <h2>${stockDetail.name ?? "未选择标的"} ${stockDetail.code ?? ""}</h2>
        <span>${stockDetail.market ?? "市场由证券池识别"} | ${stockDetail.industry ?? "行业由数据源补充"} | ${stockDetail.companyName ?? stockDetail.name ?? ""}</span>
      </div>
      <div class="metrics">${quoteMetrics.map(metricCard).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>交易位置分析</h2><span>基于当前行情、日内位置、成交和行业热度</span></div>
      <div class="metrics">
        ${[
          { label: "当前价格", value: stockDetail.price ?? empty, change: stockDetail.changePercent ?? empty },
          { label: "今日最高价", value: stockDetail.highPrice ?? empty, change: "日内高点" },
          { label: "今日最低价", value: stockDetail.lowPrice ?? empty, change: "日内低点" },
          { label: "涨停价格", value: stockDetail.limitUpPrice ?? empty, change: "观察参考" },
          { label: "跌停价格", value: stockDetail.limitDownPrice ?? empty, change: "风险参考" },
          { label: "成交量变化", value: stockDetail.volumeChange ?? empty, change: stockDetail.volume ?? "成交量" },
          { label: "成交额变化", value: stockDetail.amountChange ?? empty, change: stockDetail.amount ?? "成交额" },
          { label: "当前趋势", value: tradingPosition.trend, change: tradingPosition.pricePosition },
        ].map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        ${infoCard("当前价格位置", tradingPosition.pricePosition)}
        ${infoCard("判断依据", tradingPosition.basis.join("；"))}
        ${infoCard("热点/行业参考", tradingPosition.industryReference)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI交易观察</h2><span>只提供观察价格区间，不输出直接交易指令</span></div>
      ${canShowPriceLevels ? `<div class="metrics">
        ${[
          { label: "关注区间", value: getPriceLevel(priceLevels, "关注区域"), change: getPriceBasis(priceLevels, "关注区域") },
          { label: "压力位置", value: getPriceLevel(priceLevels, "压力区域"), change: getPriceBasis(priceLevels, "压力区域") },
          { label: "风险位置", value: getPriceLevel(priceLevels, "风险区域"), change: getPriceBasis(priceLevels, "风险区域") },
          { label: "数据状态", value: observation.status, change: stockDetail.dataStatus ?? "行情状态" },
        ].map(metricCard).join("")}
      </div>` : `<article class="data-card"><strong>暂不生成价格区间</strong><p>${priceLevels.message ?? qualityView.summary}</p></article>`}
      <div class="detail-grid compact">
        ${infoCard("观察逻辑", canShowPriceLevels ? observation.logic : "当前不满足价格区间生成条件，避免输出没有依据的精确数字。")}
        ${infoCard("估值参考", observation.valuation)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>持有周期判断</h2><span>适配3天-1个月观察周期</span></div>
      <div class="detail-grid compact">
        ${infoCard("短线观察 1-5天", cycle.shortTerm)}
        ${infoCard("短线上涨需要观察", cycle.shortUp)}
        ${infoCard("短线风险需要观察", cycle.shortRisk)}
        ${infoCard("中期观察 1-4周", cycle.midTerm)}
        ${infoCard("中期上涨需要观察", cycle.midUp)}
        ${infoCard("中期风险需要观察", cycle.midRisk)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI投资经理判断</h2><span>${stockDetail.name ?? ""} ${stockDetail.code ?? ""}</span></div>
      <div class="metrics">
        ${(canScore ? [
          { label: "AI结论", value: hasAiDecision ? normalizeAiConclusion(aiAnalysis.aiConclusion ?? decision.rating, decision.score) : aiStateText, change: hasAiDecision ? "评分仅作辅助，不代表可以买" : "尚无AI判断" },
          { label: "股票质量评分", value: `${qualityOpportunity.quality}/100`, change: qualityOpportunity.qualityLabel },
          { label: "当前机会评分", value: `${qualityOpportunity.opportunity}/100`, change: qualityOpportunity.opportunityLabel },
          { label: "短期判断", value: hasAiDecision ? decision.shortTerm : aiStateText, change: hasAiDecision ? decision.marketTrend : "等待AI返回" },
          { label: "一周判断", value: hasAiDecision ? decision.midTerm : aiStateText, change: hasAiDecision ? decision.action : "等待AI返回" },
          { label: "仓位建议", value: hasAiDecision ? decision.positionAdvice : "暂不生成", change: hasAiDecision ? `上涨${decision.probability?.up ?? "需观察"}` : "基础行情不受影响" },
        ] : [
          { label: "当前判断", value: dataBlocked ? "数据不足" : isNewStock ? "新股降级观察" : "暂不评分", change: qualityView.summary },
          { label: "数据质量", value: qualityView.label, change: `可用字段 ${dataQuality.availableCount}/${dataQuality.requiredCount}` },
          { label: "当前策略", value: isSt ? "风险较高" : "等待机会", change: "不生成明确评分" },
          { label: "技术结论", value: isNewStock ? "不生成" : "数据不足", change: "避免硬编结论" },
        ]).map(metricCard).join("")}
      </div>
      <div class="detail-grid compact">
        ${infoCard("技术", canScore ? `趋势：${tradingPosition.trend}；价格位置：${tradingPosition.pricePosition}；涨跌幅：${stockDetail.changePercent ?? empty}` : qualityView.summary)}
        ${infoCard("资金", `成交额：${stockDetail.amount ?? empty}；成交量：${stockDetail.volume ?? empty}；${stockDetail.volumeChange ?? "成交变化数据不足"}`)}
        ${infoCard("行业", tradingPosition.industryReference)}
        ${infoCard("基本面", isEtf ? "ETF重点看跟踪指数、规模和流动性。" : `营收${financials.revenue ?? empty}，净利润${financials.netProfit ?? empty}，ROE${financials.roe ?? empty}`)}
        ${infoCard("新闻", stockNews[0] ? `${stockNews[0].title}（${stockNews[0].source ?? "新闻"}，${normalizeImpact(stockNews[0].impact ?? stockNews[0].category)}）` : "暂无强相关新闻")}
        ${infoCard("当前状态", aiAnalysis.currentState ?? `${stockDetail.name ?? "标的"}当前价${stockDetail.price ?? empty}，涨跌幅${stockDetail.changePercent ?? empty}。`)}
        ${infoCard("关注逻辑", aiAnalysis.attentionLogic ?? aiAnalysis.currentOpportunityLogic ?? "结合行情、板块、新闻和公告继续验证。")}
        ${infoCard("核心原因", canScore ? (decision.reasons ?? []).join("；") : "数据不足或特殊标的降级，不生成硬性结论。")}
        ${infoCard("风险", ensureAtLeast(decision.risks, ["行情波动", "数据延迟", "行业预期变化"], 3).join("；"))}
        ${infoCard("观察思路", buildOperationIdea(qualityOpportunity, decision))}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI判断依据</h2><span>评分、风险、价格区间和操作思路必须有数据依据</span></div>
      <div class="detail-grid compact">
        ${renderDecisionBasis(stockDetail, aiAnalysis, decision, priceLevels, dataQuality)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>投资研究流程</h2><span>关注理由、观察条件、短中线判断和验证点</span></div>
      <div class="detail-grid compact">
        ${renderResearchDecisionChain(stockDetail, stockNews, announcements, aiAnalysis, decision, aiInput, dataQuality, cycle)}
      </div>
    </section>

    ${canScore ? `<section class="wide-section">
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
    </section>` : `<section class="wide-section">
      <div class="section-head"><h2>诊断卡</h2><span>数据严重缺失或特殊标的时不输出具体评分</span></div>
      <div class="metrics">
        ${[
          { label: "数据质量", value: qualityView.label, change: qualityView.summary },
          { label: "趋势状态", value: isNewStock ? "新股不判断" : tradingPosition.trend, change: dataQuality.canGenerateTechnicalView ? "可观察" : "数据不足" },
          { label: "信号强度", value: dataQuality.level === "complete" ? "强" : dataQuality.level === "partial" ? "中" : "弱", change: `缺失：${(dataQuality.missingFields ?? []).join("、") || "无"}` },
          { label: "当前策略", value: isSt ? "风险较高" : dataBlocked ? "暂不参与" : "等待机会", change: "不输出交易指令" },
        ].map(metricCard).join("")}
      </div>
    </section>`}

    <section class="wide-section">
      <div class="section-head"><h2>基础资料</h2><span>${isEtf ? "ETF跟踪方向、成立时间和成分方向" : isNewStock ? "上市信息、成交情况和风险限制" : "公司基础、主营业务和行业位置"}</span></div>
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
            <p>事实摘要：${item.analysis?.factSummary ?? item.analysis?.event ?? item.title}</p>
            <p>短期影响：${item.analysis?.shortTermImpact ?? item.analysis?.impact ?? item.impact ?? "需要继续观察"}</p>
            <p>中长期影响：${item.analysis?.midLongTermImpact ?? "需要结合后续公告、财务和行情验证。"}</p>
            <p>风险：${item.analysis?.risk ?? "需要阅读公告原文并结合财务和行情验证。"}</p>
            ${item.duplicateCount > 1 ? `<p>去重提示：该事件有${item.duplicateCount}条相似报道/公告，AI催化只按一次主要事件计算。</p>` : ""}
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

    ${hasAiDecision && canScore && !isEtf && !isSt && !isNewStock ? `<section class="wide-section">
      <div class="section-head"><h2>AI个股研究报告</h2><span>只做机会观察和风险提示，不输出交易指令</span></div>
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
    </section>` : hasAiDecision && isEtf ? `<section class="wide-section">
      <div class="section-head"><h2>AI ETF研究报告</h2><span>ETF只分析跟踪方向、流动性、板块趋势和风险</span></div>
      <div class="detail-grid">
        ${infoCard("1. ETF跟踪方向", stockDetail.trackingIndex ?? stockDetail.industry)}
        ${infoCard("2. 板块强弱", tradingPosition.industryReference)}
        ${infoCard("3. 流动性", `成交额${stockDetail.amount ?? empty}，成交量${stockDetail.volume ?? empty}。`)}
        ${infoCard("4. 热度持续性", report.hotspotRelation ?? "需要观察热点板块成交和新闻催化是否延续。")}
        ${infoCard("5. ETF风险", ensureAtLeast(decision.risks, ["板块回撤", "成交萎缩", "跟踪方向热度下降"], 3).join("；"))}
        ${infoCard("6. 观察结论", report.summary ?? aiAnalysis.stockAnalysis ?? "ETF只作主题观察。")}
      </div>
    </section>` : hasAiDecision && isSt ? `<section class="wide-section">
      <div class="section-head"><h2>AI ST风险报告</h2><span>ST标的只做风险识别和观察条件，不使用普通成长模板</span></div>
      <div class="detail-grid">
        ${infoCard("1. ST风险等级", report.stRiskLevel ?? "高")}
        ${infoCard("2. 退市风险", report.delistingRisk ?? "需优先复核风险警示和持续经营情况。")}
        ${infoCard("3. 财务风险", report.financialRisk ?? "需复核财报、审计意见和持续经营能力。")}
        ${infoCard("4. 流动性风险", report.liquidityRisk ?? `成交额${stockDetail.amount ?? empty}，成交量${stockDetail.volume ?? empty}。`)}
        ${infoCard("5. 交易规则提示", report.tradingRuleNotice ?? "ST标的受风险警示和交易规则影响较大。")}
        ${infoCard("6. 风险观察条件", ensureAtLeast(report.riskObserveConditions, ["风险警示变化", "财务状况变化", "成交流动性变化"], 3).join("；"))}
      </div>
    </section>` : `<section class="wide-section">
      <div class="section-head"><h2>AI个股研究报告</h2><span>${aiStateText}</span></div>
      <article class="data-card">
        <strong>${aiPending ? "AI分析正在后台生成" : isNewStock ? "新股降级展示" : dataBlocked ? "数据不足，无法生成可靠判断" : "AI分析未生成"}</strong>
        <p>${isNewStock ? "新股历史数据不足，仅展示上市信息、成交情况和风险限制。" : aiAnalysis.stockAnalysis ?? aiAnalysis.summary ?? "基础行情可以正常查看，当前没有可展示的AI投资判断。"}</p>
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
        ${infoCard("行情来源", stockDetail.quoteSource ?? stockDetail.dataSource)}
        ${infoCard("新闻更新时间", stockDetail.sourceTimes?.newsUpdatedAt ?? stockDetail.updatedAt)}
        ${infoCard("数据状态", stockDetail.dataStatus)}
        ${infoCard("数据质量", `${qualityView.label}：${qualityView.summary}`)}
        ${infoCard("缺失字段", qualityView.missing.length ? qualityView.missing.join("、") : "无")}
        ${infoCard(isEtf ? "专项指标状态" : "财务状态", financials.status ?? (isEtf ? "ETF专项指标" : "部分真实"))}
        ${infoCard(isEtf ? "专项指标来源" : "财务来源", financials.source)}
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
    { label: "估值水平", value: stockDetail.valuationLevel ?? stockDetail.valuationStatus ?? "结合跟踪指数观察", change: "ETF按跟踪方向观察" },
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

function renderDataStatusBreakdown(stock = {}, news = [], announcements = [], financials = {}, qualityView = {}) {
  const quoteOk = hasField(stock.price) && hasField(stock.changePercent);
  const newsOk = news.length > 0;
  const announcementOk = announcements.length > 0;
  const financialOk = /真实|real|partial|部分/.test(String(financials.status ?? "")) && (hasField(financials.revenue) || hasField(financials.netProfit) || hasField(financials.roe));
  return `
    <p class="form-message">
      数据质量：${qualityView.label ?? "部分完整"}。
      ${qualityView.summary ?? ""}
      ${qualityView.missing?.length ? `缺少：${qualityView.missing.join("、")}。` : ""}
      数据分项：行情${quoteOk ? "正常" : "暂缺"}；
      新闻${newsOk ? "正常" : "暂缺"}；
      公告${announcementOk ? "正常" : "暂缺"}；
      财务${financialOk || stock.assetType === "ETF" ? "正常/不适用" : "暂缺"}。
      ${quoteOk ? "基础行情可先查看，新闻、公告和AI会异步补充。" : "行情暂缺时不生成硬判断。"}
    </p>`;
}

function hasField(value) {
  return ![undefined, null, "", empty, "暂无", "数据不足", "不适用"].includes(value);
}

function buildDataQualityView(stock = {}, news = [], announcements = [], financials = {}, quality = {}, profile = {}) {
  const quoteOk = hasField(stock.price) && hasField(stock.changePercent);
  const newsOk = news.length > 0;
  const announcementOk = announcements.length > 0;
  const financialOk = profile.isEtf || (/真实|real|partial|部分/.test(String(financials.status ?? "")) && (hasField(financials.revenue) || hasField(financials.netProfit) || hasField(financials.roe)));
  const missing = [
    !quoteOk ? "行情" : "",
    !newsOk ? "新闻" : "",
    !announcementOk ? "公告" : "",
    !financialOk ? "财务数据" : "",
    ...(quality.missingFields ?? []),
  ].filter(Boolean);
  const uniqueMissing = [...new Set(missing)].slice(0, 8);
  if (quality.blocked || quality.level === "insufficient" || !quoteOk) {
    return {
      level: "insufficient",
      label: "不足",
      missing: uniqueMissing,
      summary: "无法生成可靠判断，只展示已返回的真实字段。",
    };
  }
  if (!uniqueMissing.length && quality.level === "complete") {
    return {
      level: "complete",
      label: "完整",
      missing: [],
      summary: "可以生成完整分析。",
    };
  }
  const usable = [
    quoteOk ? "行情" : "",
    newsOk ? "新闻" : "",
    announcementOk ? "公告" : "",
    financialOk ? (profile.isEtf ? "ETF专项数据" : "财务") : "",
  ].filter(Boolean).join("+") || "基础字段";
  return {
    level: "partial",
    label: "部分完整",
    missing: uniqueMissing,
    summary: `仍可参考：${usable}。`,
  };
}

function renderReliabilityNotice(profile = {}, quality = {}, priceLevels = {}, qualityView = {}) {
  const warnings = [
    ...(profile.warnings ?? []),
    ...(quality.financials?.issues ?? []),
    quality.blocked || quality.level === "insufficient" ? "数据质量不足，无法生成可靠判断。" : "",
  ].filter(Boolean);
  if (!warnings.length && quality.level === "complete") return "";
  return `
    <article class="data-card ${profile.isSt ? "risk-row" : ""}">
      <strong>${profile.template ?? "数据诊断"}</strong>
      <p>数据质量：${qualityView.label ?? quality.label ?? "部分完整"}，可用字段 ${quality.availableCount ?? 0}/${quality.requiredCount ?? 0}。</p>
      <p>${qualityView.summary ?? quality.message ?? "需要结合真实数据继续观察。"}</p>
      ${qualityView.missing?.length ? `<p>缺少：${qualityView.missing.join("、")}</p>` : ""}
      ${warnings.length ? `<p>提示：${warnings.join("；")}</p>` : ""}
      ${priceLevels.status !== "available" ? `<p>价格区间：${priceLevels.message ?? "暂不生成无依据价格。"}</p>` : ""}
    </article>`;
}

function renderDecisionBasis(stock = {}, aiAnalysis = {}, decision = {}, priceLevels = {}, quality = {}) {
  if (quality.blocked || quality.canGenerateDecision === false || quality.level === "insufficient") {
    return [
      infoCard("评分依据", "数据不足，评分已关闭。"),
      infoCard("风险依据", `缺失字段：${(quality.missingFields ?? []).join("、") || "关键字段不足"}`),
      infoCard("价格依据", priceLevels.message ?? "缺少可靠行情或高低点，不生成价格区间。"),
      infoCard("操作依据", "仅展示真实返回数据，不生成参与判断。"),
    ].join("");
  }
  const basis = decision.basis ?? aiAnalysis.evidence ?? stock.researchReport?.evidenceBasis ?? {};
  const scoreBasis = collectBasis(basis.score, basis.quote, basis.financial, stock.researchReport?.scoreBasis);
  const riskBasis = collectBasis(basis.risk, stock.researchReport?.riskBasis, basis.announcement, basis.news);
  const priceBasis = priceLevels.status === "available"
    ? priceLevels.levels.map((item) => `${item.name}：${item.basis}`)
    : [priceLevels.message ?? "暂不生成无依据价格。"];
  const operationBasis = collectBasis(basis.operation, basis.market, basis.technical, stock.researchReport?.operationBasis);
  return [
    infoCard("评分依据", scoreBasis.join("；") || "评分依据由行情、财务、新闻和市场数据共同生成。"),
    infoCard("风险依据", riskBasis.join("；") || "风险依据由公告、新闻、估值和行情波动共同生成。"),
    infoCard("价格依据", priceBasis.join("；")),
    infoCard("操作依据", operationBasis.join("；") || "操作思路只作为观察框架，不输出确定交易指令。"),
  ].join("");
}

function renderResearchDecisionChain(stock = {}, news = [], announcements = [], aiAnalysis = {}, decision = {}, aiInput = {}, quality = {}, cycle = {}) {
  const blocked = quality.blocked || quality.canGenerateDecision === false || quality.level === "insufficient";
  if (blocked) {
    return [
      infoCard("关注理由", quality.message ?? "数据不足，无法生成可靠判断。"),
      infoCard("继续关注条件", "等待真实行情、公告、新闻和财务数据补齐。"),
      infoCard("放弃条件", "关键数据继续缺失时，不生成参与判断。"),
      infoCard("短线1-5交易日", "数据不足，无法生成可靠短线判断。"),
      infoCard("中线1-4周", "数据不足，无法生成可靠中线判断。"),
      infoCard("当前机会逻辑", "数据不足，不生成机会逻辑。"),
      infoCard("最大风险", "数据不足导致判断依据不足。"),
      infoCard("关键验证点", `缺失字段：${(quality.missingFields ?? []).join("、") || "关键字段不足"}`),
    ].join("");
  }
  const attentionReasons = normalizeAttentionReasons(aiAnalysis.attentionReasons, stock, news, announcements, aiInput?.marketData);
  const observe = normalizeObserveConditions(aiAnalysis.observeConditions, stock, decision);
  const opportunityLogic = aiAnalysis.currentOpportunityLogic ?? buildLocalOpportunityLogic(stock, news, announcements, decision, aiInput?.marketData);
  const maximumRisk = aiAnalysis.maximumRisk ?? buildLocalMaximumRisk(stock, decision);
  const validationPoints = ensureAtLeast(aiAnalysis.validationPoints, buildLocalValidationPoints(stock, news, announcements, decision), 5);
  return [
    infoCard("关注理由", attentionReasons.map((item) => `${item.type}：${item.reason}（${item.source ?? "来源待补充"}）`).join("；")),
    infoCard("继续关注条件", observe.continue.join("；")),
    infoCard("放弃条件", observe.abandon.join("；")),
    infoCard("短线1-5交易日", cycle.shortTerm ?? decision.shortTerm ?? "观察成交额、价格位置和新闻催化是否延续。"),
    infoCard("中线1-4周", cycle.midTerm ?? decision.midTerm ?? "观察行业趋势、公告和财务是否继续验证。"),
    infoCard("当前机会逻辑", opportunityLogic),
    infoCard("最大风险", maximumRisk),
    infoCard("关键验证点", validationPoints.join("；")),
  ].join("");
}

function normalizeAttentionReasons(reasons, stock = {}, news = [], announcements = [], marketData = {}) {
  const values = Array.isArray(reasons) ? reasons : [];
  if (values.length) {
    return values.slice(0, 5).map((item) => typeof item === "string"
      ? { type: "依据", reason: item, source: "AI" }
      : { type: item.type ?? "依据", reason: item.reason ?? item.summary ?? "", source: item.source ?? "AI" });
  }
  const hotSector = matchHotSector(stock, marketData);
  return [
    { type: "行情", reason: `当前价${stock.price ?? empty}，涨跌幅${stock.changePercent ?? empty}，成交额${stock.amount ?? empty}。`, source: stock.quoteSource ?? stock.dataSource },
    { type: "板块", reason: hotSector ? `匹配热点板块${hotSector.name}，表现${hotSector.changePercent ?? hotSector.change ?? "待复核"}。` : `${stock.industry ?? "行业数据暂缺"}暂未匹配强热点。`, source: marketData.source ?? "市场快照" },
    { type: "新闻", reason: news[0]?.title ? `${news[0].title}，影响${normalizeImpact(news[0].impact ?? news[0].category)}。` : "本次新闻接口未返回强相关新闻。", source: news[0]?.source ?? "新闻接口" },
    { type: "公告", reason: announcements[0]?.title ? `${announcements[0].title}；${announcements[0].analysis?.factSummary ?? "需阅读公告原文。"}` : "公告接口本次未返回强相关公告。", source: announcements[0]?.source ?? "公告接口" },
  ];
}

function normalizeObserveConditions(conditions, stock = {}, decision = {}) {
  const source = conditions && typeof conditions === "object" ? conditions : {};
  const continued = asList(source.continue ?? source.continueConditions);
  const abandon = asList(source.abandon ?? source.giveUpConditions);
  if (continued.length && abandon.length) return { continue: continued, abandon };
  return {
    continue: [
      `价格和成交继续验证：当前价${stock.price ?? empty}，成交额${stock.amount ?? empty}。`,
      `${stock.industry ?? "所属行业"}热度不转弱。`,
      "新闻、公告和财务没有出现反向变化。",
    ],
    abandon: [
      "价格跌破风险区域且成交放大。",
      "板块热点退潮或资金明显转弱。",
      "公告、新闻或财务出现超预期负面变化。",
    ],
  };
}

function buildLocalOpportunityLogic(stock = {}, news = [], announcements = [], decision = {}, marketData = {}) {
  const hotSector = matchHotSector(stock, marketData);
  if (stock.securityProfile?.isNewStock) return "新股历史数据不足，只观察上市后换手、成交和公告，不生成机会结论。";
  if (stock.securityProfile?.isSt) return "ST标的以风险识别为主，短期价格波动不能替代退市、财务和流动性风险复核。";
  if (stock.assetType === "ETF") {
    return `ETF机会逻辑来自跟踪方向${stock.trackingIndex ?? stock.industry ?? empty}、成交额${stock.amount ?? empty}和板块热度${hotSector?.name ?? "待确认"}。`;
  }
  return `当前机会逻辑来自行情${stock.changePercent ?? empty}、成交额${stock.amount ?? empty}、行业${stock.industry ?? empty}、新闻${news[0]?.title ?? "待补充"}和公告${announcements[0]?.title ?? "待补充"}，当前判断为${decision.rating ?? "观察"}。`;
}

function buildLocalMaximumRisk(stock = {}, decision = {}) {
  if (stock.securityProfile?.isSt) return "最大风险是退市、财务异常和流动性风险。";
  if (stock.securityProfile?.isNewStock) return "最大风险是上市时间短、波动和换手变化过快，历史样本不足。";
  if (stock.assetType === "ETF") return "最大风险是跟踪板块热度退潮、成交萎缩或资金流出。";
  return asList(decision.risks)[0] ?? "最大风险是行情、行业、公告或新闻出现反向验证。";
}

function buildLocalValidationPoints(stock = {}, news = [], announcements = [], decision = {}) {
  return [
    `行情：价格${stock.price ?? empty}、涨跌幅${stock.changePercent ?? empty}、成交额${stock.amount ?? empty}是否延续。`,
    `板块：${stock.industry ?? "行业数据暂缺"}是否保持热度。`,
    `新闻：${news[0]?.title ?? "等待相关新闻验证"}。`,
    `公告：${announcements[0]?.title ?? "等待公司公告验证"}。`,
    `AI判断：${decision.rating ?? "观察"}是否仍与风险和数据质量匹配。`,
  ];
}

function matchHotSector(stock = {}, marketData = {}) {
  const industry = String(stock.industry ?? "");
  return (marketData?.hotSectors ?? []).find((item) => {
    const name = String(item.name ?? "");
    return industry && name && (industry.includes(name) || name.includes(industry));
  });
}

function collectBasis(...groups) {
  return groups.flatMap((group) => {
    if (Array.isArray(group)) return group;
    if (group && typeof group === "object") return Object.values(group).flatMap((item) => Array.isArray(item) ? item : [item]);
    return group ? [group] : [];
  }).filter(Boolean).slice(0, 5);
}

function linkOrText(title, link) {
  const safeTitle = escapeHtml(title || empty);
  return link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">${safeTitle}</a>` : safeTitle;
}

function renderCompanyNews(news = [], stockDetail = {}) {
  if (!news.length) {
    return `<article class="data-card"><strong>新闻接口状态</strong><p>新闻接口本次未返回记录；新闻更新时间：${stockDetail.sourceTimes?.newsUpdatedAt ?? stockDetail.updatedAt ?? empty}</p><p><b>AI解读</b>新闻数据不足，不生成虚假影响判断。</p><p><b>短期影响</b>中性：等待真实新闻返回。</p><p><b>长期影响</b>中性：需要公告、财务和行业信息共同验证。</p></article>`;
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
    <details class="timeline-row news-detail-row">
      <summary>
        <span>${item.time ?? item.date ?? stockDetail.sourceTimes?.newsUpdatedAt ?? empty}</span>
        <strong>${escapeHtml(item.title ?? empty)}</strong>
        <em>${item.source ?? "新闻"} · ${normalizeImpact(item.impact ?? item.category)}</em>
      </summary>
      <div>
        <p><b>新闻标题</b>${linkOrText(item.title, item.link)}</p>
        <p><b>来源</b>${item.source ?? "新闻"} · <b>时间</b>${item.time ?? item.date ?? stockDetail.sourceTimes?.newsUpdatedAt ?? empty}</p>
        <p><b>AI解读</b>${newsAiInterpretation(item, stockDetail)}</p>
        <p><b>短期影响</b>${normalizeImpact(item.impact ?? item.category)}：${shortTermNewsImpact(item, stockDetail)}</p>
        <p><b>长期影响</b>${normalizeLongTermImpact(item, stockDetail)}：${longTermNewsImpact(item, stockDetail)}</p>
        ${(item.relatedIndustries ?? item.relatedThemes ?? []).length ? `<p>关联方向：${(item.relatedIndustries ?? item.relatedThemes).join("、")}</p>` : ""}
      </div>
    </details>`;
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

function buildTradingPosition(stock = {}, marketData = {}, breakdown = {}) {
  const price = parseNumber(stock.price);
  const high = parseNumber(stock.highPrice);
  const low = parseNumber(stock.lowPrice);
  const change = parseNumber(stock.changePercent);
  const rangePosition = price && high && low && high > low ? (price - low) / (high - low) : null;
  const trend = stock.securityProfile?.isNewStock || !stock.dataQuality?.canGenerateTechnicalView
    ? "数据不足"
    : change >= 2 && (breakdown?.capital ?? 0) >= 12 ? "上涨趋势" : change <= -2 ? "下跌趋势" : "震荡";
  const pricePosition = rangePosition == null
    ? "数据不足"
    : rangePosition >= 0.68 ? "高位" : rangePosition <= 0.32 ? "低位" : "中位";
  const hotSectors = marketData?.hotSectors ?? [];
  const matchedSector = hotSectors.find((item) => {
    const industry = String(stock.industry ?? "");
    return industry && (String(item.name ?? "").includes(industry) || industry.includes(String(item.name ?? "")));
  });
  return {
    trend,
    pricePosition,
    industryReference: matchedSector
      ? `${stock.industry ?? "行业"}与热点板块${matchedSector.name}相关，板块表现${matchedSector.changePercent ?? matchedSector.flow ?? "待更新"}。`
      : `${stock.industry ?? "行业数据暂缺"}未与首页热点板块形成明确匹配，需继续观察行业趋势。`,
    basis: [
      `近期涨跌：今日涨跌幅${stock.changePercent ?? empty}`,
      `成交量：${stock.volume ?? empty}，${stock.volumeChange ?? "变化数据不足"}`,
      `成交额：${stock.amount ?? empty}，${stock.amountChange ?? "变化数据不足"}`,
      `日内区间：最高${stock.highPrice ?? empty}，最低${stock.lowPrice ?? empty}`,
      matchedSector ? `热点板块：${matchedSector.name}` : "热点板块：未匹配到强热点",
    ],
  };
}

function buildObservationRange(stock = {}, tradingPosition = {}, breakdown = {}) {
  if (stock.priceLevels?.status === "available") {
    return {
      watchRange: getPriceLevel(stock.priceLevels, "关注区域"),
      pressure: getPriceLevel(stock.priceLevels, "压力区域"),
      riskLine: getPriceLevel(stock.priceLevels, "风险区域"),
      status: "基于真实行情计算",
      logic: `${stock.priceLevels.message} 关注依据：${getPriceBasis(stock.priceLevels, "关注区域")}；压力依据：${getPriceBasis(stock.priceLevels, "压力区域")}；风险依据：${getPriceBasis(stock.priceLevels, "风险区域")}。`,
      valuation: stock.assetType === "ETF"
        ? "ETF重点结合跟踪方向、成交额和资金活跃度。"
        : `PE ${stock.pe ?? empty}，PB ${stock.pb ?? empty}，估值仅作辅助观察。`,
    };
  }
  if (stock.priceLevels?.status === "unavailable") {
    return {
      watchRange: "数据不足",
      pressure: "数据不足",
      riskLine: "数据不足",
      status: "不生成",
      logic: stock.priceLevels.message,
      valuation: stock.assetType === "ETF" ? "ETF按跟踪方向和流动性观察。" : "估值数据不足。",
    };
  }
  const price = parseNumber(stock.price);
  const high = parseNumber(stock.highPrice);
  const low = parseNumber(stock.lowPrice);
  const pe = stock.assetType === "ETF" ? null : parseNumber(stock.pe);
  const hasRange = price > 0 && high > 0 && low > 0 && high >= low;
  if (!hasRange) {
    return {
      watchRange: "数据不足",
      pressure: "数据不足",
      riskLine: "数据不足",
      status: "数据不足",
      logic: "当前缺少有效价格、最高价或最低价，不能生成观察区间。",
      valuation: "估值数据不足。",
    };
  }
  const buffer = Math.max(price * 0.015, (high - low) * 0.25);
  const watchLow = Math.max(low, price - buffer);
  const watchHigh = Math.min(high, price + buffer * 0.6);
  const pressure = Math.max(high, price * 1.03);
  const riskLine = Math.min(low, price * 0.96);
  return {
    watchRange: `${formatRangePrice(watchLow)}-${formatRangePrice(watchHigh)}元`,
    pressure: `${formatRangePrice(pressure)}元`,
    riskLine: `${formatRangePrice(riskLine)}元`,
    status: "基于实时行情估算",
    logic: `当前价格处于${tradingPosition.pricePosition}，趋势为${tradingPosition.trend}。观察区间按当前价、日内高低点和波动缓冲估算；若成交额继续放大且行业趋势不转弱，区间有效性更高。`,
    valuation: stock.assetType === "ETF"
      ? "ETF不使用公司PE/PB，重点结合跟踪方向、成交额和资金活跃度。"
      : `PE ${stock.pe ?? empty}，PB ${stock.pb ?? empty}${Number.isFinite(pe) && pe > 60 ? "，估值偏高时需降低追高意愿。" : "，估值仅作辅助观察。"}`,
  };
}

function getPriceLevel(priceLevels = {}, name) {
  return (priceLevels.levels ?? []).find((item) => item.name === name)?.value ?? "数据不足";
}

function getPriceBasis(priceLevels = {}, name) {
  return (priceLevels.levels ?? []).find((item) => item.name === name)?.basis ?? "缺少依据";
}

function buildHoldingCycle(stock = {}, tradingPosition = {}, decision = {}, marketData = {}) {
  const hotNames = (marketData?.hotSectors ?? []).slice(0, 3).map((item) => item.name).join("、") || "热点方向待确认";
  return {
    shortTerm: `1-5天以${tradingPosition.trend}观察为主，当前判断：${normalizeDecisionRating(decision.rating, decision.score)}。`,
    shortUp: `需要看到价格不跌破${stock.lowPrice ?? "日内低点"}，成交额${stock.amount ?? empty}维持或放大，并且${stock.industry ?? "所属行业"}不弱于市场。`,
    shortRisk: `若跌破风险位置、成交放大但价格走弱，或热点从${hotNames}快速退潮，短线判断需要降级。`,
    midTerm: `1-4周重点看行业趋势、估值和财务是否支持，适合3天-1个月的波段观察。`,
    midUp: `需要行业主线延续、公告/新闻不出现反向变化，财务和估值没有明显恶化。`,
    midRisk: `若估值过高、财务低于预期、行业景气转弱或市场成交持续缩小，中期应降低预期。`,
  };
}

function ensureAtLeast(items = [], fallback = [], count = 3) {
  const values = [...items, ...fallback].filter(Boolean);
  return [...new Set(values)].slice(0, Math.max(count, values.length));
}

function buildAiDisplayReport(stockDetail = {}, stockNews = [], aiAnalysis = {}) {
  const local = stockDetail.researchReport ?? {};
  const profile = stockDetail.securityProfile ?? {};
  if (profile.isEtf) {
    return {
      assetType: "ETF",
      trackingDirection: local.trackingDirection ?? stockDetail.trackingIndex ?? stockDetail.industry,
      trackingIndex: local.trackingIndex ?? stockDetail.trackingIndex ?? empty,
      sectorTrend: local.sectorTrend ?? `${stockDetail.industry ?? "跟踪方向"}需结合板块表现和成交活跃度观察。`,
      activity: local.activity ?? `成交额 ${stockDetail.amount ?? empty}，成交量 ${stockDetail.volume ?? empty}`,
      capitalFlow: local.capitalFlow ?? `资金表现结合涨跌幅 ${stockDetail.changePercent ?? empty} 和成交额 ${stockDetail.amount ?? empty} 观察。`,
      liquidityRisk: local.liquidityRisk ?? "关注成交萎缩、折溢价扩大和跟踪方向回落风险。",
      continuity: local.continuity ?? "持续性取决于跟踪方向热度和成交活跃度。",
      observeConditions: local.observeConditions ?? ["跟踪方向保持热度", "成交额维持活跃", "风险没有放大"],
      risks: local.risks ?? ["板块回撤", "成交萎缩", "跟踪方向热度下降"],
      summary: aiAnalysis.conclusion ?? aiAnalysis.stockAnalysis ?? local.summary ?? "ETF采用专项观察模板。",
    };
  }
  if (profile.isNewStock) {
    return {
      assetType: "新股",
      listingDate: local.listingDate ?? stockDetail.listingDate ?? empty,
      issuePrice: local.issuePrice ?? stockDetail.issuePrice ?? empty,
      firstDayPerformance: local.firstDayPerformance ?? `当前价 ${stockDetail.price ?? empty}，涨跌幅 ${stockDetail.changePercent ?? empty}。`,
      turnoverObservation: local.turnoverObservation ?? `换手率 ${stockDetail.turnoverRate ?? empty}，成交额 ${stockDetail.amount ?? empty}。`,
      activity: local.activity ?? `成交量 ${stockDetail.volume ?? empty}，成交额 ${stockDetail.amount ?? empty}。`,
      riskNotice: local.riskNotice ?? "上市时间短，历史样本不足，仅展示真实交易信息和风险限制。",
      dataLimit: local.dataLimit ?? "暂不生成等级、分数、价格区间和趋势结论。",
      risks: local.risks ?? ["波动率高", "换手快速变化", "历史数据样本不足"],
      summary: local.summary ?? "新股采用降级展示。",
    };
  }
  if (profile.isSt) {
    return {
      assetType: "ST股票",
      stRiskLevel: local.stRiskLevel ?? "高",
      delistingRisk: local.delistingRisk ?? "需优先复核退市、财务和持续经营风险。",
      financialRisk: local.financialRisk ?? `财务状态：${stockDetail.financials?.status ?? empty}。`,
      liquidityRisk: local.liquidityRisk ?? `成交额 ${stockDetail.amount ?? empty}，成交量 ${stockDetail.volume ?? empty}`,
      tradingRuleNotice: local.tradingRuleNotice ?? "受交易规则、风险警示和信息披露影响较大。",
      riskObserveConditions: local.riskObserveConditions ?? ["风险警示变化", "财务状况改善", "成交流动性稳定"],
      risks: local.risks ?? ["退市风险", "财务风险", "流动性风险", "交易规则风险"],
      summary: local.summary ?? "ST标的采用风险优先模板。",
    };
  }
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
      ? "ETF指标：重点看跟踪指数、成交活跃度和资金变化"
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
  if (stock.dataQuality?.blocked || stock.dataQuality?.level === "insufficient" || stock.financials?.hasFatalIssue) return 0;
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
  if (stock.dataQuality?.blocked || stock.dataQuality?.level === "insufficient" || stock.financials?.hasFatalIssue) return 0;
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

function normalizeLongTermImpact(item = {}, stock = {}) {
  if (stock.assetType === "ETF") return normalizeImpact(item.impact ?? item.category);
  return normalizeImpact(item.longTermImpact ?? item.impact ?? item.category);
}

function newsAiInterpretation(item = {}, stock = {}) {
  const impact = normalizeImpact(item.impact ?? item.category);
  const title = item.title ?? "该新闻";
  const target = stock.name ?? "标的";
  const text = impact === "利好"
    ? `${title}对${target}短期偏正面，但需要成交额、行业表现和后续公告验证，不能单独作为参与依据。`
    : impact === "利空"
      ? `${title}对${target}短期偏负面，需观察价格是否放量走弱，以及风险是否扩散到行业层面。`
      : `${title}对${target}影响偏中性，主要作为信息跟踪，仍需结合行情、财务和公告确认。`;
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
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

function normalizeDecisionRating(rating, score) {
  const mapped = {
    强烈关注: "重点关注",
    积极关注: "重点关注",
    中性观察: "可以观察",
    降低关注: "暂不参与",
    回避: "风险较高",
  };
  if (mapped[rating]) return mapped[rating];
  if (["重点关注", "可以观察", "等待机会", "暂不参与", "风险较高"].includes(rating)) return rating;
  const numeric = Number(score);
  if (numeric >= 78) return "重点关注";
  if (numeric >= 62) return "可以观察";
  if (numeric >= 45) return "等待机会";
  if (numeric >= 30) return "暂不参与";
  return "风险较高";
}

function normalizeAiConclusion(rating, score) {
  const text = String(rating ?? "");
  if (["关注", "等待", "谨慎观察", "风险较高"].includes(text)) return text;
  if (/风险|回避|暂不/.test(text)) return "风险较高";
  if (/等待|机会/.test(text)) return "等待";
  if (/观察|中性|谨慎/.test(text)) return "谨慎观察";
  const numeric = Number(score);
  if (Number.isFinite(numeric)) {
    if (numeric >= 75) return "关注";
    if (numeric >= 55) return "谨慎观察";
    if (numeric >= 40) return "等待";
    return "风险较高";
  }
  if (/关注/.test(text)) return "关注";
  return "谨慎观察";
}

function parseNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function formatRangePrice(value) {
  return Number.isFinite(value) ? value.toFixed(value >= 100 ? 1 : 2) : "数据不足";
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
