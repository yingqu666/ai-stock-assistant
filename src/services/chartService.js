import { aiHistory } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { getAiAccuracyStats, getAiHistoryRecords } from "./historyService.js";
import { addLog } from "./logService.js";

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

function getLocalReviewChartData() {
  const records = getAiHistoryRecords?.() ?? aiHistory ?? [];
  const stats = getAiAccuracyStats?.() ?? {};
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
