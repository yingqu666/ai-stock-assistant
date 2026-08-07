import { aiHistory } from "../data.js";
import { getHistory, saveHistory } from "./storageService.js";

export async function getAiHistoryRecords() {
  const saved = await getHistory();
  return [...saved, ...aiHistory];
}

export async function saveAiHistoryRecord(record) {
  return saveHistory({ ...record, id: record.id ?? `${Date.now()}` });
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
