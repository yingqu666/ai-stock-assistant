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
import { buildAiResearchInput, buildPrompt, generateAiAnalysis, generateDailyReports } from "./aiService.js";
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

export const currentDataMode = DATA_MODE;

const navLabels = {
  dashboard: "棣栭〉",
  market: "甯傚満鍒嗘瀽",
  opportunities: "AI鐮旂┒鏈轰細",
  stock: "鑲＄エ鍒嗘瀽",
  watchlist: "鎴戠殑鍏虫敞鑲＄エ",
  dailyReport: "AI鏃ユ姤",
  reportCenter: "鎶ュ憡涓績",
  assistant: "AI鍔╂墜",
  portfolio: "鎶曡祫缁勫悎",
  review: "澶嶇洏鍒嗘瀽",
  riskDashboard: "椋庨櫓鐪嬫澘",
  industryResearch: "琛屼笟鐮旂┒",
  profile: "鎴戠殑鎶曡祫妗ｆ",
  account: "鎴戠殑璐︽埛",
  team: "AI鐮旂┒鍥㈤槦",
  systemStatus: "系统状态",
  settings: "绯荤粺璁剧疆",
};

const portfolioKey = "ai-investment-user-portfolio";
let portfolioState = loadPortfolio();
let selectedStockQuery = stockDatabase[0].code;
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
  const [market, newsSnapshot, watchlistSnapshot] = await Promise.all([
    getCachedMarketData(),
    getCachedNewsData(),
    getCachedWatchlistData(),
  ]);
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
    aiSummary,
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
  const [watchlistSnapshot, newsSnapshot, marketData] = await Promise.all([getCachedWatchlistData(), getCachedNewsData(), getCachedMarketData()]);
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
  const [stockDetail, marketData, stockNews] = await Promise.all([
    queryStock(selectedStockQuery),
    getMarketSnapshot(),
    getStockNews(selectedStockQuery),
  ]);
  const stockEvents = getStockEvents(stockDetail.code);
  const aiInput = buildAiResearchInput({
    marketData,
    stockQuote: stockDetail,
    newsEvents: stockNews,
    investmentProfile: getInvestmentProfileData(),
    historicalReports: await getSavedReports(),
  });
  const aiAnalysis = await generateAiAnalysis(aiInput);
  const aiPrompt = buildPrompt(aiInput);
  return { stockDetail, stockDatabase, stockNews, stockEvents, aiInput, aiPrompt, aiAnalysis };
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
  const [marketData, newsSnapshot, watchlistSnapshot] = await Promise.all([
    getCachedMarketData(),
    getCachedNewsData(),
    getCachedWatchlistData(),
  ]);
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
  const [market, newsSnapshot, reports, watchlistSnapshot] = await Promise.all([
    getCachedMarketData(),
    getCachedNewsData(),
    getSavedReports(),
    getCachedWatchlistData(),
  ]);
  return {
    market,
    news: newsSnapshot.stockNews,
    reports,
    watchlist: watchlistSnapshot,
    profile: getInvestmentProfileData(),
    history: await getAiHistoryRecords(),
  };
}

export async function askAiAssistant(question) {
  const context = await getAiAssistantContext();
  const relatedStock = await resolveQuestionStock(question);
  if (relatedStock) {
    context.stockData = relatedStock;
    context.news = [...(context.news ?? []), ...(await getStockNews(relatedStock.code))];
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

