import { aiHistory } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { getAiAccuracyStats, getAiHistoryRecords } from "./historyService.js";
import { addLog } from "./logService.js";
import { getMarketSnapshot } from "./marketService.js";
import { getSavedReports } from "./reportScheduler.js";
import { getWatchlistSnapshot } from "./stockService.js";

export async function getReviewChartData() {
  try {
    const result = await cloudDataApi.getAiReviewStats();
    return normalizeStats(result.data ?? {});
  } catch (error) {
    addLog({
      module: "ai-review",
      status: "failed",
      mode: "fallback",
      source: "chartService",
      message: "AI复盘统计云端读取失败，已使用本地缓存",
      error: error.message,
    });
    return getLocalReviewChartData();
  }
}

export async function getReviewDetailData(selectedDate) {
  const [reports, marketData, watchlist, chartData] = await Promise.all([
    getSavedReports(),
    getMarketSnapshot(),
    getWatchlistSnapshot(),
    getReviewChartData(),
  ]);
  const normalizedReports = (reports ?? []).map((report) => ({
    ...report,
    date: report.date ?? report.content?.morning?.date ?? "",
  }));
  const dates = [...new Set([
    ...normalizedReports.map((report) => report.date),
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean))].sort((a, b) => String(b).localeCompare(String(a)));
  const date = selectedDate ?? dates[0];
  const report = normalizedReports.find((item) => item.date === date) ?? normalizedReports[0];
  const close = report?.content?.close ?? {};
  const morning = report?.content?.morning ?? {};
  const marketSummary = close.marketSummary ?? close.summary ?? morning.marketSummary ?? marketData.marketSentiment?.summary ?? "暂无市场记录";
  const hotSectors = close.hotSectors ?? morning.focus ?? (marketData.hotSectors ?? []).map((item) => item.name);
  const aiView = morning.strategy ?? close.summary ?? report?.mainView ?? "暂无AI观点";
  const review = buildReviewConclusion({ report, marketData, hotSectors });

  return {
    ...chartData,
    dates,
    selectedDate: date,
    detail: {
      date,
      report,
      marketSummary,
      breadth: close.breadth ?? `上涨 ${marketData.marketSentiment?.upCount ?? "未知"} 家，下跌 ${marketData.marketSentiment?.downCount ?? "未知"} 家`,
      hotSectors,
      watchlistPerformance: watchlist.slice(0, 6).map((item) => ({
        name: item.name,
        code: item.code,
        changePercent: item.changePercent ?? item.change ?? "暂无",
        industry: item.industry ?? "待补充",
      })),
      aiView,
      reviewConclusion: review.conclusion,
      reviewReason: review.reason,
      source: ["历史日报", "东方财富行情", "自选股行情", "AI复盘"],
      updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    },
  };
}

export async function runAiReview(payload = {}) {
  try {
    const result = await cloudDataApi.runAiReview(payload);
    return result.data;
  } catch (error) {
    addLog({
      module: "ai-review",
      status: "failed",
      mode: "fallback",
      source: "chartService",
      message: "AI复盘任务执行失败",
      error: error.message,
    });
    return {
      reviewedCount: 0,
      stats: await getReviewChartData(),
      error: error.message,
    };
  }
}

async function getLocalReviewChartData() {
  const records = await getAiHistoryRecords?.() ?? aiHistory ?? [];
  const stats = await getAiAccuracyStats?.() ?? {};
  const reviewed = records.filter((item) => item.actualResult || item.reviewStatus);

  return normalizeStats({
    sampleSize: reviewed.length || records.length,
    windows: buildWindowStats(reviewed),
    byType: {
      market: { count: reviewed.length, accuracy: stats.marketAccuracy ?? 0 },
      risk: { count: reviewed.length, accuracy: stats.riskAccuracy ?? 0, effectiveRate: stats.riskAccuracy ?? 0 },
    },
    byIndustry: buildIndustryStats(reviewed),
    recent: reviewed.map((item) => ({
      date: item.date,
      predictionType: item.predictionType ?? item.prediction_type ?? "market",
      predictionContent: item.predictionContent ?? item.prediction_content ?? {},
      actualResult: item.actualResult ?? item.actual_result,
      accuracyScore: Number(item.accuracyScore ?? item.accuracy_score ?? 0),
      reviewStatus: item.reviewStatus ?? item.review_status ?? "pending",
      reviewNote: item.reviewNote ?? item.review_note ?? "",
    })),
    source: "local-fallback",
  });
}

function normalizeStats(stats) {
  const recent = Array.isArray(stats.recent) ? stats.recent : [];
  const byType = stats.byType ?? {};
  const windows = stats.windows ?? {};
  const byIndustry = stats.byIndustry ?? {};
  const marketAccuracy = byType.market?.accuracy ?? windows["30"]?.accuracy ?? 0;
  const riskAccuracy = byType.risk?.effectiveRate ?? byType.risk?.accuracy ?? 0;

  return {
    stats: {
      sampleSize: stats.sampleSize ?? recent.length,
      marketAccuracy,
      riskAccuracy,
      credibilityScore: stats.credibilityScore ?? 0,
      confidenceLevel: stats.confidenceLevel ?? "低",
    },
    windows: {
      "30": windows["30"] ?? { count: 0, accuracy: 0 },
      "60": windows["60"] ?? { count: 0, accuracy: 0 },
      "90": windows["90"] ?? { count: 0, accuracy: 0 },
    },
    byType,
    byIndustry,
    thirtyDays: recent.slice(0, 30).map((item) => ({
      label: item.date ?? item.targetDate ?? "-",
      marketScore: Number(item.accuracyScore ?? 0) / 100,
      riskScore: (item.predictionType ?? item.prediction_type) === "risk" ? Number(item.accuracyScore ?? 0) / 100 : 0,
    })),
    riskCount: byType.risk?.count ?? 0,
    sectorResults: recent.slice(0, 12).map((item) => ({
      date: item.date ?? item.targetDate ?? "-",
      sectors: extractSectors(item),
      result: statusText(item.reviewStatus ?? item.review_status),
    })),
    recent,
    source: stats.source ?? "cloud",
  };
}

function buildReviewConclusion({ report, marketData, hotSectors }) {
  if (!report) {
    return {
      conclusion: "暂无历史报告，无法复盘当时判断。",
      reason: "请先生成AI日报，系统会保存当时观点用于后续复盘。",
    };
  }
  const state = marketData.strategy?.state ?? marketData.marketSentiment?.summary ?? "";
  const hasHotSector = hotSectors?.length > 0;
  if (String(state).includes("强") || hasHotSector) {
    return {
      conclusion: "部分正确",
      reason: "当时报告提到的关注方向仍有热点延续，但需要结合成交额和自选股表现继续验证。",
    };
  }
  return {
    conclusion: "待验证",
    reason: "当前缺少完整次日行情对照，暂时只记录逻辑是否完整，不做确定性结论。",
  };
}

function extractSectors(item) {
  const content = item.predictionContent ?? item.prediction_content ?? item.sectorPrediction ?? {};
  const opportunities = content.opportunities ?? content.sectors ?? [];
  if (Array.isArray(opportunities) && opportunities.length) return opportunities.slice(0, 3);
  if (String(content.analysis ?? "").includes("半导体")) return ["半导体"];
  if (String(content.analysis ?? "").includes("新能源")) return ["新能源"];
  return ["市场"];
}

function statusText(status) {
  if (status === "correct") return "正确";
  if (status === "partial") return "部分正确";
  if (status === "wrong") return "错误";
  return "待复盘";
}

function buildWindowStats(records) {
  return [30, 60, 90].reduce((result, days) => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const scoped = records.filter((item) => new Date(item.date ?? item.targetDate ?? item.target_date) >= since);
    result[String(days)] = summarize(scoped);
    return result;
  }, {});
}

function buildIndustryStats(records) {
  return ["AI", "半导体", "新能源"].reduce((result, industry) => {
    const scoped = records.filter((item) => JSON.stringify(item).includes(industry));
    result[industry] = summarize(scoped);
    return result;
  }, {});
}

function summarize(records) {
  if (!records.length) return { count: 0, accuracy: 0, effectiveRate: 0 };
  const accuracy = Math.round(records.reduce((sum, item) => sum + Number(item.accuracyScore ?? item.accuracy_score ?? 0), 0) / records.length);
  return { count: records.length, accuracy, effectiveRate: accuracy };
}
