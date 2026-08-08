import { metricCard, riskCard } from "../components/cards.js";
import { timelineList } from "../components/lists.js";
import { getStockSearchData, selectStock } from "../services/mockService.js";

export async function renderStockSearch() {
  const { stockDetail, stockNews, stockEvents, aiAnalysis } = await getStockSearchData();
  const financials = stockDetail.financials ?? {};
  const valuation = stockDetail.valuationRange ?? {};
  const report = stockDetail.researchReport ?? {};
  const newsImpact = report.newsImpact ?? (stockNews.map((item) => `${item.title}：${item.impact}`).slice(0, 2).join("；") || "暂无重大新闻变化。");
  const quoteMetrics = [
    { label: "当前价格", value: stockDetail.price ?? "暂无", change: stockDetail.changePercent ?? "暂无" },
    { label: "涨跌幅", value: stockDetail.changePercent ?? "暂无", change: stockDetail.changeAmount ?? "暂无" },
    { label: "成交额", value: stockDetail.amount ?? "暂无", change: stockDetail.volume ?? "成交量暂无" },
    { label: "换手率", value: stockDetail.turnoverRate ?? "暂无", change: stockDetail.market ?? "市场待补充" },
    { label: "市值", value: stockDetail.marketCap ?? "暂无", change: stockDetail.industry ?? "行业待补充" },
    { label: "PE / PB", value: `${stockDetail.pe ?? "暂无"} / ${stockDetail.pb ?? "暂无"}`, change: stockDetail.valuationStatus ?? "估值待观察" },
  ];

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>股票查询</h2>
          <span>支持A股和ETF，输入代码、名称、简称或拼音，例如 600176 / 512760 / AI</span>
        </div>
      </div>
      <form class="stock-search stock-query-form">
        <input name="stockQuery" value="${stockDetail.code ?? ""}" aria-label="股票或ETF代码、名称、简称或拼音" placeholder="例如：600176、512760、贵州茅台、GZMT、AI" />
        <button type="submit">查询</button>
      </form>
      <p id="stock-query-message" class="form-message">
        数据来源：${stockDetail.dataSource ?? stockDetail.quoteSource ?? "未知"} · 更新时间：${stockDetail.updatedAt ?? "暂无"} · 状态：${stockDetail.dataStatus ?? "部分真实"} · 类型：${stockDetail.assetType ?? "股票"}
      </p>
      <div class="section-head compact">
        <h2>${stockDetail.name ?? "未选择标的"} ${stockDetail.code ?? ""}</h2>
        <span>${stockDetail.market ?? "市场待补充"} · ${stockDetail.industry ?? "行业待补充"} · ${stockDetail.companyName ?? stockDetail.name ?? ""}</span>
      </div>
      <div class="metrics">${quoteMetrics.map(metricCard).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>公司基础</h2><span>基础资料、主营业务和行业位置</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>股票名称</strong><p>${stockDetail.name ?? "待补充"}</p></article>
        <article class="data-card"><strong>股票代码</strong><p>${stockDetail.code ?? "待补充"}</p></article>
        <article class="data-card"><strong>所属市场</strong><p>${stockDetail.market ?? "待补充"}</p></article>
        <article class="data-card"><strong>所属行业</strong><p>${stockDetail.industry ?? "待补充"}</p></article>
        <article class="data-card"><strong>上市时间</strong><p>${stockDetail.listingDate ?? "待补充"}</p></article>
        <article class="data-card"><strong>公司简介</strong><p>${stockDetail.profile ?? "基础资料待补充。"}</p></article>
        <article class="data-card"><strong>主营业务</strong><p>${stockDetail.mainBusiness ?? "待接入年报和公告数据。"}</p></article>
        <article class="data-card"><strong>行业地位</strong><p>${stockDetail.industryPosition ?? "待结合行业数据继续观察。"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>市场数据与估值</h2><span>行情、成交、估值和财务指标</span></div>
      <div class="metrics">
        ${[
          { label: "营收", value: financials.revenue ?? "待接财报", change: "财务" },
          { label: "净利润", value: financials.netProfit ?? "待接财报", change: "财务" },
          { label: "毛利率", value: financials.grossMargin ?? "待接财报", change: "盈利" },
          { label: "ROE", value: financials.roe ?? "待接财报", change: "回报" },
          { label: "历史PE范围", value: valuation.pe ?? "待接入", change: "估值" },
          { label: "历史PB范围", value: valuation.pb ?? "待接入", change: "估值" },
          { label: "估值状态", value: stockDetail.valuationStatus ?? "待观察", change: stockDetail.dataStatus ?? "状态" },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>新闻时间线</h2><span>公司、行业、政策消息</span></div>
      ${stockNews.map((item) => `
        <article class="timeline-row">
          <span>${item.time}</span>
          <div>
            <strong>${item.title}</strong>
            <p>${item.source} · ${item.category} · 影响：${item.impact}</p>
          </div>
        </article>
      `).join("") || `<article class="data-card"><strong>暂无新闻</strong><p>后续可接入公告和新闻源增强。</p></article>`}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>股票事件记录</h2><span>公告、新闻和跟踪事件</span></div>
      ${timelineList((stockEvents.length ? stockEvents : stockDetail.timeline ?? []).map((item) => ({ date: item.date, title: item.event ?? item.title, impact: item.analysis ?? item.impact ?? item.level })))}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI研究报告</h2><span>只做机会观察和风险提示，不输出确定买卖结论</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>1. 公司基本情况</strong><p>${report.company ?? "基础资料待继续补充。"}</p></article>
        <article class="data-card"><strong>2. 所属行业分析</strong><p>${report.industry ?? "需结合行业景气、政策和资金方向观察。"}</p></article>
        <article class="data-card"><strong>3. 公司竞争力</strong><p>${report.moat ?? "需从主营业务、客户结构、盈利能力继续验证。"}</p></article>
        <article class="data-card"><strong>4. 当前热点关联</strong><p>${report.hotspotRelation ?? stockDetail.hotspotRelation ?? "热点关联待进一步确认。"}</p></article>
        <article class="data-card"><strong>5. 上涨因素</strong><p>${(report.upFactors ?? []).join("；") || "行业景气、资金关注和事件催化可能带来观察价值。"}</p></article>
        <article class="data-card"><strong>6. 下跌风险</strong><p>${(report.downsideRisks ?? report.risks ?? []).join("；") || "关注估值、行业波动和事件落空风险。"}</p></article>
        <article class="data-card"><strong>7. 最新新闻影响</strong><p>${newsImpact}</p></article>
        <article class="data-card"><strong>8. 资金变化</strong><p>${report.capitalFlow ?? `成交额 ${stockDetail.amount ?? "暂无"}，资金情况仅作观察。`}</p></article>
        <article class="data-card"><strong>9. 技术趋势</strong><p>${report.technicalTrend ?? `涨跌幅 ${stockDetail.changePercent ?? "暂无"}，短线观察量价配合。`}</p></article>
        <article class="data-card"><strong>10. AI综合评价</strong><p>${report.aiScore ?? aiAnalysis.score ?? "待评分"} 分。${report.summary ?? "当前只作为研究观察，不构成明确买卖建议。"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI分析区域</h2><span>${aiAnalysis.source ?? "AI/fallback"}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>市场总结</strong><p>${aiAnalysis.summary ?? aiAnalysis.marketSummary ?? "暂无"}</p></article>
        <article class="data-card"><strong>个股分析</strong><p>${aiAnalysis.stockAdvice ?? aiAnalysis.stockAnalysis ?? "暂无"}</p></article>
        <article class="data-card"><strong>关注方向</strong><p>${(aiAnalysis.opportunities ?? []).join("；") || "暂无"}</p></article>
      </div>
      <p class="answer">${(aiAnalysis.risks ?? []).join("；")}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>数据可信度</h2><span>来源、更新时间和fallback状态</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>数据来源</strong><p>${stockDetail.dataSource ?? "未知"}</p></article>
        <article class="data-card"><strong>更新时间</strong><p>${stockDetail.updatedAt ?? "暂无"}</p></article>
        <article class="data-card"><strong>数据状态</strong><p>${stockDetail.dataStatus ?? "部分真实"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>风险提示</h2></div>
      ${(stockDetail.riskTips ?? []).map(riskCard).join("")}
    </section>`;
}

export function mountStockSearch({ rerender }) {
  const form = document.querySelector(".stock-query-form");
  const message = document.querySelector("#stock-query-message");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const query = String(formData.get("stockQuery") ?? "").trim();
    if (!query) {
      if (message) message.textContent = "请输入股票/ETF代码、名称、简称或拼音。";
      return;
    }
    selectStock(query);
    rerender();
  });
}
