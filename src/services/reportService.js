import { runReportTask } from "./reportScheduler.js";
import { syncReports } from "./syncService.js";

export async function getReportCenterData({ query = "" } = {}) {
  const synced = await syncReports();
  let reports = normalizeReports(synced.data ?? []);
  if (!reports.length) {
    const generated = await runReportTask("报告中心自动生成");
    reports = normalizeReports([generated, ...((await syncReports()).data ?? [])]);
  }
  const keyword = String(query ?? "").trim();
  const filteredReports = keyword ? reports.filter((report) => JSON.stringify(report).includes(keyword)) : reports;
  return {
    reports: filteredReports,
    allReports: reports,
    selectedReport: filteredReports[0] ?? reports[0],
    syncStatus: synced.status,
  };
}

export function normalizeReports(reports) {
  const seen = new Set();
  return (reports ?? [])
    .filter(Boolean)
    .map(normalizeReport)
    .filter((report) => {
      if (seen.has(report.id)) return false;
      seen.add(report.id);
      return true;
    })
    .sort((a, b) => String(b.generatedAt ?? b.date).localeCompare(String(a.generatedAt ?? a.date)));
}

export function normalizeReport(report) {
  const content = report.content ?? {};
  const morning = content.morning ?? {};
  const close = content.close ?? {};
  const quality = getReportQuality(report);
  return {
    ...report,
    id: String(report.id ?? `${report.date}-${report.type ?? "report"}`),
    date: report.date ?? morning.date ?? close.date ?? new Date().toISOString().slice(0, 10),
    type: report.type ?? "日报",
    title: report.title ?? "AI投资研究日报",
    generatedAt: report.generatedAt ?? content.generatedAt ?? morning.generatedAt ?? close.generatedAt ?? "",
    marketState: report.marketState ?? morning.marketState ?? "观察",
    score: report.score ?? morning.score ?? quality.score,
    mainView: report.mainView ?? morning.strategy ?? close.summary ?? "暂无主要观点",
    content: {
      ...content,
      morning,
      close,
    },
    sourceData: report.sourceData ?? morning.sources ?? close.sources ?? ["东方财富行情", "新闻接口/公告", "AI分析"],
  };
}

export function getReportQuality(report = {}) {
  const quality = report.content?.morning?.quality ?? report.content?.close?.quality;
  return {
    score: quality?.score ?? report.score ?? 80,
    dataCompleteness: quality?.dataCompleteness ?? "部分完整",
    newsCount: quality?.newsCount ?? 0,
  };
}

export function reportToMarkdown(report) {
  const normalized = normalizeReport(report);
  const morning = normalized.content.morning;
  const close = normalized.content.close;
  return `# AI投资研究报告

- 日期：${normalized.date}
- 类型：${normalized.type}
- AI评分：${normalized.score}
- 市场状态：${normalized.marketState}
- 生成时间：${normalized.generatedAt}
- 数据来源：${normalized.sourceData.join("、")}

## 今日市场总结
${close.marketSummary ?? close.summary ?? morning.marketSummary ?? "暂无"}

## 上涨原因
${morning.riseReason ?? "暂无"}

## 下跌风险
${morning.downsideRisk ?? (morning.risks ?? []).join("；") ?? "暂无"}

## 热点板块
${(close.hotSectors ?? morning.focus ?? []).map((item) => `- ${item}`).join("\n") || "暂无"}

## 关注方向
${(morning.focus ?? []).map((item) => `- ${item}`).join("\n") || "暂无"}

## 明日观察
${(close.nextFocus ?? morning.tomorrowPlan ?? []).map((item) => `- ${item}`).join("\n") || "暂无"}

## 仓位建议
${morning.positionAdvice ?? close.positionAdvice ?? "保持观察，不输出确定买卖建议。"}
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
