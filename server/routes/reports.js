import { Router } from "express";
import { getReports, saveAIHistory, saveReport } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";
import { generateResearchReport } from "../services/aiService.js";

export const reportRouter = Router();

reportRouter.use(requireUser);

reportRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getReports(req.user.id) });
}));

reportRouter.post("/", asyncHandler(async (req, res) => {
  const content = req.body?.content ?? (await generateResearchReport(req.body?.sourceData ?? {}));
  const report = await saveReport(req.user.id, {
    ...req.body,
    content,
    date: req.body?.date ?? new Date().toISOString().slice(0, 10),
    type: req.body?.type ?? "manual",
  });

  if (content?.marketSummary || content?.risks || content?.morning || content?.close) {
    await saveReportPredictions(req.user.id, content);
  }

  res.json({ ok: true, data: report });
}));

async function saveReportPredictions(userId, content) {
  const date = new Date().toISOString().slice(0, 10);
  const targetDate = nextDate(date);
  const base = { date, targetDate, actualResult: null, accuracyScore: null, reviewStatus: "pending" };
  const normalized = normalizeReportContent(content);

  await Promise.all([
    saveAIHistory(userId, {
      ...base,
      predictionType: "market",
      predictionContent: { summary: normalized.marketSummary, logic: normalized.coreLogic, decision: normalized.investmentDecision },
      marketPrediction: normalized.marketSummary,
    }),
    saveAIHistory(userId, {
      ...base,
      predictionType: "industry",
      predictionContent: { analysis: normalized.industryAnalysis, opportunities: normalized.opportunities, decision: normalized.investmentDecision },
      sectorPrediction: { analysis: normalized.industryAnalysis, opportunities: normalized.opportunities },
    }),
    saveAIHistory(userId, {
      ...base,
      predictionType: "stock",
      predictionContent: { analysis: normalized.stockAnalysis, decision: normalized.investmentDecision },
      stockPrediction: { analysis: normalized.stockAnalysis },
    }),
    saveAIHistory(userId, {
      ...base,
      predictionType: "risk",
      predictionContent: { risks: normalized.risks, decision: normalized.investmentDecision },
      riskPrediction: { risks: normalized.risks },
    }),
    ...normalized.watchlistAnalysis.map((item) => saveAIHistory(userId, {
      ...base,
      predictionType: "stock",
      predictionContent: {
        stock: item.name,
        code: item.code,
        rating: item.rating,
        score: item.score,
        trend: item.weekTrend,
        action: item.action,
        reasons: item.reasons ?? [],
        risks: item.risks ?? [],
      },
      stockPrediction: {
        code: item.code,
        name: item.name,
        rating: item.rating,
        score: item.score,
        trend: item.weekTrend,
        action: item.action,
      },
    })),
  ]);
}

function normalizeReportContent(content = {}) {
  const morning = content.morning ?? {};
  const close = content.close ?? {};
  return {
    investmentDecision: content.investmentDecision ?? morning.investmentDecision ?? close.investmentDecision ?? null,
    marketSummary: content.marketSummary ?? morning.marketSummary ?? close.marketSummary ?? close.performance ?? "",
    coreLogic: content.coreLogic ?? morning.riseReason ?? morning.strategy ?? close.hotAnalysis ?? "",
    industryAnalysis: content.industryAnalysis ?? close.hotAnalysis ?? "",
    stockAnalysis: content.stockAnalysis ?? (morning.watchFocus ?? []).join("、"),
    opportunities: content.opportunities ?? morning.focus ?? close.nextFocus ?? [],
    risks: content.risks ?? morning.risks ?? [],
    watchlistAnalysis: morning.watchlistAnalysis ?? close.watchlistAnalysis ?? [],
  };
}

function nextDate(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}
