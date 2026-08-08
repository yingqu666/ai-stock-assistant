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
    { label: "今日涨跌", value: stockDetail.changeAmount ?? "暂无", change: stockDetail.changePercent ?? "暂无" },
    { label: "市值", value: stockDetail.marketCap ?? "暂无", change: stockDetail.industry ?? "行业" },
    { label: "PE / PB", value: `${stockDetail.pe ?? "暂无"} / ${stockDetail.pb ?? "暂无"}`, change: stockDetail.listingDate ?? "上市时间待补充" },
  ];

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>股票查询</h2>
          <span>支持 A股代码、股票名称、拼音简称，例如 600519 / 贵州茅台 / GZMT</span>
        </div>
      </div>
      <form class="stock-search stock-query-form">
        <input name="stockQuery" value="${stockDetail.code ?? ""}" aria-label="股票代码、名称或拼音简称" placeholder="例如：600519、贵州茅台、GZMT" />
        <button type="submit">查询股票</button>
      </form>
      <p id="stock-query-message" class="form-message">
        数据来源：${stockDetail.dataSource ?? stockDetail.quoteSource ?? "未知"} · 更新时间：${stockDetail.updatedAt ?? "暂无"} · 状态：${stockDetail.dataStatus ?? "部分真实"}
      </p>
      <div class="section-head compact">
        <h2>${stockDetail.name ?? "未选择股票"} ${stockDetail.code ?? ""}</h2>
        <span>${stockDetail.industry ?? "行业待补充"} · ${stockDetail.companyName ?? stockDetail.name ?? ""}</span>
      </div>
      <div class="metrics">${quoteMetrics.map(metricCard).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>股票基础信息</h2><span>${stockDetail.industry ?? "行业待补充"}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>公司名称</strong><p>${stockDetail.companyName ?? stockDetail.name ?? "待补充"}</p></article>
        <article class="data-card"><strong>公司简介</strong><p>${stockDetail.profile ?? "基础资料待补充，当前已优先展示行情数据。"}</p></article>
        <article class="data-card"><strong>主营业务</strong><p>${stockDetail.mainBusiness ?? "待接入年报和公告数据。"}</p></article>
        <article class="data-card"><strong>行业地位</strong><p>${stockDetail.industryPosition ?? "待结合行业数据继续观察。"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>财务指标与估值</h2><span>营收、利润、盈利能力和估值区间</span></div>
      <div class="metrics">
        ${[
          { label: "营收", value: financials.revenue ?? "待接财报", change: "财务" },
          { label: "净利润", value: financials.netProfit ?? "待接财报", change: "财务" },
          { label: "毛利率", value: financials.grossMargin ?? "待接财报", change: "盈利" },
          { label: "ROE", value: financials.roe ?? "待接财报", change: "回报" },
          { label: "历史PE范围", value: valuation.pe ?? "待接入", change: "估值" },
          { label: "历史PB范围", value: valuation.pb ?? "待接入", change: "估值" },
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
      <div class="section-head"><h2>股票事件记录</h2><span>事件服务统一结构</span></div>
      ${timelineList(stockEvents.map((item) => ({ date: item.date, title: item.event, impact: `${item.analysis} · ${item.level}` })))}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>个股研究报告</h2><span>研究结论只做机会观察和风险提示</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>1. 公司基本情况</strong><p>${report.company ?? `${stockDetail.name ?? ""} 基础资料待继续补充。`}</p></article>
        <article class="data-card"><strong>2. 所属行业分析</strong><p>${report.industry ?? "需结合行业景气度、政策和资金方向观察。"}</p></article>
        <article class="data-card"><strong>3. 核心竞争力</strong><p>${report.moat ?? "需从主营业务、客户结构、盈利能力继续验证。"}</p></article>
        <article class="data-card"><strong>4. 最近涨跌原因</strong><p>${report.moveReason ?? "需结合板块、指数和成交量综合判断。"}</p></article>
        <article class="data-card"><strong>5. 最新新闻影响</strong><p>${newsImpact}</p></article>
        <article class="data-card"><strong>6. 资金情况</strong><p>${report.capitalFlow ?? `成交额 ${stockDetail.amount ?? "暂无"}，资金情况仅作观察。`}</p></article>
        <article class="data-card"><strong>7. 技术走势</strong><p>${report.technicalTrend ?? `涨跌幅 ${stockDetail.changePercent ?? "暂无"}，短线观察量价配合。`}</p></article>
        <article class="data-card"><strong>8. 风险因素</strong><p>${(report.risks ?? aiAnalysis.risks ?? []).join("；") || "关注估值、业绩和行业波动风险。"}</p></article>
        <article class="data-card"><strong>9. AI综合评分</strong><p>${report.aiScore ?? aiAnalysis.score ?? "待评分"} 分，仅代表研究关注度。</p></article>
        <article class="data-card"><strong>10. 投资观察总结</strong><p>${report.summary ?? aiAnalysis.stockAnalysis ?? aiAnalysis.stockAdvice ?? "当前仅作为研究观察，不输出明确买卖建议。"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI分析区域</h2><span>${aiAnalysis.source ?? "AI/fallback"}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>市场总结</strong><p>${aiAnalysis.summary ?? aiAnalysis.marketSummary ?? "暂无"}</p></article>
        <article class="data-card"><strong>个股分析</strong><p>${aiAnalysis.stockAdvice ?? aiAnalysis.stockAnalysis ?? "暂无"}</p></article>
        <article class="data-card"><strong>关注方向</strong><p>${(aiAnalysis.opportunities ?? []).join("、") || "暂无"}</p></article>
      </div>
      <p class="answer">${(aiAnalysis.risks ?? []).join("；")}</p>
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
      if (message) message.textContent = "请输入股票代码、名称或拼音简称。";
      return;
    }
    selectStock(query);
    rerender();
  });
}
