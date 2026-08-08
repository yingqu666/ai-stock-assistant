import { reportHistory } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addLog } from "./logService.js";

const aiConfigKey = "ai-investment-ai-config";

export function getAiConfig() {
  try {
    return JSON.parse(window.localStorage.getItem(aiConfigKey) ?? "{}");
  } catch {
    return {};
  }
}

export async function getAiStatus() {
  try {
    const result = await cloudDataApi.getAiStatus();
    const data = result.data ?? {};
    return {
      ...data,
      connected: data.mode === "api" && data.hasApiKey,
      label: data.mode === "api" ? "API\u6a21\u5f0f" : "Fallback\u6a21\u5f0f",
      message: data.mode === "api" ? "\u670d\u52a1\u7aefAI API\u914d\u7f6e\u5df2\u68c0\u6d4b" : "\u5f53\u524d\u4f7f\u7528\u89c4\u5219fallback",
    };
  } catch (error) {
    return { mode: "fallback", provider: "local", connected: false, label: "Fallback\u6a21\u5f0f", message: error.message };
  }
}

export function saveAiConfig(config) {
  const clean = {
    mode: config.mode ?? "fallback",
    provider: config.provider ?? "openai-compatible",
    endpoint: config.endpoint ?? "",
    model: config.model ?? "",
    apiKeyStatus: config.apiKey ? "\u5df2\u586b\u5199\uff0c\u4ec5\u4fdd\u5b58Key\u72b6\u6001\uff0c\u4e0d\u628a\u5bc6\u94a5\u5199\u5165\u4ee3\u7801" : "\u672a\u586b\u5199",
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
  window.localStorage.setItem(aiConfigKey, JSON.stringify(clean));
  return clean;
}

export function buildAiResearchInput({
  marketData,
  stockQuote,
  newsEvents,
  riskData = [],
  investmentProfile,
  historicalReports = [],
  portfolio = [],
  aiHistory = [],
}) {
  return {
    marketData,
    stockData: stockQuote,
    stockQuote,
    newsData: newsEvents,
    newsEvents,
    riskData,
    investmentProfile,
    portfolio,
    historyReports: historicalReports,
    aiHistory,
    aiInputSummary: buildInputSummary({ marketData, stockQuote, newsEvents, riskData, investmentProfile, historicalReports, portfolio, aiHistory }),
  };
}

export function buildPrompt(input) {
  return JSON.stringify({
    task: "\u751f\u6210A\u80a1\u6295\u8d44\u7814\u7a76\u62a5\u544a",
    rules: [
      "\u4e0d\u8f93\u51fa\u786e\u5b9a\u4e70\u5165\u6216\u5356\u51fa\u5efa\u8bae",
      "\u6bcf\u4e2a\u7ed3\u8bba\u5fc5\u987b\u9644\u6570\u636e\u4f9d\u636e",
      "\u6ca1\u6709\u6570\u636e\u652f\u6301\u65f6\u660e\u786e\u8bf4\u660e\u6570\u636e\u4e0d\u8db3",
      "\u8f93\u51fa\u7ed3\u6784\u5316JSON",
    ],
    outputTemplate: ["\u5e02\u573a\u73af\u5883", "\u5f53\u524d\u4e3b\u7ebf", "\u70ed\u70b9\u884c\u4e1a", "\u5173\u6ce8\u80a1\u7968", "\u98ce\u9669\u56e0\u7d20", "\u660e\u65e5\u89c2\u5bdf", "\u6570\u636e\u4f9d\u636e", "\u53ef\u4fe1\u5ea6"],
    input,
  }, null, 2);
}

export async function generateAiAnalysis(input) {
  try {
    const result = await cloudDataApi.generateAiReport(input);
    if (result.data?.summary || result.data?.marketSummary) return normalizeAiOutput(result.data, input, "\u4e91\u7aefAI/API");
  } catch (error) {
    addAiLog("AI\u62a5\u544a\u751f\u6210\u5931\u8d25\uff0c\u5df2\u4f7f\u7528\u672c\u5730\u89c4\u5219fallback", error);
  }
  return generateRuleBasedAnalysis(input);
}

export async function testAiConnection(config) {
  if (config.mode !== "api") return { ok: true, message: "\u5f53\u524d\u4e3afallback\u6a21\u5f0f\uff0c\u65e0\u9700\u6d4b\u8bd5API\u3002" };
  if (!config.endpoint || !config.apiKey) return { ok: false, message: "\u8bf7\u586b\u5199API\u5730\u5740\u548cKey\u3002" };
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model || "gpt-4.1-mini",
        messages: [{ role: "user", content: "\u8bf7\u56de\u590d\uff1aAI\u8fde\u63a5\u6210\u529f" }],
        temperature: 0,
      }),
    });
    if (!response.ok) return { ok: false, message: `AI\u8fde\u63a5\u5931\u8d25\uff1aHTTP ${response.status}` };
    return { ok: true, message: "AI\u8fde\u63a5\u6210\u529f\u3002" };
  } catch (error) {
    return { ok: false, message: `AI\u8fde\u63a5\u5931\u8d25\uff1a${error.message}` };
  }
}

export async function answerInvestmentQuestion(question, context) {
  try {
    const result = await cloudDataApi.askAi({ question, context });
    return {
      question,
      answer: formatCloudAnswer(result.data),
      raw: result.data,
      source: result.data?.source === "ai-api" ? "\u771f\u5b9eAI\u63a5\u53e3" : "\u89c4\u5219fallback",
      context,
    };
  } catch (error) {
    addAiLog("AI\u52a9\u624b\u4e91\u7aef\u95ee\u7b54\u5931\u8d25", error);
    return { question, answer: buildProfessionalFallbackAnswer(question, context), source: "\u672c\u5730\u89c4\u5219fallback", context };
  }
}

export async function saveAiAnswerFeedback(payload) {
  try {
    return await cloudDataApi.saveAiFeedback(payload);
  } catch (error) {
    addAiLog("AI\u53cd\u9988\u4fdd\u5b58\u5931\u8d25", error);
    return { ok: false, message: error.message };
  }
}

export function generateRuleBasedAnalysis(input) {
  const newsEvents = input.newsData ?? input.newsEvents ?? [];
  const stock = input.stockData ?? input.stockQuote ?? {};
  const stockName = stock.name ?? "\u5f53\u524d\u80a1\u7968";
  const sentiment = input.marketData?.marketSentiment ?? {};
  const marketSummary = sentiment.summary ?? "\u5e02\u573a\u6570\u636e\u6682\u672a\u66f4\u65b0";
  const preferred = input.investmentProfile?.industries ?? [];
  const hotSectors = (input.marketData?.hotSectors ?? []).map((item) => item.name);
  const opportunities = [...new Set([...preferred, ...hotSectors])].slice(0, 6);
  const evidence = buildEvidence(input);
  const credibility = scoreCredibility({ marketData: input.marketData, stock, newsEvents, riskData: input.riskData });

  return {
    marketSummary: `\u4eca\u65e5\u5e02\u573a\uff1a${marketSummary}\u3002`,
    coreLogic: "\u6838\u5fc3\u903b\u8f91\uff1a\u7ed3\u5408\u6307\u6570\u6da8\u8dcc\u3001\u6210\u4ea4\u989d\u3001\u6da8\u8dcc\u5bb6\u6570\u548c\u70ed\u70b9\u677f\u5757\u6301\u7eed\u6027\u505a\u89c2\u5bdf\uff0c\u4e0d\u5f62\u6210\u786e\u5b9a\u4e70\u5356\u7ed3\u8bba\u3002",
    industryAnalysis: `\u70ed\u70b9\u884c\u4e1a\uff1a${(opportunities.length ? opportunities : ["AI", "\u534a\u5bfc\u4f53", "\u7535\u529b"]).join("\u3001")}\u3002`,
    stockAnalysis: `${stockName}\uff1a\u9700\u7ed3\u5408\u4ef7\u683c\u3001\u6da8\u8dcc\u5e45\u3001\u6210\u4ea4\u989d\u3001\u516c\u544a\u3001\u8d22\u52a1\u548c\u884c\u4e1a\u65b0\u95fb\u6301\u7eed\u8ddf\u8e2a\u3002`,
    opportunities,
    risks: buildRiskList(input, newsEvents),
    tomorrowPlan: ["\u89c2\u5bdf\u70ed\u70b9\u677f\u5757\u6210\u4ea4\u662f\u5426\u5ef6\u7eed", "\u68c0\u67e5\u81ea\u9009\u80a1\u516c\u544a\u548c\u65b0\u95fb\u53d8\u5316", "\u590d\u76d8AI\u98ce\u9669\u63d0\u9192\u662f\u5426\u6709\u6548"],
    evidence,
    conclusionBasis: evidence,
    credibility,
    summary: `${marketSummary}\u3002\u5f53\u524d\u66f4\u9002\u5408\u7ed3\u6784\u5316\u89c2\u5bdf\u3002`,
    stockAdvice: `${stockName}\uff1a\u7ee7\u7eed\u5173\u6ce8\u516c\u544a\u3001\u8d22\u52a1\u3001\u6210\u4ea4\u989d\u548c\u884c\u4e1a\u6d88\u606f\u53d8\u5316\uff1b\u4e0d\u8f93\u51fa\u786e\u5b9a\u4e70\u5165\u6216\u5356\u51fa\u7ed3\u8bba\u3002`,
    source: "\u672c\u5730\u89c4\u5219fallback",
  };
}

export function generateDailyReports({ marketData, newsEvents = [], watchlist = [], investmentProfile, riskAlerts = [] }) {
  const analysis = generateRuleBasedAnalysis({ marketData, newsData: newsEvents, investmentProfile, riskData: riskAlerts, historyReports: reportHistory, portfolio: watchlist });
  const hotNames = (marketData.hotSectors ?? []).map((item) => item.name);
  const watchedNames = watchlist.map((item) => item.name).filter(Boolean).slice(0, 4);
  const stockEvidence = watchlist.slice(0, 4).map((item) => `${item.name} ${item.code}\uff1a${item.changePercent ?? item.change ?? "\u6682\u65e0"}\uff0c${item.dataSource ?? "\u6570\u636e\u6e90\u672a\u77e5"}`);
  const announcementEvidence = watchlist.flatMap((item) => item.announcements ?? []).slice(0, 4).map((item) => `${item.title}\uff1a${item.analysis?.direction ?? item.impact ?? "\u4e2d\u6027"}`);
  const financialEvidence = watchlist.slice(0, 4).map((item) => `${item.name}\u8d22\u52a1\uff1a\u8425\u6536 ${item.financials?.revenue ?? "\u6682\u65e0"}\uff0c\u51c0\u5229\u6da6 ${item.financials?.netProfit ?? "\u6682\u65e0"}\uff0c\u6765\u6e90 ${item.financials?.source ?? "\u6682\u65e0"}`);
  const sentiment = marketData.marketSentiment ?? {};
  const strategy = marketData.strategy ?? {};
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const quality = scoreReportQuality({ marketData, newsEvents, riskAlerts, watchlist });

  return {
    morning: {
      date: new Date().toLocaleDateString("zh-CN"),
      generatedAt,
      score: strategy.score ?? 70,
      marketState: strategy.state ?? sentiment.summary ?? "\u9707\u8361\u89c2\u5bdf",
      overseas: "\u591c\u95f4\u5916\u56f4\u5e02\u573a\u4f5c\u4e3a\u60c5\u7eea\u53d8\u91cf\uff0c\u91cd\u70b9\u770b\u79d1\u6280\u677f\u5757\u5bf9A\u80a1AI\u3001\u534a\u5bfc\u4f53\u548c\u7b97\u529b\u65b9\u5411\u7684\u6620\u5c04\u3002",
      marketSummary: analysis.marketSummary,
      riseReason: `\u70ed\u70b9\u677f\u5757\u96c6\u4e2d\u5728 ${hotNames.slice(0, 3).join("\u3001") || "\u7ed3\u6784\u6027\u65b9\u5411"}\uff0c\u6210\u4ea4\u548c\u60c5\u7eea\u662f\u4e3b\u8981\u89c2\u5bdf\u53d8\u91cf\u3002`,
      downsideRisk: analysis.risks.join("\uff1b"),
      strategy: `\u4eca\u65e5\u5173\u6ce8\u65b9\u5411\uff1a${analysis.opportunities.join("\u3001")}\u3002\u7ee7\u7eed\u7814\u7a76\u89c2\u5bdf\uff0c\u4e0d\u8ffd\u9ad8\u3002`,
      focus: analysis.opportunities,
      watchFocus: watchedNames,
      risks: analysis.risks,
      tomorrowPlan: analysis.tomorrowPlan,
      positionAdvice: strategy.position ?? "\u4fdd\u6301\u89c2\u5bdf\u4ed3\u4f4d\uff0c\u907f\u514d\u8ffd\u9ad8",
      sources: ["\u4e1c\u65b9\u8d22\u5bcc\u884c\u60c5", "\u4e1c\u65b9\u8d22\u5bcc\u516c\u544a/\u5feb\u8baf", "stockService\u81ea\u9009\u80a1", "riskService", "AI\u5206\u6790"],
      basis: "\u57fa\u4e8e\u5e02\u573a\u60c5\u7eea\u3001\u70ed\u70b9\u677f\u5757\u3001\u65b0\u95fb\u4e8b\u4ef6\u3001\u516c\u544a\u3001\u8d22\u52a1\u3001\u81ea\u9009\u80a1\u548c\u7528\u6237\u6295\u8d44\u6863\u6848\u751f\u6210\u3002",
      evidence: { ...analysis.evidence, stocks: stockEvidence, announcements: announcementEvidence, financials: financialEvidence },
      credibility: analysis.credibility,
      quality,
    },
    close: {
      date: new Date().toLocaleDateString("zh-CN"),
      generatedAt,
      performance: analysis.marketSummary,
      marketSummary: analysis.marketSummary,
      breadth: `\u4e0a\u6da8 ${sentiment.upCount ?? "\u672a\u77e5"} \u5bb6\uff0c\u4e0b\u8dcc ${sentiment.downCount ?? "\u672a\u77e5"} \u5bb6\u3002`,
      hotSectors: hotNames,
      hotAnalysis: `${hotNames.slice(0, 4).join("\u3001") || "\u6682\u65e0\u660e\u786e\u4e3b\u7ebf"} \u662f\u4eca\u65e5\u91cd\u70b9\u590d\u76d8\u65b9\u5411\uff0c\u9700\u7ed3\u5408\u6210\u4ea4\u6301\u7eed\u6027\u5224\u65ad\u3002`,
      events: newsEvents.slice(0, 4).map((item) => `${item.title}\uff1a${item.source ?? "\u65b0\u95fb"}\uff0c${item.impact ?? item.category ?? "\u5f85\u5224\u65ad"}`),
      summary: `\u4eca\u65e5\u5e02\u573a\u603b\u7ed3\uff1a${analysis.marketSummary}`,
      aiReview: "\u672c\u62a5\u544a\u590d\u76d8\u5f53\u65e5\u903b\u8f91\uff0c\u540e\u7eed\u9700\u7ed3\u5408\u6b21\u65e5\u8d70\u52bf\u9a8c\u8bc1\u5224\u65ad\u6709\u6548\u6027\u3002",
      nextFocus: [...hotNames, ...watchedNames, ...analysis.tomorrowPlan].slice(0, 6),
      positionAdvice: strategy.position ?? "\u63a7\u5236\u4ed3\u4f4d\uff0c\u5173\u6ce8\u98ce\u9669\u6536\u76ca\u6bd4",
      sources: ["\u4e1c\u65b9\u8d22\u5bcc\u884c\u60c5", "\u4e1c\u65b9\u8d22\u5bcc\u516c\u544a/\u5feb\u8baf", "stockService", "aiService"],
      basis: "\u57fa\u4e8e\u6536\u76d8\u884c\u60c5\u3001\u65b0\u95fb\u53d8\u5316\u3001\u516c\u544a\u3001\u8d22\u52a1\u3001\u4e2a\u80a1\u5f02\u52a8\u548c\u98ce\u9669\u4fe1\u53f7\u751f\u6210\u3002",
      evidence: { ...analysis.evidence, stocks: stockEvidence, announcements: announcementEvidence, financials: financialEvidence },
      credibility: analysis.credibility,
      quality,
    },
    history: reportHistory.map((item) => ({
      date: item.date,
      type: item.type,
      title: item.content.summary,
      score: strategy.score ?? 70,
      marketSummary: item.content.summary,
      hotAnalysis: item.content.opportunities.join("\u3001"),
      risks: item.content.risks,
      nextStrategy: item.content.stockAdvice,
    })),
  };
}

function normalizeAiOutput(output, input, source) {
  const fallback = generateRuleBasedAnalysis(input);
  return {
    marketSummary: output.marketSummary ?? output.summary ?? fallback.marketSummary,
    coreLogic: output.coreLogic ?? fallback.coreLogic,
    industryAnalysis: output.industryAnalysis ?? fallback.industryAnalysis,
    opportunities: Array.isArray(output.opportunities) ? output.opportunities : fallback.opportunities,
    risks: Array.isArray(output.risks) ? output.risks : fallback.risks,
    stockAnalysis: output.stockAnalysis ?? fallback.stockAnalysis,
    tomorrowPlan: Array.isArray(output.tomorrowPlan) ? output.tomorrowPlan : fallback.tomorrowPlan,
    evidence: output.evidence ?? output.conclusionBasis ?? fallback.evidence,
    conclusionBasis: output.conclusionBasis ?? fallback.conclusionBasis,
    credibility: output.credibility ?? fallback.credibility,
    summary: output.summary ?? output.marketSummary ?? fallback.summary,
    stockAdvice: output.stockAdvice ?? output.stockAnalysis ?? fallback.stockAdvice,
    source,
  };
}

function buildEvidence(input) {
  const marketOverview = input.marketData?.marketOverview ?? [];
  const sentiment = input.marketData?.marketSentiment ?? {};
  const stock = input.stockData ?? input.stockQuote ?? {};
  const newsData = input.newsData ?? input.newsEvents ?? [];
  const announcements = stock.announcements ?? [];
  const financials = stock.financials ?? {};
  return {
    market: [
      ...marketOverview.slice(0, 4).map((item) => `${item.label}\uff1a${item.value}\uff0c${item.change ?? "\u65e0\u53d8\u5316\u4fe1\u606f"}`),
      `\u6da8\u8dcc\u5bb6\u6570\uff1a\u4e0a\u6da8${sentiment.upCount ?? "\u672a\u77e5"}\uff0c\u4e0b\u8dcc${sentiment.downCount ?? "\u672a\u77e5"}`,
    ],
    industry: [
      ...((input.marketData?.hotSectors ?? []).slice(0, 4).map((item) => `${item.name}\uff1a${item.status ?? item.flow ?? "\u70ed\u70b9"}`)),
      ...newsData.slice(0, 3).map((item) => `${item.title}\uff1a${item.source ?? "\u65b0\u95fb"}\uff0c${item.impact ?? item.category ?? "\u5f85\u5224\u65ad"}`),
    ],
    stock: stock.code ? [
      `${stock.name} ${stock.code}`,
      `\u4ef7\u683c ${stock.price ?? "\u6682\u65e0"}`,
      `\u6da8\u8dcc\u5e45 ${stock.changePercent ?? "\u6682\u65e0"}`,
      `\u6210\u4ea4\u989d ${stock.amount ?? "\u6682\u65e0"}`,
      `\u884c\u4e1a ${stock.industry ?? "\u5f85\u8865\u5145"}`,
    ] : ["\u672a\u63d0\u4f9b\u660e\u786e\u80a1\u7968\u6570\u636e"],
    announcements: announcements.length ? announcements.slice(0, 3).map((item) => `${item.title}\uff1a${item.analysis?.direction ?? item.impact ?? "\u4e2d\u6027"}`) : ["\u6682\u65e0\u516c\u544a\u6570\u636e"],
    financials: [
      `\u8425\u6536 ${financials.revenue ?? "\u6682\u65e0"}`,
      `\u8425\u6536\u540c\u6bd4 ${financials.revenueYoY ?? "\u6682\u65e0"}`,
      `\u51c0\u5229\u6da6 ${financials.netProfit ?? "\u6682\u65e0"}`,
      `ROE ${financials.roe ?? "\u6682\u65e0"}`,
      `\u6765\u6e90 ${financials.source ?? "\u6682\u65e0"}`,
    ],
  };
}

function buildInputSummary({ marketData, stockQuote, newsEvents, riskData, investmentProfile, historicalReports, portfolio, aiHistory }) {
  return {
    market: { indexes: marketData?.marketOverview ?? [], breadth: marketData?.marketSentiment ? { up: marketData.marketSentiment.upCount, down: marketData.marketSentiment.downCount } : {} },
    industry: { hotSectors: marketData?.hotSectors ?? [], news: newsEvents ?? [] },
    stock: stockQuote ?? {},
    company: { announcements: stockQuote?.announcements ?? [], financials: stockQuote?.financials ?? {} },
    user: { portfolio: portfolio ?? [], preference: investmentProfile, riskData },
    history: { reports: historicalReports ?? [], aiHistory: aiHistory ?? [] },
  };
}

function buildRiskList(input, newsEvents) {
  const risks = [];
  if ((input.riskData ?? []).length) risks.push(...input.riskData.map((item) => typeof item === "string" ? item : item.message ?? item.title));
  if (newsEvents.some((item) => item.impact === "\u5229\u7a7a" || item.impact === "\u504f\u5229\u7a7a")) risks.push("\u65b0\u95fb\u6216\u516c\u544a\u5b58\u5728\u5229\u7a7a\u5f71\u54cd\uff0c\u9700\u7ee7\u7eed\u8ddf\u8e2a\u3002");
  risks.push("\u70ed\u70b9\u8f6e\u52a8\u8fc7\u5feb\u53ef\u80fd\u5bfc\u81f4\u77ed\u7ebf\u6ce2\u52a8\u3002", "\u6210\u4ea4\u989d\u4e0d\u8db3\u4f1a\u964d\u4f4e\u4e0a\u6da8\u6301\u7eed\u6027\u3002");
  return [...new Set(risks.filter(Boolean))].slice(0, 6);
}

function scoreReportQuality({ marketData, newsEvents, riskAlerts, watchlist = [] }) {
  let score = 50;
  if (marketData?.marketOverview?.length >= 3) score += 15;
  if (marketData?.source && !String(marketData.source).includes("\u6a21\u62df")) score += 10;
  if ((newsEvents?.length ?? 0) >= 3) score += 10;
  if ((riskAlerts?.length ?? 0) >= 1) score += 10;
  if (watchlist.some((item) => item.financials?.status === "\u771f\u5b9e\u6570\u636e")) score += 5;
  return { score: Math.min(100, score), dataCompleteness: score >= 80 ? "\u8f83\u5b8c\u6574" : "\u90e8\u5206\u5b8c\u6574", newsCount: newsEvents?.length ?? 0, basis: "\u884c\u60c5\u3001\u65b0\u95fb\u3001\u516c\u544a\u3001\u8d22\u52a1\u3001\u98ce\u9669\u3001\u81ea\u9009\u80a1\u3001\u6295\u8d44\u6863\u6848" };
}

function scoreCredibility({ marketData, stock, newsEvents, riskData }) {
  let score = 30;
  const reasons = [];
  if (marketData?.marketOverview?.length) { score += 20; reasons.push("\u5df2\u6709\u884c\u60c5\u6570\u636e"); }
  if (stock?.dataStatus === "\u771f\u5b9e\u6570\u636e") { score += 15; reasons.push("\u5df2\u6709\u4e2a\u80a1\u884c\u60c5"); }
  if ((stock?.announcements ?? []).length) { score += 15; reasons.push("\u5df2\u6709\u516c\u544a\u4f9d\u636e"); }
  if (stock?.financials?.status === "\u771f\u5b9e\u6570\u636e") { score += 15; reasons.push("\u5df2\u6709\u8d22\u52a1\u6570\u636e"); }
  if ((newsEvents ?? []).length) { score += 10; reasons.push("\u5df2\u6709\u65b0\u95fb\u4f9d\u636e"); }
  if ((riskData ?? []).length) { score += 5; reasons.push("\u5df2\u6709\u98ce\u9669\u4fe1\u53f7"); }
  const level = score >= 80 ? "\u9ad8" : score >= 55 ? "\u4e2d" : "\u4f4e";
  return { score: Math.min(100, score), level, reason: reasons.join("\uff1b") || "\u6570\u636e\u4e0d\u8db3\uff0c\u4ec5\u4f5c\u89c4\u5219\u89c2\u5bdf" };
}

function formatCloudAnswer(data) {
  if (!data) return "AI\u6682\u672a\u8fd4\u56de\u7ed3\u679c\u3002";
  if (data.answer) return data.answer;
  return [
    "\u3010\u7ed3\u8bba\u3011",
    data.summary ?? data.marketSummary ?? "\u5f53\u524d\u53ea\u9002\u5408\u7814\u7a76\u89c2\u5bdf\uff0c\u4e0d\u5f62\u6210\u786e\u5b9a\u4e70\u5356\u7ed3\u8bba\u3002",
    "",
    "\u3010\u4f9d\u636e\u3011",
    ...asList(data.evidence ?? data.conclusionBasis ?? ["\u884c\u60c5\u3001\u65b0\u95fb\u3001\u516c\u544a\u3001\u8d22\u52a1\u3001\u81ea\u9009\u80a1\u548c\u7528\u6237\u753b\u50cf"]),
    "",
    "\u3010\u98ce\u9669\u3011",
    ...asList(data.risks ?? ["\u6210\u4ea4\u4e0d\u8db3\u3001\u4f30\u503c\u6ce2\u52a8\u3001\u65b0\u95fb\u843d\u7a7a\u6216\u653f\u7b56\u53d8\u5316"]),
    "",
    "\u3010\u89c2\u5bdf\u5efa\u8bae\u3011",
    ...asList(data.followUp ?? data.tomorrowPlan ?? data.opportunities ?? ["\u5173\u6ce8\u4e3b\u7ebf\u6301\u7eed\u6027", "\u7b49\u5f85\u6210\u4ea4\u786e\u8ba4", "\u63a7\u5236\u7ec4\u5408\u96c6\u4e2d\u5ea6"]),
  ].join("\n");
}

function buildProfessionalFallbackAnswer(question, context) {
  const market = context.market?.marketSentiment?.summary ?? "\u5e02\u573a\u6570\u636e\u6682\u672a\u66f4\u65b0";
  const upDown = `\u4e0a\u6da8${context.market?.marketSentiment?.upCount ?? "\u672a\u77e5"}\u5bb6\uff0c\u4e0b\u8dcc${context.market?.marketSentiment?.downCount ?? "\u672a\u77e5"}\u5bb6`;
  const hotSectors = (context.market?.hotSectors ?? []).map((item) => item.name).slice(0, 4);
  const watchlist = (context.watchlist ?? []).map((item) => `${item.name}(${item.changePercent ?? item.change ?? "\u6682\u65e0"})`).slice(0, 4);
  const stock = context.stockData;
  const focus = context.profile?.industries?.join("\u3001") ?? "\u81ea\u9009\u65b9\u5411";
  const news = (context.news ?? []).slice(0, 3).map((item) => `${item.title}\uff1a${item.source ?? "\u65b0\u95fb"}\uff0c${item.impact ?? item.category ?? "\u5f85\u5224\u65ad"}`);
  const announcements = (stock?.announcements ?? []).slice(0, 3).map((item) => `${item.title}\uff1a${item.analysis?.direction ?? item.impact ?? "\u4e2d\u6027"}`);
  const financials = stock?.financials ?? {};
  const stockLine = stock?.code
    ? `${stock.name}(${stock.code})\uff0c\u73b0\u4ef7 ${stock.price ?? "\u6682\u65e0"}\uff0c\u6da8\u8dcc\u5e45 ${stock.changePercent ?? "\u6682\u65e0"}\uff0c\u6210\u4ea4\u989d ${stock.amount ?? "\u6682\u65e0"}\uff0c\u884c\u4e1a ${stock.industry ?? "\u5f85\u8865\u5145"}`
    : (watchlist.length ? `\u5173\u6ce8\u80a1\u7968\uff1a${watchlist.join("\u3001")}` : "\u672a\u8bc6\u522b\u5230\u660e\u786e\u4e2a\u80a1\uff0c\u6309\u5e02\u573a\u548c\u884c\u4e1a\u95ee\u9898\u5904\u7406\u3002");
  const credibility = scoreCredibility({ marketData: context.market, stock, newsEvents: context.news ?? [], riskData: context.risks ?? [] });

  return `\u3010\u7ed3\u8bba\u3011
\u4f5c\u4e3a\u4e2a\u4ebaA\u80a1\u6295\u8d44\u7814\u7a76\u5206\u6790\u5e08\uff0c\u6211\u7684\u5224\u65ad\u662f\uff1a${market}\u3002\u5f53\u524d\u66f4\u9002\u5408\u505a\u673a\u4f1a\u89c2\u5bdf\u548c\u98ce\u9669\u6392\u67e5\uff0c\u4e0d\u8f93\u51fa\u786e\u5b9a\u4e70\u5356\u7ed3\u8bba\u3002

\u3010\u4f9d\u636e\u3011
\u5e02\u573a\u56e0\u7d20\uff1a${market}\uff0c${upDown}\u3002
\u884c\u4e1a\u56e0\u7d20\uff1a\u70ed\u70b9\u677f\u5757\u5305\u62ec ${hotSectors.join("\u3001") || "\u6682\u65e0\u660e\u786e\u70ed\u70b9"}\uff1b\u4f60\u7684\u5173\u6ce8\u677f\u5757\u4e3a ${focus}\u3002
\u516c\u53f8\u56e0\u7d20\uff1a${stockLine}
\u8d22\u52a1\u56e0\u7d20\uff1a\u8425\u6536 ${financials.revenue ?? "\u6682\u65e0"}\uff0c\u8425\u6536\u540c\u6bd4 ${financials.revenueYoY ?? "\u6682\u65e0"}\uff0c\u51c0\u5229\u6da6 ${financials.netProfit ?? "\u6682\u65e0"}\uff0cROE ${financials.roe ?? "\u6682\u65e0"}\uff0c\u6765\u6e90 ${financials.source ?? "\u6682\u65e0"}\u3002
\u516c\u544a\u4f9d\u636e\uff1a${announcements.join("\uff1b") || "\u6682\u65e0\u516c\u544a\u8fd4\u56de"}\u3002
\u65b0\u95fb\u4f9d\u636e\uff1a${news.join("\uff1b") || "\u6682\u65e0\u53ef\u7528\u65b0\u95fb"}\u3002
\u53ef\u4fe1\u5ea6\uff1a${credibility.level}\uff08${credibility.score}\u5206\uff09\u3002\u539f\u56e0\uff1a${credibility.reason}\u3002

\u3010\u98ce\u9669\u3011
1. \u70ed\u70b9\u8f6e\u52a8\u8fc7\u5feb\uff0c\u8ffd\u9ad8\u5bb9\u6613\u627f\u53d7\u56de\u64a4\u3002
2. \u5982\u679c\u6210\u4ea4\u989d\u4e0d\u8db3\uff0c\u677f\u5757\u4e0a\u6da8\u6301\u7eed\u6027\u4f1a\u4e0b\u964d\u3002
3. \u516c\u544a\u548c\u8d22\u52a1\u6570\u636e\u9700\u7ed3\u5408\u539f\u6587\u590d\u6838\uff0c\u907f\u514d\u53ea\u770b\u6807\u9898\u4e0b\u7ed3\u8bba\u3002

\u3010\u89c2\u5bdf\u5efa\u8bae\u3011
\u5173\u6ce8\uff1a\u8ddf\u8e2a${hotSectors[0] ?? focus}\u7684\u6210\u4ea4\u989d\u548c\u9f99\u5934\u8868\u73b0\u3002
\u7b49\u5f85\uff1a\u7b49\u677f\u5757\u8fde\u7eed\u6027\u3001\u516c\u544a\u548c\u8d22\u62a5\u4fe1\u606f\u8fdb\u4e00\u6b65\u786e\u8ba4\u3002
\u964d\u4f4e\u98ce\u9669\uff1a\u4f18\u5148\u68c0\u67e5\u4ed3\u4f4d\u5360\u6bd4\u548c\u5355\u4e00\u884c\u4e1a\u96c6\u4e2d\u5ea6\u3002`;
}

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : JSON.stringify(item));
  if (typeof value === "object" && value) return Object.values(value).flatMap(asList);
  return [String(value)];
}

function addAiLog(message, error) {
  addLog({ module: "ai", status: "failed", mode: "cloud-first", source: "aiService", message, error: error.message });
}
