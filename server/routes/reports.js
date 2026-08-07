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

  if (content?.marketSummary || content?.risks) {
    await saveReportPredictions(req.user.id, content);
  }

  res.json({ ok: true, data: report });
}));

async function saveReportPredictions(userId, content) {
  const date = new Date().toISOString().slice(0, 10);
  const targetDate = nextDate(date);
  const base = { date, targetDate, actualResult: null, accuracyScore: null, reviewStatus: "pending" };

  await Promise.all([
    saveAIHistory(userId, {
      ...base,
      predictionType: "market",
      predictionContent: { summary: content.marketSummary ?? "", logic: content.coreLogic ?? "" },
      marketPrediction: content.marketSummary ?? "",
    }),
    saveAIHistory(userId, {
      ...base,
      predictionType: "industry",
      predictionContent: { analysis: content.industryAnalysis ?? "", opportunities: content.opportunities ?? [] },
      sectorPrediction: { analysis: content.industryAnalysis ?? "", opportunities: content.opportunities ?? [] },
    }),
    saveAIHistory(userId, {
      ...base,
      predictionType: "stock",
      predictionContent: { analysis: content.stockAnalysis ?? "" },
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

function nextDate(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}
