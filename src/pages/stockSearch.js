import { metricCard, riskCard } from "../components/cards.js";
import { timelineList } from "../components/lists.js";
import { getStockSearchData, selectStock } from "../services/mockService.js";

export async function renderStockSearch() {
  const { stockDetail, stockNews, stockEvents, aiAnalysis } = await getStockSearchData();
  const quoteMetrics = [
    { label: "当前价格", value: stockDetail.price ?? "暂无", change: stockDetail.changePercent ?? "暂无" },
    { label: "今日涨跌", value: stockDetail.changeAmount ?? "暂无", change: stockDetail.changePercent ?? "暂无" },
    { label: "成交额", value: stockDetail.amount ?? "暂无", change: stockDetail.quoteSource ?? "数据源" },
    { label: "市值", value: stockDetail.marketCap ?? "暂无", change: stockDetail.industry ?? "行业" },
  ];

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>股票查询</h2>
          <span>支持A股代码和股票名称，优先使用东方财富真实行情</span>
        </div>
      </div>
      <form class="stock-search stock-query-form">
        <input name="stockQuery" value="${stockDetail.code ?? ""}" aria-label="股票代码或名称" placeholder="例如：600519、贵州茅台、宁德时代" />
        <button type="submit">查询股票</button>
      </form>
      <p id="stock-query-message" class="form-message">数据来源：${stockDetail.quoteSource ?? "未知"} · 更新时间：${stockDetail.updatedAt ?? "暂无"}</p>
      <div class="section-head compact"><h2>${stockDetail.name} ${stockDetail.code}</h2><span>${stockDetail.industry} · ${stockDetail.quoteSource ?? "数据源"}</span></div>
      <div class="metrics">${quoteMetrics.map(metricCard).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>股票基础信息</h2><span>${stockDetail.industry}</span></div>
      <article class="data-card"><strong>公司简介</strong><p>${stockDetail.profile ?? "基础资料待补充，当前已优先展示真实行情数据。"}</p></article>
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
      <div class="section-head"><h2>AI分析区域</h2><span>${aiAnalysis.source ?? "AI/fallback"}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>市场总结</strong><p>${aiAnalysis.summary ?? aiAnalysis.marketSummary}</p></article>
        <article class="data-card"><strong>个股分析</strong><p>${aiAnalysis.stockAdvice ?? aiAnalysis.stockAnalysis}</p></article>
        <article class="data-card"><strong>关注方向</strong><p>${(aiAnalysis.opportunities ?? []).join("、")}</p></article>
      </div>
      <p class="answer">${(aiAnalysis.risks ?? []).join("；")}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>个股研究报告</h2><span>公司、行业、公告、新闻、逻辑和风险</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>公司</strong><p>${stockDetail.name}：${stockDetail.profile ?? "基础资料待补充。"}</p></article>
        <article class="data-card"><strong>行业</strong><p>${stockDetail.industry}，需要结合产业链景气度和资金方向观察。</p></article>
        <article class="data-card"><strong>近期公告</strong><p>${stockNews.find((item) => String(item.category).includes("公告"))?.title ?? "暂无重大公告。"}</p></article>
        <article class="data-card"><strong>新闻影响</strong><p>${stockNews.map((item) => `${item.title}：${item.impact}`).slice(0, 2).join("；") || "暂无新闻变化。"}</p></article>
        <article class="data-card"><strong>投资逻辑</strong><p>${aiAnalysis.stockAnalysis ?? aiAnalysis.stockAdvice}</p></article>
        <article class="data-card"><strong>注意事项</strong><p>${(aiAnalysis.risks ?? []).join("；")}</p></article>
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
      if (message) message.textContent = "请输入股票代码或名称。";
      return;
    }
    selectStock(query);
    rerender();
  });
}
