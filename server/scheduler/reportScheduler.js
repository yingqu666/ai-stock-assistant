import cron from "node-cron";
import { createUser, getAIHistory, getInvestmentJournal, getKnowledge, getPortfolio, getReports, getSettings, getWatchlist, saveAIHistory, saveReport } from "../db/store.js";
import { generateResearchReport } from "../services/aiService.js";
import { reviewUserAIHistory } from "../services/aiReviewService.js";
import { collectReportSourceData } from "../services/dataCollector.js";

const systemPhone = "10000000000";
const systemUserId = `u_${systemPhone}`;
const schedulerState = {
  startedAt: null,
  lastMorningAt: null,
  lastCloseAt: null,
  lastReviewAt: null,
  lastError: "",
};

export function startReportScheduler() {
  schedulerState.startedAt = new Date().toISOString();

  cron.schedule("0 8 * * *", () => runScheduledReport("morning").catch(recordSchedulerError), {
    timezone: process.env.TZ ?? "Asia/Shanghai",
  });

  cron.schedule("0 20 * * *", () => runScheduledReport("close").catch(recordSchedulerError), {
    timezone: process.env.TZ ?? "Asia/Shanghai",
  });

  cron.schedule("0 21 * * *", () => runReviewTask().catch(recordSchedulerError), {
    timezone: process.env.TZ ?? "Asia/Shanghai",
  });
}

export function getSchedulerStatus() {
  return {
    ...schedulerState,
    enabled: process.env.ENABLE_SCHEDULER !== "false",
    timezone: process.env.TZ ?? "Asia/Shanghai",
    tasks: [
      { time: "08:00", name: "早盘报告", status: schedulerState.lastMorningAt ? "已运行" : "等待" },
      { time: "20:00", name: "收盘复盘", status: schedulerState.lastCloseAt ? "已运行" : "等待" },
      { time: "21:00", name: "AI判断复盘", status: schedulerState.lastReviewAt ? "已运行" : "等待" },
    ],
  };
}

export async function runScheduledReport(type) {
  await createUser(systemPhone);
  const [watchlist, portfolio, investmentProfile, historyReports, aiHistory, knowledge, journal] = await Promise.all([
    getWatchlist(systemUserId),
    getPortfolio(systemUserId),
    getSettings(systemUserId),
    getReports(systemUserId),
    getAIHistory(systemUserId),
    getKnowledge(systemUserId),
    getInvestmentJournal(systemUserId),
  ]);

  const sourceData = await collectReportSourceData({
    type,
    watchlist,
    portfolio,
    investmentProfile,
    historyReports,
    aiHistory,
    knowledge,
    journal,
  });
  const content = await generateResearchReport(sourceData);
  const report = await saveReport(systemUserId, {
    type,
    date: new Date().toISOString().slice(0, 10),
    score: scoreScheduledReport(content, sourceData),
    content,
    sourceData,
  });
  await saveReportPredictions(systemUserId, content);

  if (type === "morning") schedulerState.lastMorningAt = new Date().toISOString();
  if (type === "close") schedulerState.lastCloseAt = new Date().toISOString();
  schedulerState.lastError = "";
  return report;
}

export async function runReviewTask() {
  await createUser(systemPhone);
  const result = await reviewUserAIHistory(systemUserId);
  schedulerState.lastReviewAt = new Date().toISOString();
  schedulerState.lastError = "";
  return result;
}

async function saveReportPredictions(userId, content) {
  const date = new Date().toISOString().slice(0, 10);
  const targetDate = nextDate(date);
  const base = { date, targetDate, actualResult: null, accuracyScore: null, reviewStatus: "pending" };

  await Promise.all([
    saveAIHistory(userId, {
      ...base,
      predictionType: "market",
      predictionContent: { summary: content.marketSummary ?? "", logic: content.coreLogic ?? "", evidence: content.evidence?.market ?? [] },
      marketPrediction: content.marketSummary ?? "",
    }),
    saveAIHistory(userId, {
      ...base,
      predictionType: "industry",
      predictionContent: { analysis: content.industryAnalysis ?? "", opportunities: content.opportunities ?? [], evidence: content.evidence?.industry ?? [] },
      sectorPrediction: { analysis: content.industryAnalysis ?? "", opportunities: content.opportunities ?? [] },
    }),
    saveAIHistory(userId, {
      ...base,
      predictionType: "stock",
      predictionContent: { analysis: content.stockAnalysis ?? "", evidence: content.evidence?.stock ?? [] },
      stockPrediction: { analysis: content.stockAnalysis ?? "" },
    }),
    saveAIHistory(userId, {
      ...base,
      predictionType: "risk",
      predictionContent: { risks: content.risks ?? [] },
      riskPrediction: { risks: content.risks ?? [] },
    }),
  ]);
}

function scoreScheduledReport(content, sourceData) {
  let score = 60;
  if (content.evidence?.market?.length) score += 10;
  if (sourceData.marketData?.source && sourceData.marketData.source !== "fallback") score += 10;
  if ((sourceData.newsData ?? []).length) score += 5;
  if ((content.risks ?? []).length) score += 10;
  if ((content.tomorrowPlan ?? []).length) score += 5;
  return Math.min(100, score);
}

function recordSchedulerError(error) {
  schedulerState.lastError = error.message;
  console.error("[scheduler-error]", error);
}

function nextDate(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}
