import { DATA_MODE } from "../config/dataSources.js";
import {
  account,
  aiHistory,
  aiTeam,
  dailyReport,
  integrationPlan,
  navItems,
  news,
  opportunities,
  riskAlerts,
  stockDatabase,
  userPortfolio,
} from "../data.js";
import { buildAiResearchInput, buildPrompt, generateAiAnalysis, generateDailyReports, getAiStatus } from "./aiService.js";
import { answerInvestmentQuestion } from "./aiService.js";
import { getAiAccuracyStats, getAiHistoryRecords } from "./historyService.js";
import { getMarketSnapshot } from "./marketService.js";
import { getNewsSnapshot, getStockNews } from "./newsService.js";
import { getInvestmentProfile } from "./investmentProfileService.js";
import { getCachedMarketData, getCachedNewsData, getCachedWatchlistData, getRefreshStatus, refreshAllData } from "./refreshService.js";
import { getSavedReports, getTaskSchedule, getTaskStatus, runReportTask } from "./reportScheduler.js";
import { getLogs, clearLogs } from "./logService.js";
import { analyzeRisks } from "./riskService.js";
import { findMockStock, getStockEvents, getWatchlistSnapshot, queryStock } from "./stockService.js";
import { addSyncedWatchlist, deleteSyncedWatchlist, getSyncStatus, syncWatchlist } from "./syncService.js";
import { getUserStoragePrefix } from "./userService.js";
import { getSyncedWatchlist } from "./watchlistSyncService.js";
import { getPortfolioSummary } from "./portfolioService.js";

export const currentDataMode = DATA_MODE;
const DATA_MISSING = "数据源未返回";

const navLabels = {
  dashboard: "首页",
  market: "市场分析",
  opportunities: "AI研究机会",
  stock: "股票分析",
  watchlist: "我的关注股票",
  dailyReport: "AI日报",
  reportCenter: "报告中心",
  assistant: "AI助手",
  portfolio: "投资组合",
  review: "复盘分析",
  riskDashboard: "风险看板",
  industryResearch: "行业研究",
  profile: "我的投资档案",
  account: "我的账户",
  team: "AI研究团队",
  systemStatus: "系统状态",
  settings: "系统设置",
};

const portfolioKey = "ai-investment-user-portfolio";
let portfolioState = loadPortfolio();
let selectedStockQuery = stockDatabase[0].code;
const stockAiCache = new Map();
let selectedReport = dailyReport.history[0];
let dailyReportHistoryState = dailyReport.history;

function loadPortfolio() {
  try {
    const saved = window.localStorage.getItem(getPortfolioKey());
    return saved ? JSON.parse(saved) : [...userPortfolio];
  } catch {
    return [...userPortfolio];
  }
}

function savePortfolio() {
  try {
    window.localStorage.setItem(getPortfolioKey(), JSON.stringify(portfolioState));
  } catch {
    // Local storage is optional in this static prototype.
  }
}

export function getNavigation() {
  const items = navItems.some((item) => item.id === "systemStatus")
    ? navItems
    : [...navItems.slice(0, -1), { id: "systemStatus", label: "系统状态" }, navItems[navItems.length - 1]];
  return items.map((item) => ({ ...item, label: navLabels[item.id] ?? item.label }));
}

function getPortfolioKey() {
  return `${getUserStoragePrefix()}${portfolioKey}`;
}

export async function getDashboardData() {
  const [market, newsSnapshot, syncedWatchlist, portfolio, aiStatus] = await Promise.all([
    getCachedMarketData(),
    getCachedNewsData(),
    getSyncedWatchlist(),
    getPortfolioSummary().catch(() => null),
    getAiStatus().catch(() => ({ label: "Fallback模式", connected: false, provider: "fallback" })),
  ]);
  const watchlistSnapshot = syncedWatchlist.items ?? [];
  const risks = analyzeRisks({ watchlist: watchlistSnapshot, newsEvents: newsSnapshot.stockNews, marketData: market });
  const aiSummary = await generateAiAnalysis({
    marketData: market,
    newsEvents: newsSnapshot.stockNews,
    investmentProfile: getInvestmentProfileData(),
  });
  return {
    ...market,
    opportunities,
    news: newsSnapshot.news,
    importantNews: newsSnapshot.stockNews.slice(0, 3),
    riskAlerts,
    watchlist: watchlistSnapshot,
    portfolioSummary: portfolio,
    aiSummary,
    aiStatus,
    taskStatus: getTaskStatus(),
    riskSignals: risks,
    refreshStatus: getRefreshStatus(),
  };
}

export async function getMarketData() {
  return getCachedMarketData();
}

export function getOpportunityData() {
  return { opportunities };
}

export async function getWatchlistData() {
  const [syncedWatchlist, newsSnapshot, marketData] = await Promise.all([getSyncedWatchlist(), getCachedNewsData(), getCachedMarketData()]);
  const watchlistSnapshot = syncedWatchlist.items ?? [];
  const risks = analyzeRisks({ watchlist: watchlistSnapshot, newsEvents: newsSnapshot.stockNews, marketData });
  return { watchlist: watchlistSnapshot, userPortfolio: portfolioState, stockNews: newsSnapshot.stockNews, aiHistory: await getAiHistoryRecords(), accuracyStats: await getAiAccuracyStats(), riskSignals: risks };
}

export function addPortfolioStock(query) {
  const keyword = query.trim();
  if (!keyword) return { ok: false, message: "请输入股票代码或名称。" };

  const match = findMockStock(keyword);
  if (!match) return { ok: false, message: "股票库中暂未找到该标的。" };

  if (portfolioState.some((stock) => stock.code === match.code)) {
    return { ok: false, message: "该标的已经在关注列表中。" };
  }

  portfolioState = [
    ...portfolioState,
    {
      code: match.code,
      name: match.name,
      addedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      reason: `${match.industry}方向观察，等待更多事件验证。`,
      aiLevel: "新加入观察",
    },
  ];
  savePortfolio();
  return { ok: true, message: `已添加${match.name}` };
}

export function removePortfolioStock(code) {
  portfolioState = portfolioState.filter((stock) => stock.code !== code);
  savePortfolio();
}

export function selectStock(query) {
  const keyword = String(query ?? "").trim();
  if (!keyword) return null;
  const match = findMockStock(keyword);
  selectedStockQuery = match?.code ?? keyword;
  return match ?? { code: keyword, name: keyword };
}

export function selectStockByCode(code) {
  return selectStock(code);
}

export async function getStockSearchData() {
  const contextPromise = Promise.allSettled([
    withTimeout(getMarketSnapshot(), 3000, () => ({ marketOverview: [], hotSectors: [], marketSentiment: {}, error: "\u5e02\u573a\u6570\u636e\u83b7\u53d6\u8d85\u65f6" })),
    withTimeout(getStockNews(selectedStockQuery), 3000, () => []),
    withTimeout(getAiHistoryRecords(), 3000, () => []),
    withTimeout(getSavedReports(), 3000, () => []),
  ]);
  const stockDetail = await withTimeout(
    queryStock(selectedStockQuery),
    5000,
    () => buildStockQueryError(selectedStockQuery, new Error("\u80a1\u7968\u57fa\u7840\u884c\u60c5\u83b7\u53d6\u8d85\u65f6")),
  );

  const [marketResult, newsResult, historyResult, reportsResult] = await contextPromise;

  const marketData = marketResult.status === "fulfilled" ? marketResult.value : { marketOverview: [], hotSectors: [], marketSentiment: {}, error: marketResult.reason?.message };
  const stockNews = newsResult.status === "fulfilled" ? newsResult.value : [];
  const aiHistoryRecords = historyResult.status === "fulfilled" ? historyResult.value : [];
  const savedReports = reportsResult.status === "fulfilled" ? reportsResult.value : [];
  const mergedStockNews = [...(stockDetail.stockNews ?? []), ...stockNews];
  const stockEvents = getStockEvents(stockDetail.code);
  const riskData = analyzeRisks({ watchlist: [stockDetail], newsEvents: mergedStockNews, marketData });
  const aiInput = buildAiResearchInput({
    marketData,
    stockQuote: stockDetail,
    newsEvents: mergedStockNews,
    riskData,
    portfolio: [stockDetail],
    aiHistory: aiHistoryRecords,
    investmentProfile: getInvestmentProfileData(),
    historicalReports: savedReports,
  });
  const hasBasicQuote = hasUsableQuote(stockDetail);
  const aiAnalysis = !hasBasicQuote
    ? {
      source: "\u57fa\u7840\u884c\u60c5\u4e0d\u8db3",
      summary: "\u57fa\u7840\u884c\u60c5\u672a\u6709\u6548\u8fd4\u56de\uff0c\u6682\u4e0d\u8c03\u7528AI\u751f\u6210\u6295\u7814\u5224\u65ad\u3002",
      stockAnalysis: stockDetail.dataMessage ?? "\u6570\u636e\u4e0d\u8db3",
      risks: [stockDetail.dataMessage ?? "\u57fa\u7840\u884c\u60c5\u4e0d\u8db3\uff0c\u9700\u5148\u786e\u8ba4\u4ee3\u7801\u548c\u6570\u636e\u6e90"],
      opportunities: [],
    }
    : stockDetail.aiReport?.investmentDecision
    ? { ...stockDetail.aiReport, source: ["deepseek", "ai-api"].includes(stockDetail.aiReport.source) ? "\u771f\u5b9eAI\u6a21\u578b" : stockDetail.aiReport.source ?? "\u89c4\u5219\u5206\u6790" }
    : getAsyncStockAiAnalysis(stockDetail, aiInput);
  const aiPrompt = buildPrompt(aiInput);
  return { stockDetail, stockDatabase, stockNews: mergedStockNews, stockEvents, aiInput, aiPrompt, aiAnalysis };
}

function hasUsableQuote(stock) {
  const missingValues = new Set([DATA_MISSING, "\u6570\u636e\u6e90\u672a\u8fd4\u56de", "\u6682\u65e0", "\u4e0d\u53ef\u7528", "", undefined, null]);
  return Boolean(stock?.code && stock?.name && !missingValues.has(stock.price) && !missingValues.has(stock.changePercent));
}

function getAsyncStockAiAnalysis(stockDetail, aiInput) {
  const key = stockDetail.code || selectedStockQuery;
  const cached = stockAiCache.get(key);
  if (cached?.status === "success") return cached.data;
  if (cached?.status === "failed") {
    return {
      source: "AI\u5206\u6790\u5931\u8d25",
      summary: "AI\u5206\u6790\u5931\u8d25\uff0c\u57fa\u7840\u884c\u60c5\u4ecd\u53ef\u6b63\u5e38\u67e5\u770b\u3002",
      stockAnalysis: cached.error,
      risks: [cached.error],
      opportunities: [],
    };
  }
  if (!cached || cached.status !== "pending") {
    stockAiCache.set(key, { status: "pending", startedAt: Date.now() });
    generateAiAnalysis(aiInput)
      .then((data) => {
        stockAiCache.set(key, { status: "success", data, updatedAt: Date.now() });
        window.dispatchEvent(new CustomEvent("stock-ai-report-ready", { detail: { code: key, success: true } }));
      })
      .catch((error) => {
        stockAiCache.set(key, { status: "failed", error: error.message, updatedAt: Date.now() });
        window.dispatchEvent(new CustomEvent("stock-ai-report-ready", { detail: { code: key, success: false, error: error.message } }));
      });
  }
  return {
    source: "AI\u5206\u6790\u751f\u6210\u4e2d",
    summary: "\u57fa\u7840\u884c\u60c5\u5df2\u663e\u793a\uff0cAI\u6295\u8d44\u5224\u65ad\u6b63\u5728\u540e\u53f0\u751f\u6210\u3002",
    stockAnalysis: "AI\u7814\u7a76\u62a5\u544a\u751f\u6210\u4e2d\uff0c\u8bf7\u7a0d\u5019\u3002",
    risks: [],
    opportunities: [],
  };
}



function withTimeout(promise, timeoutMs, fallbackFactory) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = window.setTimeout(() => resolve(fallbackFactory()), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function buildStockQueryError(query, error) {
  return {
    code: query,
    name: query,
    assetType: "\u672a\u77e5",
    price: DATA_MISSING,
    changePercent: DATA_MISSING,
    amount: DATA_MISSING,
    volume: DATA_MISSING,
    marketCap: DATA_MISSING,
    pe: DATA_MISSING,
    pb: DATA_MISSING,
    dataSource: "\u771f\u5b9e\u884c\u60c5\u83b7\u53d6\u5931\u8d25",
    quoteSource: "\u771f\u5b9e\u884c\u60c5\u83b7\u53d6\u5931\u8d25",
    dataStatus: "\u6570\u636e\u4e0d\u8db3",
    dataMessage: error?.message ?? "\u67e5\u8be2\u5931\u8d25",
    riskTips: [error?.message ?? "\u57fa\u7840\u884c\u60c5\u6682\u672a\u8fd4\u56de"],
    financials: {},
    announcements: [],
    stockNews: [],
    researchReport: {
      company: "\u57fa\u7840\u884c\u60c5\u672a\u8fd4\u56de\uff0c\u6682\u4e0d\u751f\u6210\u516c\u53f8\u7814\u7a76\u7ed3\u8bba\u3002",
      summary: error?.message ?? "\u67e5\u8be2\u5931\u8d25",
    },
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

export function getAccountData() {
  return { account };
}

export function getResearchTeamData() {
  return { aiTeam };
}

export function getSettingsData() {
  return { integrationPlan, logs: getLogs() };
}

export function clearRefreshLogs() {
  clearLogs();
}

export async function getSidePanelData() {
  const market = await getCachedMarketData();
  return { marketOverview: market.marketOverview, riskAlerts, aiTeam };
}

export function selectDailyReport(index) {
  selectedReport = dailyReportHistoryState[index] ?? dailyReportHistoryState[0] ?? dailyReport.history[0];
  return selectedReport;
}

export async function getDailyReportData() {
  const [marketData, newsSnapshot, syncedWatchlist] = await Promise.all([
    getCachedMarketData(),
    getCachedNewsData(),
    getSyncedWatchlist(),
  ]);
  const watchlistSnapshot = syncedWatchlist.items ?? [];
  const risks = analyzeRisks({ watchlist: watchlistSnapshot, newsEvents: newsSnapshot.stockNews, marketData });
  const generatedReport = generateDailyReports({
    marketData,
    newsEvents: newsSnapshot.stockNews,
    watchlist: watchlistSnapshot,
    investmentProfile: getInvestmentProfileData(),
    riskAlerts: risks,
  });
  const savedReports = await getSavedReports();
  const savedHistory = savedReports.map((record) => ({
    date: record.date,
    type: record.type,
    title: record.content.close?.summary ?? "自动生成报告",
    score: record.content.morning?.score ?? marketData.strategy.score,
    marketSummary: record.content.close?.summary,
    hotAnalysis: record.content.close?.hotSectors?.join("、"),
    risks: record.content.morning?.risks ?? [],
    nextStrategy: record.content.close?.nextFocus?.join("、"),
  }));
  const mergedReport = { ...generatedReport, history: [...savedHistory, ...generatedReport.history, ...dailyReport.history] };
  dailyReportHistoryState = mergedReport.history;
  return {
    dailyReport: mergedReport,
    selectedReport,
    taskSchedule: getTaskSchedule(),
    taskStatus: getTaskStatus(),
    savedReports,
  };
}

export async function generateTodayReport() {
  const record = await runReportTask("手动生成");
  selectedReport = {
    date: record.date,
    type: record.type,
    title: record.content.close.summary,
    score: record.content.morning.score,
    marketSummary: record.content.close.summary,
    hotAnalysis: record.content.close.hotSectors.join("、"),
    risks: record.content.morning.risks,
    nextStrategy: record.content.close.nextFocus.join("、"),
  };
  dailyReportHistoryState = [selectedReport, ...dailyReportHistoryState];
  return record;
}

export async function getAiAssistantContext() {
  const [market, newsSnapshot, reports, syncedWatchlist] = await Promise.all([
    getCachedMarketData(),
    getCachedNewsData(),
    getSavedReports(),
    getSyncedWatchlist(),
  ]);
  const watchlist = syncedWatchlist.items ?? [];
  const riskData = analyzeRisks({ watchlist, newsEvents: newsSnapshot.stockNews, marketData: market });
  return {
    market,
    news: newsSnapshot.stockNews,
    announcementData: watchlist.flatMap((item) => item.announcements ?? []),
    reports,
    watchlist,
    profile: getInvestmentProfileData(),
    history: await getAiHistoryRecords(),
    riskData,
  };
}

export async function askAiAssistant(question) {
  const context = await getAiAssistantContext();
  const relatedStock = await resolveQuestionStock(question);
  if (relatedStock) {
    context.stockData = relatedStock;
    context.announcementData = relatedStock.announcements ?? [];
    context.news = [...(context.news ?? []), ...(await getStockNews(relatedStock.code))];
    context.riskData = analyzeRisks({ watchlist: [relatedStock], newsEvents: context.news, marketData: context.market });
  }
  return answerInvestmentQuestion(question, context);
}

async function resolveQuestionStock(question) {
  const text = String(question ?? "");
  const code = text.match(/\b(00|30|60|68)\d{4}\b/)?.[0];
  const named = stockDatabase.find((stock) => text.includes(stock.name));
  const query = code ?? named?.code;
  if (!query) return null;
  try {
    return await queryStock(query);
  } catch {
    return null;
  }
}

export async function refreshWorkbenchData() {
  return refreshAllData();
}

export function getInvestmentProfileData() {
  return getInvestmentProfile();
}
