import { Router } from "express";
import { getAIFeedback, getAIHistory, getPortfolio, getReports, getSettings, saveAIFeedback, saveAIHistory, saveReport } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";
import { answerInvestmentQuestion, buildReportTemplate, generateResearchReport, getAiCallLogs, getAiRuntimeStatus, runResearchTeam } from "../services/aiService.js";
import { buildReflection } from "../services/aiReviewService.js";

export const aiRouter = Router();

aiRouter.use(requireUser);

aiRouter.get("/status", asyncHandler(async (_req, res) => {
  res.json({ ok: true, data: getAiRuntimeStatus() });
}));

aiRouter.get("/logs", asyncHandler(async (_req, res) => {
  res.json({ ok: true, data: getAiCallLogs() });
}));

aiRouter.post("/report", asyncHandler(async (req, res) => {
  const input = await buildUserAiInput(req.user.id, req.body ?? {});
  const report = await generateResearchReport(input);
  const saved = await saveReport(req.user.id, {
    type: req.body?.type ?? "ai-report",
    score: scoreReport(report),
    content: { ...report, template: buildReportTemplate(report) },
    sourceData: input,
  });
  await saveReportPredictions(req.user.id, report);
  res.json({ ok: true, data: saved, report });
}));

aiRouter.post("/ask", asyncHandler(async (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) {
    res.status(400).json({ ok: false, message: "问题不能为空" });
    return;
  }
  const input = await buildUserAiInput(req.user.id, req.body?.context ?? {});
  const answer = await answerInvestmentQuestion(question, input);
  res.json({ ok: true, data: answer });
}));

aiRouter.post("/feedback", asyncHandler(async (req, res) => {
  const saved = await saveAIFeedback(req.user.id, req.body ?? {});
  res.json({ ok: true, data: saved });
}));

aiRouter.get("/feedback", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getAIFeedback(req.user.id) });
}));

aiRouter.post("/research-team", asyncHandler(async (req, res) => {
  const input = await buildUserAiInput(req.user.id, req.body ?? {});
  const workflow = await runResearchTeam(input);
  res.json({ ok: true, data: workflow });
}));

async function buildUserAiInput(userId, extra) {
  const [portfolio, historyReports, settings, aiHistory] = await Promise.all([
    getPortfolio(userId),
    getReports(userId),
    getSettings(userId),
    getAIHistory(userId),
  ]);

  const structured = {
    marketData: extra.marketData ?? {},
    stockData: extra.stockData ?? extra.stockQuote ?? {},
    newsData: extra.newsData ?? extra.newsEvents ?? [],
    portfolio: extra.portfolio ?? portfolio,
    investmentProfile: extra.investmentProfile ?? settings ?? {},
    historyReports: extra.historyReports ?? historyReports,
    aiHistory: extra.aiHistory ?? aiHistory,
    historicalReflection: buildReflection(aiHistory, { investmentProfile: extra.investmentProfile ?? settings ?? {} }),
    riskData: extra.riskData ?? [],
  };
  return { ...structured, aiInputSummary: buildAiInputSummary(structured) };
}

function buildAiInputSummary(input) {
  const market = input.marketData ?? {};
  const stock = input.stockData ?? {};
  return {
    market: {
      indexes: market.marketOverview ?? market.indexes ?? [],
      turnover: findMetric(market.marketOverview, "成交"),
      breadth: { up: market.marketSentiment?.upCount, down: market.marketSentiment?.downCount },
      sentiment: market.marketSentiment?.summary,
    },
    industry: {
      hotSectors: market.hotSectors ?? [],
      policyNews: (input.newsData ?? []).filter((item) => String(item.category ?? "").includes("政策")),
    },
    stock: {
      code: stock.code,
      name: stock.name,
      price: stock.price,
      changePercent: stock.changePercent,
      amount: stock.amount,
      announcements: (input.newsData ?? []).filter((item) => String(item.category ?? "").includes("公告")),
    },
    user: {
      portfolio: input.portfolio ?? [],
      preference: input.investmentProfile,
      riskLevel: input.investmentProfile?.riskLevel,
    },
    history: {
      reports: (input.historyReports ?? []).slice(0, 10),
      aiHistory: (input.aiHistory ?? []).slice(0, 30),
    },
  };
}

async function saveReportPredictions(userId, report) {
  const date = new Date().toISOString().slice(0, 10);
  const targetDate = nextDate(date);
  const base = { date, targetDate, actualResult: null, accuracyScore: null, reviewStatus: "pending" };
  await Promise.all([
    saveAIHistory(userId, { ...base, predictionType: "market", predictionContent: { summary: report.marketSummary, logic: report.coreLogic, evidence: report.evidence?.market ?? [] }, marketPrediction: report.marketSummary }),
    saveAIHistory(userId, { ...base, predictionType: "industry", predictionContent: { analysis: report.industryAnalysis, opportunities: report.opportunities ?? [], evidence: report.evidence?.industry ?? [] }, sectorPrediction: { analysis: report.industryAnalysis, opportunities: report.opportunities ?? [] } }),
    saveAIHistory(userId, { ...base, predictionType: "stock", predictionContent: { analysis: report.stockAnalysis, evidence: report.evidence?.stock ?? [] }, stockPrediction: { analysis: report.stockAnalysis } }),
    saveAIHistory(userId, { ...base, predictionType: "risk", predictionContent: { risks: report.risks ?? [] }, riskPrediction: { risks: report.risks ?? [] } }),
  ]);
}

function scoreReport(report) {
  let score = 60;
  if (report.marketSummary) score += 8;
  if (report.industryAnalysis) score += 8;
  if (report.stockAnalysis) score += 8;
  if ((report.risks ?? []).length) score += 8;
  if ((report.tomorrowPlan ?? []).length) score += 8;
  return Math.min(100, score);
}

function findMetric(metrics = [], keyword) {
  return metrics.find((item) => String(item.label ?? "").includes(keyword)) ?? null;
}

function nextDate(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}
