import { runReportTask } from "./reportScheduler.js";
import { syncReports } from "./syncService.js";

export async function getReportCenterData() {
  const synced = await syncReports();
  const reports = synced.data;
  if (reports.length) return { reports, selectedReport: reports[0], syncStatus: synced.status };

  const generated = await runReportTask("报告中心自动生成");
  const saved = (await syncReports()).data;
  return { reports: saved, selectedReport: saved[0] ?? generated, syncStatus: "已生成本地报告" };
}

export function getReportQuality(report) {
  const quality = report.content?.morning?.quality ?? report.content?.close?.quality;
  return {
    score: quality?.score ?? report.score ?? 80,
    dataCompleteness: quality?.dataCompleteness ?? "部分",
    newsCount: quality?.newsCount ?? 0,
  };
}

export function reportToMarkdown(report) {
  const morning = report.content?.morning;
  const close = report.content?.close;
  return `# AI投资研究报告

- 日期：${report.date}
- 类型：${report.type}
- 生成时间：${report.generatedAt ?? report.createdAt ?? ""}

## 市场总结
${close?.summary ?? close?.performance ?? report.content?.marketSummary ?? "暂无"}

## 热点分析
${(close?.hotSectors ?? report.content?.opportunities ?? []).map((item) => `- ${item}`).join("\n")}

## 股票分析
${(close?.nextFocus ?? []).map((item) => `- ${item}`).join("\n") || report.content?.stockAnalysis || "暂无"}

## 风险提醒
${(morning?.risks ?? report.content?.risks ?? []).map((item) => `- ${typeof item === "string" ? item : item.message}`).join("\n")}

## 明日计划
${(close?.nextFocus ?? report.content?.tomorrowPlan ?? []).map((item) => `- ${item}`).join("\n")}
`;
}

export function downloadText(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportReportMarkdown(report) {
  downloadText(`AI投资研究报告-${report.date}.md`, reportToMarkdown(report), "text/markdown;charset=utf-8");
}

export function exportReportPdf(report) {
  const html = `<html><head><meta charset="utf-8"><title>AI投资研究报告</title></head><body><pre>${escapeHtml(reportToMarkdown(report))}</pre></body></html>`;
  downloadText(`AI投资研究报告-${report.date}.html`, html, "text/html;charset=utf-8");
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
