import { Router } from "express";
import { getAIFeedback, getAIHistory, getPortfolio, getReports, getSettings, saveAIFeedback, saveAIHistory, saveReport } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";
import { answerInvestmentQuestion, buildReportTemplate, generateFallbackResearchReport, generateMarketAnalysis, generateResearchReport, getAiCallLogs, getAiRuntimeStatus, runResearchTeam } from "../services/aiService.js";
import { buildReflection } from "../services/aiReviewService.js";
import { getResearchData } from "../services/researchDataService.js";

export const aiRouter = Router();

aiRouter.get("/status", asyncHandler(async (_req, res) => {
  res.json({ ok: true, data: getAiRuntimeStatus() });
}));

aiRouter.get("/provider-status", asyncHandler(async (_req, res) => {
  const status = getAiRuntimeStatus();
  res.json({
    provider: status.provider,
    enabled: status.mode === "api" && status.hasApiKey,
    keyConfigured: status.hasApiKey,
    model: status.model,
    version: "2026-08-12-stock-ai-chain-fix",
    mode: status.aiMode,
    lastCallAt: status.lastCallAt,
    lastSource: status.lastSource,
    lastFailureReason: status.lastFailureReason,
    lastFailureCategory: status.lastFailureCategory,
  });
}));

aiRouter.post("/stock-report", asyncHandler(async (req, res) => {
  const input = req.body ?? {};
  const stock = input.stockData ?? input.stockQuote ?? {};
  const runtime = getAiRuntimeStatus();
  console.info("[stock-ai-report] stockData:", {
    code: stock.code,
    name: stock.name,
    price: stock.price,
    changePercent: stock.changePercent,
    amount: stock.amount,
    industry: stock.industry,
    dataStatus: stock.dataStatus,
  });
  console.info("[stock-ai-report] AI request:", {
    requested: Boolean(stock.code || stock.name),
    provider: runtime.provider,
    mode: runtime.aiMode,
    hasApiKey: runtime.hasApiKey,
  });
  try {
    const report = await generateResearchReport(input);
    const realAi = ["deepseek", "openai", "ai-api"].includes(report.aiStatus?.source ?? report.source);
    console.info("[stock-ai-report] AI response:", {
      success: realAi,
      source: report.aiStatus?.source ?? report.source,
      provider: getAiRuntimeStatus().provider,
      mode: getAiRuntimeStatus().aiMode,
      rating: report.investmentDecision?.rating,
      score: report.investmentDecision?.score,
      error: report.aiStatus?.errorMessage ?? report.error ?? "",
    });
    res.json({ ok: true, data: report, report, aiStatus: report.aiStatus ?? { source: report.source ?? "fallback" } });
  } catch (error) {
    const fallback = generateFallbackResearchReport(input, `AI本地处理异常：${error.message}`);
    console.info("[stock-ai-report] AI response:", {
      success: false,
      provider: getAiRuntimeStatus().provider,
      mode: getAiRuntimeStatus().aiMode,
      error: error.message,
    });
    res.json({ ok: true, data: fallback, report: fallback, aiStatus: fallback.aiStatus ?? { source: "fallback", errorMessage: error.message } });
  }
}));

aiRouter.post("/market-analysis", asyncHandler(async (req, res) => {
  const input = req.body ?? {};
  const runtime = getAiRuntimeStatus();
  console.info("[market-ai-analysis] AI request:", {
    provider: runtime.provider,
    mode: runtime.aiMode,
    hasApiKey: runtime.hasApiKey,
    hotSectorCount: input.marketSnapshot?.hotSectors?.length ?? input.marketData?.hotSectors?.length ?? 0,
    newsCount: input.newsSnapshot?.news?.length ?? input.newsData?.length ?? input.newsEvents?.length ?? 0,
  });
  try {
    const analysis = await generateMarketAnalysis(input);
    console.info("[market-ai-analysis] AI response:", {
      source: analysis.aiStatus?.source ?? analysis.source,
      provider: getAiRuntimeStatus().provider,
      mode: getAiRuntimeStatus().aiMode,
      error: analysis.aiStatus?.errorMessage ?? analysis.error ?? "",
    });
    res.json({ ok: true, data: analysis, analysis, aiStatus: analysis.aiStatus ?? { source: analysis.source ?? "fallback" } });
  } catch (error) {
    console.info("[market-ai-analysis] AI response:", {
      source: "fallback",
      provider: getAiRuntimeStatus().provider,
      mode: getAiRuntimeStatus().aiMode,
      error: error.message,
    });
    const fallback = generateFallbackResearchReport(input, `AI市场分析异常：${error.message}`);
    res.json({ ok: true, data: fallback, analysis: fallback, aiStatus: fallback.aiStatus ?? { source: "fallback", errorMessage: error.message } });
  }
}));

aiRouter.use(requireUser);

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
  res.json({ ok: true, data: saved, report, aiStatus: report.aiStatus ?? { source: report.source ?? "fallback" } });
}));

aiRouter.post("/ask", asyncHandler(async (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) {
    res.status(400).json({ ok: false, message: "问题不能为空" });
    return;
  }
  const runtime = getAiRuntimeStatus();
  console.info("[ai-entry] request:", {
    entry: "ask",
    provider: runtime.provider,
    mode: runtime.aiMode,
    hasApiKey: runtime.hasApiKey,
    questionLength: question.length,
  });
  const context = await enrichQuestionContext(question, req.body?.context ?? {});
  const input = await buildUserAiInput(req.user.id, context);
  const answer = await answerInvestmentQuestion(question, input);
  console.info("[ai-entry] response:", {
    entry: "ask",
    source: answer.aiStatus?.source ?? answer.source ?? "fallback",
    error: answer.aiStatus?.errorMessage ?? answer.error ?? "",
  });
  res.json({ ok: true, data: answer, aiStatus: answer.aiStatus ?? { source: answer.source ?? "fallback" } });
}));

aiRouter.post("/feedback", asyncHandler(async (req, res) => {
  const saved = await saveAIFeedback(req.user.id, req.body ?? {});
  res.json({ ok: true, data: saved });
}));

aiRouter.get("/feedback", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getAIFeedback(req.user.id) });
}));

aiRouter.post("/research-team", asyncHandler(async (req, res) => {
  const runtime = getAiRuntimeStatus();
  console.info("[ai-entry] request:", {
    entry: "research-team",
    provider: runtime.provider,
    mode: runtime.aiMode,
    hasApiKey: runtime.hasApiKey,
  });
  const input = await buildUserAiInput(req.user.id, req.body ?? {});
  const workflow = await runResearchTeam(input);
  console.info("[ai-entry] response:", {
    entry: "research-team",
    source: workflow.report?.aiStatus?.source ?? workflow.report?.source ?? "fallback",
    error: workflow.report?.aiStatus?.errorMessage ?? workflow.report?.error ?? "",
  });
  res.json({ ok: true, data: workflow, aiStatus: workflow.report?.aiStatus ?? { source: workflow.report?.source ?? "fallback" } });
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
    announcementData: extra.announcementData ?? extra.announcements ?? extra.stockData?.announcements ?? extra.stockQuote?.announcements ?? [],
    portfolio: extra.portfolio ?? portfolio,
    investmentProfile: extra.investmentProfile ?? settings ?? {},
    historyReports: extra.historyReports ?? historyReports,
    aiHistory: extra.aiHistory ?? aiHistory,
    historicalReflection: buildReflection(aiHistory, { investmentProfile: extra.investmentProfile ?? settings ?? {} }),
    riskData: extra.riskData ?? extra.risks ?? [],
  };
  return { ...structured, aiInputSummary: buildAiInputSummary(structured) };
}

async function enrichQuestionContext(question, context) {
  const query = extractSecurityQuery(question);
  if (!query || context.stockData?.code) return context;
  const research = await getResearchData(query).catch(() => null);
  const data = research?.data;
  if (!data) return context;
  return {
    ...context,
    marketData: context.marketData ?? data.marketData,
    stockData: {
      ...(data.security ?? {}),
      ...(data.quote ?? {}),
      company: data.company,
      etf: data.etf,
      financials: data.financials,
      announcements: data.announcements,
      dataStatus: data.dataStatus?.overall,
      sourceTimes: data.sourceTimes,
    },
    newsData: context.newsData ?? data.news ?? [],
    announcementData: context.announcementData ?? data.announcements ?? [],
    riskData: context.riskData ?? buildResearchRisks(data),
  };
}

function extractSecurityCode(text) {
  return String(text ?? "").match(/\b(00|30|60|68|51|52|56|58|15|16)\d{4}\b/)?.[0] ?? "";
}

function extractSecurityQuery(text) {
  const raw = String(text ?? "").trim();
  const code = extractSecurityCode(raw);
  if (code) return code;
  const match = raw.match(/(?:分析|看看|研究|查询|聊聊)?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,12})(?:怎么样|如何|最近|风险|机会|$)/);
  const keyword = match?.[1]?.trim();
  if (!keyword || /今天|市场|行业|板块|组合|持仓|风险|方向|日报|为什么|明天/.test(keyword)) return "";
  return keyword;
}

function buildResearchRisks(data) {
  const risks = [];
  if (data.quote?.status !== "real") risks.push({ message: data.quote?.message ?? "行情数据源未返回" });
  if (!data.announcements?.length && data.security?.assetType !== "ETF") risks.push({ message: "公告接口未返回，需要复核交易所或公司公告。" });
  if (data.financials?.status === "unavailable") risks.push({ message: `财务数据状态：${data.financials.source}` });
  return risks;
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
      announcements: input.announcementData ?? [],
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
    saveAIHistory(userId, { ...base, predictionType: "market", predictionContent: { summary: report.marketSummary, decision: report.investmentDecision, evidence: report.evidence?.market ?? [] }, marketPrediction: report.marketSummary }),
    saveAIHistory(userId, { ...base, predictionType: "industry", predictionContent: { hotDirections: report.hotDirections ?? [], decision: report.investmentDecision, evidence: report.evidence?.industry ?? [] }, sectorPrediction: { hotDirections: report.hotDirections ?? [] } }),
    saveAIHistory(userId, { ...base, predictionType: "stock", predictionContent: { analysis: report.stockAnalysis, decision: report.investmentDecision, evidence: report.evidence?.stock ?? [] }, stockPrediction: { analysis: report.stockAnalysis } }),
    saveAIHistory(userId, { ...base, predictionType: "risk", predictionContent: { risks: report.risks ?? [], decision: report.investmentDecision }, riskPrediction: { risks: report.risks ?? [] } }),
  ]);
}

function scoreReport(report) {
  let score = 55;
  if (report.companyAnalysis) score += 8;
  if (report.marketSummary) score += 8;
  if ((report.hotDirections ?? []).length) score += 8;
  if (report.stockAnalysis) score += 8;
  if ((report.risks ?? []).length) score += 8;
  if ((report.tomorrowPlan ?? []).length) score += 5;
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
