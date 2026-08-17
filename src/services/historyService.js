import { aiHistory } from "../data.js";
import { getHistory, saveHistory } from "./storageService.js";

export async function getAiHistoryRecords() {
  const saved = await getHistory();
  return [...saved, ...aiHistory];
}

export async function saveAiHistoryRecord(record) {
  return saveHistory({ ...record, id: record.id ?? `${Date.now()}` });
}

export async function saveMarketAnalysisHistory(aiAnalysis = {}, marketData = {}, newsSnapshot = {}) {
  const date = todayKey();
  const sentiment = marketData.marketSentiment ?? {};
  const hotSectors = (marketData.hotSectors ?? []).slice(0, 12);
  const risks = normalizeRiskTexts(aiAnalysis.riskReminders ?? aiAnalysis.risks);
  const mainDirections = normalizeDirectionTexts(aiAnalysis.mainDirections ?? aiAnalysis.hotDirections);
  return saveAiHistoryRecord({
    id: `market-analysis-${date}`,
    date,
    targetDate: nextDateKey(date),
    predictionType: "market",
    prediction: {
      marketDirection: aiAnalysis.currentMarketJudgment ?? aiAnalysis.investmentDecision?.marketTrend ?? aiAnalysis.marketSummary ?? "市场判断待补充",
      sectors: mainDirections.map((item) => item.name ?? item).filter(Boolean).slice(0, 6),
      risks: risks.map((item) => item.target ? `${item.target}：${item.reason ?? ""}` : String(item)).filter(Boolean).slice(0, 6),
    },
    predictionContent: {
      marketState: aiAnalysis.currentMarketJudgment ?? aiAnalysis.investmentDecision?.marketTrend ?? "市场判断待补充",
      mainDirections,
      riskDirections: risks,
      operationPlan: aiAnalysis.operationPlan ?? aiAnalysis.observationAdvice ?? "等待市场数据进一步确认",
      aiSource: aiAnalysis.source ?? "fallback",
      marketSnapshotSummary: buildMarketSnapshotSummary(marketData),
      evidence: aiAnalysis.evidence ?? aiAnalysis.conclusionBasis ?? {},
      newsSource: newsSnapshot.source,
    },
    marketPrediction: aiAnalysis.currentMarketJudgment ?? aiAnalysis.marketSummary ?? "",
    actualResult: null,
    accuracyScore: null,
    reviewStatus: "pending",
    source: aiAnalysis.source ?? "fallback",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function getMarketAnalysisHistory() {
  const records = await getAiHistoryRecords();
  return records
    .filter((item) => (item.predictionType ?? item.prediction_type) === "market" && (item.id?.startsWith?.("market-analysis-") || item.predictionContent?.operationPlan))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

export async function getAiAccuracyStats() {
  const records = await getAiHistoryRecords();
  const total = records.length || 1;
  const marketCorrect = records.filter((item) => isMarketCorrect(item)).length;
  const riskEffective = records.filter((item) => item.actualResult?.riskVerified).length;

  return {
    sampleSize: records.length,
    marketAccuracy: Math.round((marketCorrect / total) * 100),
    riskAccuracy: Math.round((riskEffective / total) * 100),
  };
}

function isMarketCorrect(item) {
  const prediction = item.prediction?.marketDirection ?? "";
  const result = item.actualResult?.marketMove ?? "";
  if (prediction.includes("强") && result.includes("涨")) return true;
  if (prediction.includes("震荡") && result.includes("震荡")) return true;
  if (prediction.includes("弱") && result.includes("跌")) return true;
  return false;
}

function todayKey() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function nextDateKey(date) {
  const next = new Date(`${date}T00:00:00+08:00`);
  next.setDate(next.getDate() + 1);
  return next.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function buildMarketSnapshotSummary(marketData = {}) {
  const sentiment = marketData.marketSentiment ?? {};
  const overview = marketData.marketOverview ?? [];
  return {
    updatedAt: marketData.updatedAt,
    source: marketData.source,
    dataStatus: marketData.dataStatus,
    indexes: overview.slice(0, 4).map((item) => `${item.label}:${item.value}${item.change ? `(${item.change})` : ""}`),
    breadth: {
      upCount: sentiment.upCount,
      downCount: sentiment.downCount,
      flatCount: sentiment.flatCount,
      limitUpCount: sentiment.limitUpCount,
      limitDownCount: sentiment.limitDownCount,
      turnover: sentiment.turnover,
      moneyEffect: sentiment.moneyEffect,
    },
    hotSectors: (marketData.hotSectors ?? []).slice(0, 12).map((item) => ({
      name: item.name,
      changePercent: item.changePercent ?? item.change,
      amount: item.amount ?? item.turnover,
      heatRank: item.heatRank ?? item.rank,
    })),
  };
}

function normalizeDirectionTexts(items = []) {
  return (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, 6).map((item) => {
    if (typeof item === "string") return { name: item, reason: item };
    return {
      name: item.name ?? "主线方向",
      reason: item.reason ?? item.catalyst ?? item.summary ?? "依据待补充",
      sustainability: item.sustainability ?? "待复核",
      risk: item.risk ?? "热点退潮或成交缩量",
    };
  });
}

function normalizeRiskTexts(items = []) {
  return (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, 6).map((item) => {
    if (typeof item === "string") return { target: "市场", reason: item };
    return {
      target: item.target ?? "市场",
      reason: item.reason ?? item.message ?? item.summary ?? "风险原因待补充",
      shortTermImpact: item.shortTermImpact,
      midTermImpact: item.midTermImpact,
    };
  });
}
