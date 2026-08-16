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
import { findMockStock, getStockEvents, getWatchlistSnapshot, queryStock, searchStocks } from "./stockService.js";
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
  const fullMarketNews = dedupeNewsEvents([...(newsSnapshot.stockNews ?? []), ...(newsSnapshot.news ?? [])]);
  const aiSummary = await generateAiAnalysis({
    marketData: market,
    newsEvents: fullMarketNews,
    riskData: risks,
  });
  const realtimeOpportunityPool = await withTimeout(
    getAiOpportunityPool(),
    12000,
    () => ({ opportunities: [], source: "实时机会池生成超时", dataStatus: "数据不足", updatedAt: market.updatedAt }),
  );
  return {
    ...market,
    opportunities: realtimeOpportunityPool.opportunities ?? [],
    opportunitySource: realtimeOpportunityPool.source,
    opportunityStatus: realtimeOpportunityPool.dataStatus,
    news: newsSnapshot.news,
    importantNews: fullMarketNews.slice(0, 6),
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

function dedupeNewsEvents(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.title ?? item?.headline;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getMarketData() {
  return getCachedMarketData();
}

export function getOpportunityData() {
  return { opportunities };
}

export async function getAiOpportunityPool() {
  const [marketData, newsSnapshot, syncedWatchlist] = await Promise.all([
    getCachedMarketData().catch(() => ({ hotSectors: [], marketSentiment: {}, source: "行情数据不足" })),
    getCachedNewsData().catch(() => ({ stockNews: [], news: [], source: "新闻数据不足" })),
    getSyncedWatchlist().catch(() => ({ items: [] })),
  ]);
  const candidates = await buildOpportunityCandidates(marketData, newsSnapshot, syncedWatchlist.items ?? []);
  const codes = [...new Set(candidates.map((item) => item.code).filter(Boolean))].slice(0, 24);
  if (!codes.length) {
    return {
      opportunities: [],
      source: `${marketData.source ?? "行情服务"}；热点板块未返回可查询候选`,
      updatedAt: marketData.updatedAt ?? getRefreshStatus().updatedAt,
      dataStatus: "数据不足",
    };
  }
  const candidateByCode = new Map(candidates.map((item) => [item.code, item]));
  const results = await Promise.allSettled(codes.map((code) => withTimeout(queryStock(code), 5000, () => withUnavailableOpportunityStock(code))));
  const stocks = results.map((result, index) => {
    const stock = result.status === "fulfilled" ? result.value : withUnavailableOpportunityStock(codes[index]);
    const candidate = candidateByCode.get(codes[index]) ?? {};
    return stock?.code ? { ...stock, opportunitySector: candidate.sector, opportunityReason: candidate.reason } : { ...stock, code: codes[index], name: stock?.name || candidate.name || codes[index], opportunitySector: candidate.sector, opportunityReason: candidate.reason };
  });
  const pool = stocks
    .filter((stock) => hasUsableQuote(stock) && isOpportunityTradableStock(stock))
    .map((stock) => buildOpportunityItem(stock, marketData, newsSnapshot, stock.opportunitySector))
    .filter((item) => !String(item.dataStatus ?? "").includes("数据不足"))
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 10);
  return {
    opportunities: pool,
    source: `${marketData.source ?? "行情服务"}；候选来自真实热点板块TOP${marketData.hotSectors?.length ?? 0}`,
    updatedAt: marketData.updatedAt ?? getRefreshStatus().updatedAt,
    dataStatus: pool.length ? (marketData.dataStatus ?? "部分真实") : "数据不足",
  };
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

async function buildOpportunityCandidates(marketData = {}, newsSnapshot = {}, watchlistItems = []) {
  const sectors = (marketData.hotSectors ?? []).slice(0, 12);
  const candidates = new Map();
  const addCandidate = (code, sector, reason, name = "") => {
    const normalized = normalizeOpportunityCode(code);
    if (!normalized) return;
    if (!isOpportunityTradableCode(normalized)) return;
    const existing = candidates.get(normalized);
    if (!existing || sectorScore(sector) > sectorScore(existing.sector)) {
      candidates.set(normalized, { code: normalized, name, sector, reason });
    }
  };

  sectors.forEach((sector) => {
    addCandidate(sector.leaderSymbol, sector, `热点板块领涨标的：${sector.name}`, sector.leaderName);
  });

  const sectorSearches = await Promise.allSettled(sectors.map(async (sector) => {
    const keywords = opportunitySearchKeywords(sector).slice(0, 3);
    const rows = [];
    for (const keyword of keywords) {
      const found = await withTimeout(searchStocks(keyword), 3500, () => []);
      rows.push(...found.slice(0, 3).map((stock) => ({ stock, keyword, sector })));
    }
    return rows;
  }));

  sectorSearches.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach(({ stock, keyword, sector }) => {
      addCandidate(stock.code, sector, `热点板块关键词匹配：${sector.name}/${keyword}`, stock.name);
    });
  });

  const hotNews = [...(newsSnapshot.stockNews ?? []), ...(newsSnapshot.news ?? [])];
  hotNews.slice(0, 12).forEach((item) => {
    (item.relatedStocks ?? []).forEach((code) => {
      const sector = sectors.find((entry) => newsMatchesSector(item, entry));
      if (sector) addCandidate(code, sector, `新闻催化匹配：${item.title}`, code);
    });
  });

  watchlistItems.forEach((stock) => {
    const sector = sectors.find((entry) => stockMatchesSector(stock, entry));
    if (sector) addCandidate(stock.code, sector, `自选股与热点板块匹配：${sector.name}`, stock.name);
  });

  return [...candidates.values()].sort((a, b) => sectorScore(b.sector) - sectorScore(a.sector));
}

function buildOpportunityItem(stock = {}, marketData = {}, newsSnapshot = {}, preferredSector = null) {
  const relatedNews = findRelatedOpportunityNews(stock, newsSnapshot);
  const relatedCatalysts = [...relatedNews, ...(stock.announcements ?? [])];
  const hotSector = preferredSector ?? findRelatedHotSector(stock, marketData.hotSectors ?? []);
  const scoreParts = scoreOpportunity(stock, hotSector, relatedCatalysts, marketData);
  const rankScore = scoreParts.total;
  const judgment = opportunityJudgment(rankScore, stock);
  const priceObservation = buildOpportunityPriceObservation(stock, scoreParts, hotSector);
  return {
    name: stock.name ?? stock.code ?? "标的数据不足",
    code: stock.code ?? "",
    assetType: stock.assetType ?? (String(stock.name ?? "").includes("ETF") ? "ETF" : "股票"),
    currentJudgment: judgment,
    score: rankScore,
    rankScore,
    price: stock.price ?? DATA_MISSING,
    changePercent: stock.changePercent ?? DATA_MISSING,
    recentHigh: stock.highPrice ?? priceObservation.recentHigh,
    recentLow: stock.lowPrice ?? priceObservation.recentLow,
    dataSource: stock.dataSource ?? stock.quoteSource ?? "行情来源未返回",
    dataStatus: stock.dataStatus ?? "数据不足",
    updatedAt: stock.updatedAt ?? marketData.updatedAt ?? getRefreshStatus().updatedAt,
    reasons: [
      `行业趋势：${hotSector ? `${hotSector.name}位于热点池，${hotSector.status ?? hotSector.changePercent ?? "活跃"}` : `${stock.industry ?? "行业数据暂缺"}暂未匹配到强热点`}`,
      `资金表现：成交额${stock.amount ?? DATA_MISSING}，成交量${stock.volume ?? DATA_MISSING}，${stock.capitalFlow ?? "资金流字段未返回"}`,
      stock.assetType === "ETF"
        ? `公司基本面：ETF不适用公司财务，重点观察${stock.trackingIndex ?? "跟踪指数"}、规模和流动性`
        : `公司基本面：营收${stock.financials?.revenue ?? DATA_MISSING}，净利润${stock.financials?.netProfit ?? DATA_MISSING}，ROE${stock.financials?.roe ?? DATA_MISSING}`,
      `新闻/公告影响：${relatedCatalysts[0] ? `${relatedCatalysts[0].title}（${relatedCatalysts[0].source ?? "新闻/公告"}，${relatedCatalysts[0].impact ?? relatedCatalysts[0].analysis?.direction ?? "中性"}）` : "未匹配到强相关新闻或公告，机会评分已降低"}`,
      stock.opportunityReason ? `入选路径：${stock.opportunityReason}` : "",
    ].filter(Boolean),
    risks: [
      `估值风险：${stock.assetType === "ETF" ? "ETF需结合跟踪指数估值和溢价率" : `PE ${stock.pe ?? DATA_MISSING}，PB ${stock.pb ?? DATA_MISSING}`}`,
      `行业风险：${hotSector?.name ?? stock.industry ?? "相关行业"}若热点退潮或政策预期变化，持续性会下降`,
      `市场风险：若指数走弱、成交额萎缩或赚钱效应下降，机会池标的也可能同步回撤`,
    ],
    priceObservation,
    giveUpCondition: buildOpportunityGiveUpCondition(stock, hotSector, marketData),
    scoreParts,
    relatedNews: relatedCatalysts.slice(0, 3),
  };
}

function normalizeOpportunityCode(value = "") {
  const text = String(value ?? "").trim();
  const match = text.match(/(?:sh|sz|bj)?(\d{6})/i);
  return match?.[1] ?? "";
}

function isOpportunityTradableCode(code = "") {
  const text = String(code);
  return /^(000|001|002|003|300|301|600|601|603|605|688|830|831|832|833|834|835|836|837|838|839|920|51|52|56|58|15|16)\d{3}$/.test(text);
}

function isOpportunityTradableStock(stock = {}) {
  const code = String(stock.code ?? "");
  const text = `${stock.name ?? ""}${stock.assetType ?? ""}${stock.market ?? ""}${stock.industry ?? ""}`;
  if (!isOpportunityTradableCode(code)) return false;
  if (/指数|上证|深证成指|创业板指|中证|沪深300|科创50/.test(text) && !/ETF|基金/.test(text)) return false;
  return /ETF|基金/.test(text) || /^(000|001|002|003|300|301|600|601|603|605|688|830|831|832|833|834|835|836|837|838|839|920)\d{3}$/.test(code);
}

function sectorScore(sector = {}) {
  return Math.round(
    Math.max(0, parseOpportunityNumber(sector.changePercent ?? sector.change)) * 6
    + Math.min(35, parseOpportunityNumber(sector.amount ?? sector.turnover) / 100)
    + Math.max(0, 20 - Number(sector.heatRank ?? sector.rank ?? 12)),
  );
}

function opportunitySearchKeywords(sector = {}) {
  const name = String(sector.name ?? "").replace(/行业|板块/g, "").trim();
  const aliases = {
    电子信息: ["电子信息", "半导体", "通信"],
    电子器件: ["电子器件", "半导体", "芯片"],
    机械: ["机械", "机器人", "工业母机"],
    有色金属: ["有色金属", "资源", "稀土"],
    化工: ["化工", "化纤", "材料"],
    生物制药: ["生物制药", "医药", "创新药"],
    汽车制造: ["汽车", "新能源车"],
    电力: ["电力", "储能"],
    通信: ["通信", "5G"],
  };
  const matched = Object.entries(aliases).find(([key]) => name.includes(key) || key.includes(name));
  return [...new Set([name, ...(matched?.[1] ?? [])].filter(Boolean))];
}

function newsMatchesSector(item = {}, sector = {}) {
  const text = `${item.title ?? ""}${item.summary ?? ""}${item.relatedIndustry ?? ""}${(item.relatedIndustries ?? []).join("")}`;
  return opportunitySearchKeywords(sector).some((keyword) => keyword && text.includes(keyword));
}

function stockMatchesSector(stock = {}, sector = {}) {
  const text = `${stock.name ?? ""}${stock.industry ?? ""}${stock.aiOpinion ?? ""}${stock.latestNews ?? ""}`;
  return opportunitySearchKeywords(sector).some((keyword) => keyword && text.includes(keyword));
}

function buildOpportunityGiveUpCondition(stock = {}, hotSector = {}, marketData = {}) {
  const riskRange = buildOpportunityPriceObservation(stock, {}, hotSector).riskRange;
  const sectorName = hotSector?.name ?? stock.industry ?? "相关板块";
  const breadth = marketData.marketSentiment ?? {};
  return [
    `价格跌破风险区域 ${riskRange}`,
    `${sectorName}退出热点TOP12或成交额明显萎缩`,
    `市场赚钱效应转弱，上涨家数低于下跌家数且跌停数量扩大`,
    `公告/新闻出现利空，或财务质量无法支撑当前估值`,
  ].join("；");
}

function scoreOpportunity(stock = {}, hotSector, relatedNews = [], marketData = {}) {
  const industryHeat = hotSector ? 18 : 9;
  const capital = /亿/.test(String(stock.amount ?? "")) ? 16 : /万/.test(String(stock.amount ?? "")) ? 11 : 6;
  const weakFinancial = hasWeakFinancials(stock);
  const quality = stock.assetType === "ETF" ? 12 : weakFinancial ? 5 : (hasRealField(stock.financials?.netProfit) || hasRealField(stock.marketCap) ? 14 : 8);
  const financial = stock.assetType === "ETF" ? 12 : weakFinancial ? 4 : (hasRealField(stock.financials?.roe) || hasRealField(stock.financials?.revenue) ? 15 : 7);
  const news = relatedNews.length ? 16 : -6;
  const valuation = scoreOpportunityValuation(stock);
  const riskPenalty = opportunityRiskPenalty(stock, marketData);
  const rawTotal = Math.round(industryHeat + capital + quality + financial + news + valuation - riskPenalty);
  const capped = relatedNews.length ? rawTotal : Math.min(rawTotal, 72);
  const total = Math.max(0, Math.min(100, capped));
  return { industryHeat, capital, quality, financial, news, valuation, riskPenalty, catalystCount: relatedNews.length, total };
}

function scoreOpportunityValuation(stock = {}) {
  if (stock.assetType === "ETF") return 12;
  const pe = parseOpportunityNumber(stock.pe);
  const pb = parseOpportunityNumber(stock.pb);
  let score = 8;
  if (Number.isFinite(pe) && pe > 0 && pe <= 35) score += 5;
  if (Number.isFinite(pb) && pb > 0 && pb <= 4) score += 4;
  if (Number.isFinite(pe) && pe > 80) score -= 5;
  return Math.max(2, Math.min(17, score));
}

function opportunityRiskPenalty(stock = {}, marketData = {}) {
  let penalty = 0;
  const change = parseOpportunityNumber(stock.changePercent);
  const pe = parseOpportunityNumber(stock.pe);
  const pb = parseOpportunityNumber(stock.pb);
  if (Number.isFinite(change) && change >= 7) penalty += 10;
  if (Number.isFinite(change) && change <= -5) penalty += 8;
  if (Number.isFinite(pe) && pe < 0) penalty += 14;
  if (Number.isFinite(pe) && pe > 90) penalty += 12;
  if (Number.isFinite(pe) && pe > 180) penalty += 8;
  if (Number.isFinite(pb) && pb > 6) penalty += 8;
  if (Number.isFinite(pb) && pb > 12) penalty += 6;
  if (hasWeakFinancials(stock)) penalty += 12;
  if (marketData.marketSentiment?.moneyEffect === "偏弱") penalty += 6;
  if (String(stock.dataStatus ?? "").includes("不足")) penalty += 12;
  return penalty;
}

function opportunityJudgment(score, stock = {}) {
  if (String(stock.dataStatus ?? "").includes("不足")) return "暂不参与";
  if (score >= 78) return "重点关注";
  if (score >= 62) return "可以观察";
  if (score >= 45) return "等待机会";
  return "暂不参与";
}

function buildOpportunityPriceObservation(stock = {}, scoreParts = {}, hotSector) {
  const price = parseOpportunityNumber(stock.price);
  const high = parseOpportunityNumber(stock.highPrice);
  const low = parseOpportunityNumber(stock.lowPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      recentHigh: "数据不足",
      recentLow: "数据不足",
      watchRange: "数据不足",
      pressureRange: "数据不足",
      riskRange: "数据不足",
      logic: "当前价格数据不足，不能生成价格观察区间。",
    };
  }
  const recentHigh = Number.isFinite(high) && high > 0 ? high : price * 1.04;
  const recentLow = Number.isFinite(low) && low > 0 ? low : price * 0.96;
  const buffer = Math.max(price * 0.015, (recentHigh - recentLow) * 0.25);
  const watchLow = Math.max(recentLow, price - buffer);
  const watchHigh = Math.min(recentHigh, price + buffer * 0.6);
  const pressure = Math.max(recentHigh, price * 1.035);
  const risk = Math.min(recentLow, price * 0.96);
  return {
    recentHigh: formatOpportunityPrice(recentHigh),
    recentLow: formatOpportunityPrice(recentLow),
    watchRange: `${formatOpportunityPrice(watchLow)}-${formatOpportunityPrice(watchHigh)}`,
    pressureRange: formatOpportunityPrice(pressure),
    riskRange: formatOpportunityPrice(risk),
    logic: `观察区间基于当前价、日内高低点、资金活跃度和${hotSector ? `${hotSector.name}热度` : "行业趋势"}估算；不满足成交确认时避免参与。`,
  };
}

function findRelatedHotSector(stock = {}, hotSectors = []) {
  const industry = String(stock.industry ?? "");
  const name = String(stock.name ?? "");
  return hotSectors.find((sector) => {
    const sectorName = String(sector.name ?? "");
    return sectorName && (industry.includes(sectorName) || sectorName.includes(industry) || name.includes(sectorName));
  });
}

function findRelatedOpportunityNews(stock = {}, newsSnapshot = {}) {
  const rows = [...(newsSnapshot.stockNews ?? []), ...(newsSnapshot.news ?? [])];
  const code = String(stock.code ?? "");
  const name = String(stock.name ?? "");
  const industry = String(stock.industry ?? "");
  return rows.filter((item) => {
    const text = `${item.title ?? ""}${item.relatedStock ?? ""}${(item.relatedStocks ?? []).join("")}${item.relatedIndustry ?? ""}${(item.relatedIndustries ?? []).join("")}`;
    return (code && text.includes(code)) || (name && text.includes(name)) || (industry && text.includes(industry));
  });
}

function withUnavailableOpportunityStock(code) {
  return {
    code,
    name: code,
    price: DATA_MISSING,
    changePercent: DATA_MISSING,
    amount: DATA_MISSING,
    volume: DATA_MISSING,
    industry: "行业数据暂缺",
    dataStatus: "数据不足",
    dataSource: "真实行情未返回",
    updatedAt: getRefreshStatus().updatedAt,
    financials: {},
  };
}

function hasRealField(value) {
  return Boolean(value) && !/暂无|缺失|未返回|不适用|数据源/.test(String(value));
}

function hasWeakFinancials(stock = {}) {
  if (stock.assetType === "ETF") return false;
  const netProfit = parseOpportunityNumber(stock.financials?.netProfit);
  const roe = parseOpportunityNumber(stock.financials?.roe);
  const grossMargin = parseOpportunityNumber(stock.financials?.grossMargin);
  return (Number.isFinite(netProfit) && netProfit < 0)
    || (Number.isFinite(roe) && roe < 0)
    || (Number.isFinite(grossMargin) && grossMargin < 0);
}

function parseOpportunityNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function formatOpportunityPrice(value) {
  return Number.isFinite(value) ? value.toFixed(value >= 100 ? 1 : 2) : "数据不足";
}
