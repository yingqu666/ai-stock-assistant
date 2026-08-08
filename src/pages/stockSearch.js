import { metricCard, riskCard } from "../components/cards.js";
import { timelineList } from "../components/lists.js";
import { getStockSearchData, selectStock } from "../services/mockService.js";

const empty = "\u6682\u65e0";

export async function renderStockSearch() {
  const { stockDetail, stockNews, stockEvents, aiAnalysis } = await getStockSearchData();
  const financials = stockDetail.financials ?? {};
  const valuation = stockDetail.valuationRange ?? {};
  const report = stockDetail.researchReport ?? {};
  const announcements = stockDetail.announcements ?? [];
  const newsImpact = report.newsImpact
    ?? (stockNews.map((item) => `${item.title}\uff1a${item.impact}`).slice(0, 2).join("\uff1b") || "\u6682\u65e0\u91cd\u5927\u65b0\u95fb\u53d8\u5316\u3002");

  const quoteMetrics = [
    { label: "\u5f53\u524d\u4ef7\u683c", value: stockDetail.price ?? empty, change: stockDetail.changePercent ?? empty },
    { label: "\u6da8\u8dcc\u5e45", value: stockDetail.changePercent ?? empty, change: stockDetail.changeAmount ?? empty },
    { label: "\u6210\u4ea4\u989d", value: stockDetail.amount ?? empty, change: stockDetail.volume ?? "\u6210\u4ea4\u91cf\u6682\u65e0" },
    { label: "\u6362\u624b\u7387", value: stockDetail.turnoverRate ?? empty, change: stockDetail.market ?? "\u5e02\u573a\u5f85\u8865\u5145" },
    { label: stockDetail.assetType === "ETF" ? "\u89c4\u6a21" : "\u5e02\u503c", value: stockDetail.fundScale ?? stockDetail.marketCap ?? empty, change: stockDetail.industry ?? "\u884c\u4e1a\u5f85\u8865\u5145" },
    { label: "PE / PB", value: `${stockDetail.pe ?? empty} / ${stockDetail.pb ?? empty}`, change: stockDetail.valuationStatus ?? "\u4f30\u503c\u5f85\u89c2\u5bdf" },
  ];

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>\u80a1\u7968\u67e5\u8be2</h2>
          <span>\u652f\u6301A\u80a1\u548cETF\uff0c\u8f93\u5165\u4ee3\u7801\u3001\u540d\u79f0\u3001\u7b80\u79f0\u6216\u62fc\u97f3\uff0c\u4f8b\u5982 600176 / 512760 / AI</span>
        </div>
      </div>
      <form class="stock-search stock-query-form">
        <input name="stockQuery" value="${escapeHtml(stockDetail.code ?? "")}" aria-label="\u80a1\u7968\u6216ETF\u4ee3\u7801\u3001\u540d\u79f0\u3001\u7b80\u79f0\u6216\u62fc\u97f3" placeholder="\u4f8b\u5982\uff1a600176\u3001512760\u3001\u8d35\u5dde\u8305\u53f0\u3001GZMT\u3001AI" />
        <button type="submit">\u67e5\u8be2</button>
      </form>
      <p id="stock-query-message" class="form-message">
        \u6570\u636e\u6765\u6e90\uff1a${stockDetail.dataSource ?? "\u672a\u77e5"} | \u66f4\u65b0\u65f6\u95f4\uff1a${stockDetail.updatedAt ?? empty} | \u72b6\u6001\uff1a${stockDetail.dataStatus ?? "\u90e8\u5206\u771f\u5b9e"} | \u7c7b\u578b\uff1a${stockDetail.assetType ?? "\u80a1\u7968"}
      </p>
      <div class="section-head compact">
        <h2>${stockDetail.name ?? "\u672a\u9009\u62e9\u6807\u7684"} ${stockDetail.code ?? ""}</h2>
        <span>${stockDetail.market ?? "\u5e02\u573a\u5f85\u8865\u5145"} | ${stockDetail.industry ?? "\u884c\u4e1a\u5f85\u8865\u5145"} | ${stockDetail.companyName ?? stockDetail.name ?? ""}</span>
      </div>
      <div class="metrics">${quoteMetrics.map(metricCard).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>\u57fa\u7840\u8d44\u6599</h2><span>\u516c\u53f8\u57fa\u7840\u3001\u4e3b\u8425\u4e1a\u52a1\u548c\u884c\u4e1a\u4f4d\u7f6e</span></div>
      <div class="detail-grid">
        ${infoCard("\u540d\u79f0", stockDetail.name)}
        ${infoCard("\u4ee3\u7801", stockDetail.code)}
        ${infoCard("\u6240\u5c5e\u5e02\u573a", stockDetail.market)}
        ${infoCard("\u6240\u5c5e\u884c\u4e1a", stockDetail.industry)}
        ${infoCard("\u4e0a\u5e02\u65f6\u95f4", stockDetail.listingDate)}
        ${infoCard("\u516c\u53f8\u7b80\u4ecb", stockDetail.profile)}
        ${infoCard("\u4e3b\u8425\u4e1a\u52a1", stockDetail.mainBusiness)}
        ${infoCard("\u884c\u4e1a\u5730\u4f4d", stockDetail.industryPosition)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>\u5e02\u573a\u6570\u636e\u4e0e\u8d22\u52a1</h2><span>\u884c\u60c5\u3001\u6210\u4ea4\u3001\u4f30\u503c\u548c\u8d22\u52a1\u6307\u6807</span></div>
      <div class="metrics">
        ${[
          { label: "\u8425\u6536", value: financials.revenue ?? "\u5f85\u63a5\u8d22\u62a5", change: financials.revenueYoY ? `\u540c\u6bd4 ${financials.revenueYoY}` : "\u8d22\u52a1" },
          { label: "\u51c0\u5229\u6da6", value: financials.netProfit ?? "\u5f85\u63a5\u8d22\u62a5", change: financials.netProfitYoY ? `\u540c\u6bd4 ${financials.netProfitYoY}` : "\u8d22\u52a1" },
          { label: "\u6bdb\u5229\u7387", value: financials.grossMargin ?? "\u5f85\u63a5\u8d22\u62a5", change: "\u76c8\u5229" },
          { label: "ROE", value: financials.roe ?? "\u5f85\u63a5\u8d22\u62a5", change: "\u56de\u62a5" },
          { label: "\u8d44\u4ea7\u8d1f\u503a\u7387", value: financials.debtRatio ?? "\u5f85\u63a5\u8d22\u62a5", change: "\u8d1f\u503a" },
          { label: "\u7ecf\u8425\u73b0\u91d1\u6d41", value: financials.cashFlow ?? "\u5f85\u63a5\u8d22\u62a5", change: financials.source ?? "\u8d22\u52a1" },
          { label: "\u8d22\u62a5\u671f", value: financials.reportDate ?? "\u5f85\u63a5\u8d22\u62a5", change: financials.updatedAt ?? "\u6682\u65e0\u66f4\u65b0\u65f6\u95f4" },
          { label: "\u5386\u53f2PE\u8303\u56f4", value: valuation.pe ?? "\u5f85\u63a5\u5165", change: "\u4f30\u503c" },
          { label: "\u5386\u53f2PB\u8303\u56f4", value: valuation.pb ?? "\u5f85\u63a5\u5165", change: "\u4f30\u503c" },
          { label: "\u4f30\u503c\u72b6\u6001", value: stockDetail.valuationStatus ?? "\u5f85\u89c2\u5bdf", change: stockDetail.dataStatus ?? "\u72b6\u6001" },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>\u516c\u53f8\u516c\u544a</h2><span>\u516c\u544a\u3001\u8d22\u62a5\u3001\u80a1\u4e1c\u53d8\u5316\u548c\u91cd\u5927\u4e8b\u9879</span></div>
      ${announcements.length ? announcements.map((item) => `
        <article class="timeline-row">
          <span>${item.date ?? empty}</span>
          <div>
            <strong>${linkOrText(item.title, item.link)}</strong>
            <p>${item.source ?? "\u516c\u544a"} | ${item.type ?? "\u516c\u544a"} | \u6d89\u53ca\u80a1\u7968\uff1a${item.relatedStock ?? stockDetail.code ?? empty} | \u65b9\u5411\uff1a${item.analysis?.direction ?? item.impact ?? "\u4e2d\u6027"}</p>
            <p>\u4e8b\u4ef6\uff1a${item.analysis?.event ?? item.title}</p>
            <p>\u5f71\u54cd\uff1a${item.analysis?.impact ?? item.impact ?? "\u5f85\u89c2\u5bdf"}</p>
            <p>\u98ce\u9669\uff1a${item.analysis?.risk ?? "\u9700\u9605\u8bfb\u516c\u544a\u539f\u6587\u5e76\u7ed3\u5408\u8d22\u52a1\u548c\u884c\u60c5\u9a8c\u8bc1\u3002"}</p>
          </div>
        </article>
      `).join("") : `<article class="data-card"><strong>\u6682\u65e0\u516c\u544a</strong><p>\u5f53\u524d\u516c\u544a\u63a5\u53e3\u672a\u8fd4\u56de\u6570\u636e\uff0c\u9875\u9762\u4fdd\u6301fallback\u663e\u793a\u3002</p></article>`}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>\u65b0\u95fb\u65f6\u95f4\u7ebf</h2><span>\u516c\u53f8\u3001\u884c\u4e1a\u548c\u653f\u7b56\u6d88\u606f</span></div>
      ${stockNews.map((item) => `
        <article class="timeline-row">
          <span>${item.time ?? item.date ?? empty}</span>
          <div>
            <strong>${linkOrText(item.title, item.link)}</strong>
            <p>${item.source ?? "\u65b0\u95fb"} | ${item.category ?? "\u65b0\u95fb"} | \u5f71\u54cd\uff1a${item.impact ?? "\u4e2d\u6027"}</p>
          </div>
        </article>
      `).join("") || `<article class="data-card"><strong>\u6682\u65e0\u65b0\u95fb</strong><p>\u540e\u7eed\u53ef\u63a5\u5165\u5de8\u6f6e\u3001\u8d22\u8054\u793e\u548c\u4e2d\u56fd\u65b0\u95fb\u7f51\u589e\u5f3a\u3002</p></article>`}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>\u80a1\u7968\u4e8b\u4ef6\u8bb0\u5f55</h2><span>\u516c\u544a\u3001\u65b0\u95fb\u548c\u8ddf\u8e2a\u4e8b\u4ef6</span></div>
      ${timelineList((stockEvents.length ? stockEvents : stockDetail.timeline ?? []).map((item) => ({ date: item.date, title: item.event ?? item.title, impact: item.analysis ?? item.impact ?? item.level })))}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI\u4e2a\u80a1\u7814\u7a76\u62a5\u544a</h2><span>\u53ea\u505a\u673a\u4f1a\u89c2\u5bdf\u548c\u98ce\u9669\u63d0\u793a\uff0c\u4e0d\u8f93\u51fa\u786e\u5b9a\u4e70\u5356\u7ed3\u8bba</span></div>
      <div class="detail-grid">
        ${infoCard("1. \u516c\u53f8\u57fa\u672c\u60c5\u51b5", report.company)}
        ${infoCard("2. \u6240\u5c5e\u884c\u4e1a\u5206\u6790", report.industry)}
        ${infoCard("3. \u6838\u5fc3\u7ade\u4e89\u529b", report.moat)}
        ${infoCard("4. \u5f53\u524d\u70ed\u70b9\u5173\u8054", report.hotspotRelation ?? stockDetail.hotspotRelation)}
        ${infoCard("5. \u4e0a\u6da8\u56e0\u7d20", (report.upFactors ?? []).join("\uff1b"))}
        ${infoCard("6. \u4e0b\u8dcc\u98ce\u9669", (report.downsideRisks ?? report.risks ?? []).join("\uff1b"))}
        ${infoCard("7. \u6700\u65b0\u65b0\u95fb\u5f71\u54cd", newsImpact)}
        ${infoCard("8. \u8d44\u91d1\u60c5\u51b5", report.capitalFlow)}
        ${infoCard("9. \u6280\u672f\u8d8b\u52bf", report.technicalTrend)}
        ${infoCard("10. AI\u7efc\u5408\u8bc4\u4ef7", `${report.aiScore ?? aiAnalysis.score ?? "\u5f85\u8bc4\u5206"} \u5206\u3002${report.summary ?? "\u5f53\u524d\u53ea\u4f5c\u7814\u7a76\u89c2\u5bdf\u3002"}`)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI\u5206\u6790\u533a\u57df</h2><span>${aiAnalysis.source ?? "AI/fallback"}</span></div>
      <div class="detail-grid">
        ${infoCard("\u5e02\u573a\u603b\u7ed3", aiAnalysis.summary ?? aiAnalysis.marketSummary)}
        ${infoCard("\u4e2a\u80a1\u5206\u6790", aiAnalysis.stockAdvice ?? aiAnalysis.stockAnalysis)}
        ${infoCard("\u5173\u6ce8\u65b9\u5411", (aiAnalysis.opportunities ?? []).join("\uff1b"))}
      </div>
      <p class="answer">${(aiAnalysis.risks ?? []).join("\uff1b")}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>\u6570\u636e\u53ef\u4fe1\u5ea6</h2><span>\u6765\u6e90\u3001\u66f4\u65b0\u65f6\u95f4\u548cfallback\u72b6\u6001</span></div>
      <div class="detail-grid">
        ${infoCard("\u6570\u636e\u6765\u6e90", stockDetail.dataSource)}
        ${infoCard("\u66f4\u65b0\u65f6\u95f4", stockDetail.updatedAt)}
        ${infoCard("\u6570\u636e\u72b6\u6001", stockDetail.dataStatus)}
        ${infoCard("\u8d22\u52a1\u72b6\u6001", financials.status ?? "\u90e8\u5206\u771f\u5b9e")}
        ${infoCard("\u8d22\u52a1\u6765\u6e90", financials.source)}
        ${infoCard("\u8d22\u52a1\u53ef\u4fe1\u5ea6", `${financials.credibility?.level ?? "\u4e2d"}\uff1a${financials.credibility?.reason ?? "\u9700\u7ed3\u5408\u516c\u544a\u539f\u6587\u590d\u6838"}`)}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>\u98ce\u9669\u63d0\u793a</h2></div>
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
      if (message) message.textContent = "\u8bf7\u8f93\u5165\u80a1\u7968/ETF\u4ee3\u7801\u3001\u540d\u79f0\u3001\u7b80\u79f0\u6216\u62fc\u97f3\u3002";
      return;
    }
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
