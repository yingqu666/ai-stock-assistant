import { exportReportMarkdown, exportReportPdf, getReportCenterData, getReportQuality } from "../services/reportService.js";

let selectedReportId = null;
let reportSearchQuery = "";

export async function renderReportCenter() {
  const { reports, selectedReport, syncStatus } = await getReportCenterData({ query: reportSearchQuery });
  const active = reports.find((item) => item.id === selectedReportId) ?? selectedReport;
  const quality = getReportQuality(active);
  const morning = active?.content?.morning ?? {};
  const close = active?.content?.close ?? {};

  return `
    <section class="wide-section">
      <div class="section-head">
        <div><h2>报告中心</h2><span>历史日报、详情、搜索和导出</span></div>
        <span class="notice">${syncStatus ?? "本地/云端"}</span>
      </div>
      <form class="stock-search report-search-form">
        <input name="query" value="${reportSearchQuery}" placeholder="搜索日期、市场状态、板块或观点" />
        <button type="submit">搜索报告</button>
      </form>
      <div class="table">
        ${reports.map((report) => {
          const itemQuality = getReportQuality(report);
          return `<div class="table-row report-select-row" data-report-id="${report.id}"><b>${report.date}<small>${report.type}</small></b><span>${report.marketState}</span><span>${itemQuality.score}分</span><em>${report.mainView}</em></div>`;
        }).join("") || `<div class="table-row"><b>暂无报告</b><span>请先生成AI日报</span><em>待生成</em></div>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head">
        <div><h2>报告详情</h2><span>${active?.date ?? "暂无"} · 评分${quality.score}分 · 数据完整度${quality.dataCompleteness}</span></div>
        <div class="row-actions">
          <button id="export-md-button" class="secondary-button" type="button">Markdown导出</button>
          <button id="export-pdf-button" class="secondary-button" type="button">PDF导出</button>
        </div>
      </div>
      <div class="detail-grid">
        <article class="data-card"><strong>市场总结</strong><p>${close.marketSummary ?? close.summary ?? morning.marketSummary ?? "暂无"}</p></article>
        <article class="data-card"><strong>上涨原因</strong><p>${morning.riseReason ?? "暂无"}</p></article>
        <article class="data-card"><strong>下跌风险</strong><p>${morning.downsideRisk ?? (morning.risks ?? []).join("；") ?? "暂无"}</p></article>
        <article class="data-card"><strong>热点分析</strong><p>${close.hotAnalysis ?? (close.hotSectors ?? []).join("、") ?? "暂无"}</p></article>
        <article class="data-card"><strong>关注方向</strong><p>${(morning.focus ?? []).join("、") || "暂无"}</p></article>
        <article class="data-card"><strong>明日观察</strong><p>${(close.nextFocus ?? morning.tomorrowPlan ?? []).join("、") || "暂无"}</p></article>
        <article class="data-card"><strong>仓位建议</strong><p>${morning.positionAdvice ?? close.positionAdvice ?? "保持观察，不输出确定买卖建议。"}</p></article>
        <article class="data-card"><strong>数据来源</strong><p>${(active?.sourceData ?? morning.sources ?? close.sources ?? []).join("、") || "暂无"} · 更新时间：${active?.generatedAt ?? "暂无"}</p></article>
      </div>
    </section>`;
}

export function mountReportCenter({ rerender }) {
  document.querySelector(".report-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    reportSearchQuery = String(formData.get("query") ?? "").trim();
    selectedReportId = null;
    rerender();
  });

  document.querySelectorAll("[data-report-id]").forEach((row) => {
    row.addEventListener("click", () => {
      selectedReportId = row.dataset.reportId;
      rerender();
    });
  });
  document.querySelector("#export-md-button")?.addEventListener("click", async () => {
    const { reports, selectedReport } = await getReportCenterData({ query: reportSearchQuery });
    exportReportMarkdown(reports.find((item) => item.id === selectedReportId) ?? selectedReport);
  });
  document.querySelector("#export-pdf-button")?.addEventListener("click", async () => {
    const { reports, selectedReport } = await getReportCenterData({ query: reportSearchQuery });
    exportReportPdf(reports.find((item) => item.id === selectedReportId) ?? selectedReport);
  });
}
