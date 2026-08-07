import { exportReportMarkdown, exportReportPdf, getReportCenterData, getReportQuality } from "../services/reportService.js";

let selectedReportId = null;

export async function renderReportCenter() {
  const { reports, selectedReport } = await getReportCenterData();
  const active = reports.find((item) => item.id === selectedReportId) ?? selectedReport;
  const quality = getReportQuality(active);

  return `
    <section class="wide-section">
      <div class="section-head"><h2>报告中心</h2><span>历史日报、详情和导出</span></div>
      <div class="table">
        ${reports.map((report) => {
          const itemQuality = getReportQuality(report);
          return `<div class="table-row report-select-row" data-report-id="${report.id}"><b>${report.date}<small>${report.type}</small></b><span>${itemQuality.score}分</span><span>${itemQuality.dataCompleteness}</span><em>${report.generatedAt}</em></div>`;
        }).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head">
        <div><h2>报告详情</h2><span>${active.date}｜评分 ${quality.score}分｜数据完整度 ${quality.dataCompleteness}</span></div>
        <div class="row-actions">
          <button id="export-md-button" class="secondary-button" type="button">Markdown导出</button>
          <button id="export-pdf-button" class="secondary-button" type="button">PDF导出</button>
        </div>
      </div>
      <div class="detail-grid">
        <article class="data-card"><strong>市场总结</strong><p>${active.content?.close?.summary ?? active.content?.close?.performance ?? "暂无"}</p></article>
        <article class="data-card"><strong>热点分析</strong><p>${active.content?.close?.hotSectors?.join("、") ?? "暂无"}</p></article>
        <article class="data-card"><strong>股票分析</strong><p>${active.content?.close?.nextFocus?.join("、") ?? "暂无"}</p></article>
      </div>
      <div class="split-section compact">
        <div class="sub-panel"><h2>风险提醒</h2>${(active.content?.morning?.risks ?? []).map((item) => `<article class="list-row risk"><span>${typeof item === "string" ? item : item.message}</span></article>`).join("")}</div>
        <div class="sub-panel"><h2>明日计划</h2>${(active.content?.close?.nextFocus ?? []).map((item) => `<article class="list-row"><span>${item}</span></article>`).join("")}</div>
      </div>
    </section>`;
}

export function mountReportCenter({ rerender }) {
  document.querySelectorAll("[data-report-id]").forEach((row) => {
    row.addEventListener("click", () => {
      selectedReportId = row.dataset.reportId;
      rerender();
    });
  });
  document.querySelector("#export-md-button")?.addEventListener("click", async () => {
    const { reports, selectedReport } = await getReportCenterData();
    exportReportMarkdown(reports.find((item) => item.id === selectedReportId) ?? selectedReport);
  });
  document.querySelector("#export-pdf-button")?.addEventListener("click", async () => {
    const { reports, selectedReport } = await getReportCenterData();
    exportReportPdf(reports.find((item) => item.id === selectedReportId) ?? selectedReport);
  });
}
