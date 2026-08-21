import { buildAiResearchInput, generateAiAnalysis, generateDailyReports } from "./aiService.js";
import { getMarketSnapshot } from "./marketService.js";
import { buildNotificationText, notifyUser } from "./notificationService.js";
import { getNewsSnapshot } from "./newsService.js";
import { getPortfolioSummary } from "./portfolioService.js";
import { analyzeRisks } from "./riskService.js";
import { saveSyncedReport, syncReports } from "./syncService.js";
import { getSyncedWatchlist } from "./watchlistSyncService.js";
import { getInvestmentProfile } from "./investmentProfileService.js";

const schedulerStateKey = "ai-investment-report-scheduler-state-v1";
const schedulerRunsKey = "ai-investment-report-scheduler-runs-v1";
const scheduleConfig = [
  {
    id: "morning-auto",
    name: "自动早盘日报",
    time: "每天08:00",
    hour: 8,
    minute: 0,
    windowEndHour: 11,
    description: "生成市场日报、今日主线、风险方向和AI观察池。",
  },
  {
    id: "close-auto",
    name: "自动收盘复盘",
    time: "每天20:00",
    hour: 20,
    minute: 0,
    windowEndHour: 23,
    description: "生成市场复盘、昨日判断验证和明日关注方向。",
  },
];

let lastTaskStatus = {
  marketUpdated: false,
  newsFetched: false,
  reportGenerated: false,
  lastRunAt: "尚未生成",
  schedulerMode: "浏览器本地定时",
  schedulerStarted: false,
  activeTask: "",
  lastMorningRunAt: "尚未生成",
  lastCloseRunAt: "尚未生成",
  lastWatchlistChangeAt: "尚未分析",
  lastPortfolioReportAt: "尚未生成",
  lastError: "",
};
let schedulerTimer = null;
let taskRunning = false;

export function getTaskSchedule() {
  return [
    ...scheduleConfig.map(({ id, name, time, description }) => ({ id, name, time, description })),
    { id: "manual", name: "手动生成AI日报", time: "用户点击", description: "获取行情、新闻、自选股、持仓和投资档案后生成今日研究报告。" },
  ];
}

export function getTaskStatus() {
  const saved = loadSchedulerState();
  return {
    ...lastTaskStatus,
    ...saved,
    schedulerStarted: lastTaskStatus.schedulerStarted || saved.schedulerStarted || false,
    activeTask: lastTaskStatus.activeTask || "",
    lastError: lastTaskStatus.lastError || saved.lastError || "",
  };
}

export async function getSavedReports() {
  return (await syncReports()).data;
}

export function startReportScheduler() {
  if (schedulerTimer) return getTaskStatus();
  lastTaskStatus = {
    ...getTaskStatus(),
    schedulerStarted: true,
    schedulerMode: "浏览器本地定时",
  };
  checkScheduledReportTasks();
  schedulerTimer = window.setInterval(checkScheduledReportTasks, 60 * 1000);
  return lastTaskStatus;
}

export function stopReportScheduler() {
  if (schedulerTimer) window.clearInterval(schedulerTimer);
  schedulerTimer = null;
}

export async function runReportTask(type = "manual") {
  if (taskRunning) {
    return {
      id: `skipped-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      type,
      title: "AI日报任务已跳过",
      generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      content: { message: "已有日报任务正在运行，本次任务已跳过。" },
    };
  }
  taskRunning = true;
  lastTaskStatus = { ...getTaskStatus(), activeTask: normalizeTaskName(type), lastError: "" };
  try {
    const [marketData, newsSnapshot, syncedWatchlist, savedReports, portfolioSummary] = await Promise.all([
    getMarketSnapshot(),
    getNewsSnapshot(),
    getSyncedWatchlist(),
    syncReports(),
    getPortfolioSummary().catch((error) => ({
      positions: [],
      todayPnl: 0,
      totalPnl: 0,
      industryAllocation: [],
      concentrationRisk: { level: "未知", message: `组合数据暂不可用：${error.message}` },
      aiAnalysis: {},
    })),
  ]);
  const watchlist = syncedWatchlist.items ?? [];
  const profile = getInvestmentProfile();
  const risks = analyzeRisks({ watchlist, newsEvents: newsSnapshot.stockNews, marketData });
  const watchlistChanges = buildWatchlistChangeAnalysis(watchlist, marketData, newsSnapshot, risks);
  const portfolioDaily = buildPortfolioDailyReport(portfolioSummary, marketData);
  const yesterdayReview = buildYesterdayJudgementReview(savedReports.data ?? [], marketData);

  const aiInput = buildAiResearchInput({
    marketData,
    stockQuote: null,
    newsEvents: [...(newsSnapshot.stockNews ?? []), ...(newsSnapshot.news ?? [])],
    riskData: risks,
    investmentProfile: profile,
    portfolio: portfolioSummary?.positions ?? [],
    historicalReports: savedReports.data ?? [],
  });
  const aiAnalysis = await generateAiAnalysis(aiInput);
  const rawReport = generateDailyReports({
    marketData,
    newsEvents: [...(newsSnapshot.stockNews ?? []), ...(newsSnapshot.news ?? [])],
    watchlist,
    investmentProfile: profile,
    riskAlerts: risks,
  });
  const report = normalizeDailyReport(rawReport, {
    marketData,
    newsEvents: [...(newsSnapshot.stockNews ?? []), ...(newsSnapshot.news ?? [])],
    watchlist,
    risks,
    profile,
    aiAnalysis,
    newsSnapshot,
    portfolioSummary,
    portfolioDaily,
    watchlistChanges,
    yesterdayReview,
    taskType: type,
  });

  const record = {
    id: `${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    type,
    title: buildReportTitle(type),
    generatedAt: report.generatedAt,
    score: report.morning.score,
    marketState: report.morning.marketState,
    mainView: report.morning.strategy,
    content: report,
    sourceData: ["东方财富/新浪/腾讯行情", "东方财富公告/快讯", "stockService", "portfolioService", "riskService", aiAnalysis.source ?? "aiService"],
  };

  await saveSyncedReport(record);
  lastTaskStatus = {
    marketUpdated: true,
    newsFetched: true,
    reportGenerated: true,
    lastRunAt: record.generatedAt,
    schedulerMode: "浏览器本地定时",
    schedulerStarted: Boolean(schedulerTimer),
    activeTask: "",
    lastMorningRunAt: isMorningTask(type) ? record.generatedAt : getTaskStatus().lastMorningRunAt,
    lastCloseRunAt: isCloseTask(type) ? record.generatedAt : getTaskStatus().lastCloseRunAt,
    lastWatchlistChangeAt: record.generatedAt,
    lastPortfolioReportAt: record.generatedAt,
    lastError: "",
  };
  saveSchedulerRun(type, record);

  const message = buildNotificationText(notificationTypeForTask(type));
  notifyUser(message.title, message.body);
  return record;
  } catch (error) {
    lastTaskStatus = {
      ...getTaskStatus(),
      activeTask: "",
      lastError: `${normalizeTaskName(type)}失败：${error.message}`,
    };
    throw error;
  } finally {
    taskRunning = false;
  }
}

function normalizeDailyReport(report, { marketData, newsEvents, watchlist, risks, profile, aiAnalysis, newsSnapshot, portfolioSummary, portfolioDaily, watchlistChanges, yesterdayReview, taskType }) {
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const strategy = marketData.strategy ?? {};
  const sentiment = marketData.marketSentiment ?? {};
  const hotDirections = normalizeHotDirections(aiAnalysis?.hotDirections, marketData, newsEvents);
  const hotNames = hotDirections.map((item) => item.name);
  const watchNames = (watchlist ?? []).map((item) => item.name).filter(Boolean).slice(0, 5);
  const watchlistAnalysis = buildWatchlistDailyAnalysis(watchlist, marketData, newsEvents, risks);
  const riskTexts = normalizeRiskTexts(aiAnalysis?.risks ?? risks, report.morning?.risks);
  const quality = report.morning?.quality ?? report.close?.quality ?? scoreQuality({ marketData, newsEvents, risks });
  const marketSummary = aiAnalysis?.marketSummary ?? report.close?.marketSummary ?? report.morning?.marketSummary ?? sentiment.summary ?? "市场处于结构性观察阶段。";
  const investmentDecision = aiAnalysis?.investmentDecision ?? report.morning?.investmentDecision ?? {};
  const nextFocus = aiAnalysis?.tomorrowPlan ?? report.close?.nextFocus ?? [...hotNames, ...watchNames, "观察成交额变化", "检查自选股公告"].slice(0, 6);
  const evidence = aiAnalysis?.evidence ?? report.morning?.evidence ?? {};
  const aiSource = normalizeAiSource(aiAnalysis);

  return {
    generatedAt,
    morning: {
      date: new Date().toLocaleDateString("zh-CN"),
      investmentDecision,
      generatedAt,
      score: strategy.score ?? investmentDecision.score ?? report.morning?.score ?? 70,
      marketState: strategy.state ?? report.morning?.marketState ?? sentiment.summary ?? "震荡观察",
      marketSummary,
      marketDaily: {
        summary: marketSummary,
        indices: (marketData.marketOverview ?? []).slice(0, 3),
        breadth: {
          upCount: sentiment.upCount,
          downCount: sentiment.downCount,
          flatCount: sentiment.flatCount,
          limitUpCount: sentiment.limitUpCount,
          limitDownCount: sentiment.limitDownCount,
          turnover: sentiment.amount ?? sentiment.turnover,
        },
        dataSource: marketData.source ?? marketData.dataSource ?? "真实行情接口",
      },
      mainDirection: hotDirections.slice(0, 5),
      riskDirections: riskTexts.slice(0, 5),
      aiObservationPool: buildAiObservationPool(watchlistAnalysis, hotDirections),
      marketAnalysis: {
        title: "今日A股市场分析",
        performance: marketSummary,
        strength: `上涨 ${sentiment.upCount ?? "数据源未返回"} 家，下跌 ${sentiment.downCount ?? "数据源未返回"} 家，市场热度 ${sentiment.heat ?? "数据源未返回"}。`,
        factors: buildMarketFactors(marketData, newsEvents),
      },
      hotDirections,
      riseReason: hotDirections.slice(0, 3).map((item) => `${item.name}：${item.reason}`).join("；") || "今日主线仍需结合成交确认。",
      downsideRisk: riskTexts.join("；") || "成交不足、热点轮动过快和外部扰动可能压制风险偏好。",
      strategy: aiAnalysis?.conclusion ?? aiAnalysis?.summary ?? `今日重点观察${hotNames.join("、") || "市场结构性机会"}，不追高。`,
      focus: hotNames,
      watchFocus: watchNames,
      watchlistAnalysis,
      watchlistChanges,
      portfolioDaily,
      risks: riskTexts,
      tomorrowPlan: nextFocus,
      positionAdvice: strategy.position ?? investmentDecision.positionAdvice ?? "保持观察仓位，避免追高。",
      sources: ["东方财富行情", newsSnapshot.source ?? "东方财富公告/快讯", "stockService自选股", "riskService", aiSource],
      basis: `基于指数、成交额、涨跌家数、热点行业、新闻事件、自选股和投资档案生成。行情更新时间：${marketData.updatedAt ?? generatedAt}；新闻更新时间：${newsSnapshot.updatedAt ?? generatedAt}。`,
      evidence,
      credibility: aiAnalysis?.credibility ?? report.morning?.credibility ?? {},
      quality,
      aiStatus: aiSource,
    },
    close: {
      date: new Date().toLocaleDateString("zh-CN"),
      investmentDecision,
      generatedAt,
      performance: marketSummary,
      marketSummary,
      marketReview: {
        summary: marketSummary,
        breadth: `上涨 ${sentiment.upCount ?? "数据源未返回"} 家，下跌 ${sentiment.downCount ?? "数据源未返回"} 家。`,
        hotDirections: hotDirections.slice(0, 6),
      },
      yesterdayReview,
      breadth: `上涨 ${sentiment.upCount ?? "数据源未返回"} 家，下跌 ${sentiment.downCount ?? "数据源未返回"} 家。`,
      hotSectors: hotNames,
      hotDirections,
      hotAnalysis: hotDirections.map((item) => `${item.name}：${item.reason}；催化：${item.catalyst}；持续性：${item.sustainability}；风险：${item.risk}`).join("\n"),
      events: (newsEvents ?? []).slice(0, 5).map((item) => `${item.title}：${item.impact ?? item.category ?? "中性"}，来源 ${item.source ?? "新闻接口"}`),
      summary: `今日市场总结：${marketSummary}`,
      aiReview: "当日判断需要结合后续市场和板块表现复盘，不代表未来结果。",
      nextFocus,
      tomorrowFocus: nextFocus,
      watchlistChanges,
      portfolioDaily,
      positionAdvice: strategy.position ?? investmentDecision.positionAdvice ?? "控制仓位，关注风险收益比。",
      sources: ["东方财富行情", newsSnapshot.source ?? "东方财富公告/快讯", "stockService", aiSource],
      basis: `基于收盘行情、新闻变化、关注股票表现和风险信号生成。行情更新时间：${marketData.updatedAt ?? generatedAt}；新闻更新时间：${newsSnapshot.updatedAt ?? generatedAt}。`,
      evidence,
      credibility: aiAnalysis?.credibility ?? report.close?.credibility ?? {},
      quality,
      aiStatus: aiSource,
    },
    history: report.history ?? [],
    taskType,
  };
}

async function checkScheduledReportTasks() {
  if (taskRunning) return;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  for (const task of scheduleConfig) {
    if (!isWithinTaskWindow(now, task) || hasRunTask(task.id, today)) continue;
    try {
      await runReportTask(task.id);
    } catch (error) {
      lastTaskStatus = {
        ...getTaskStatus(),
        activeTask: "",
        lastError: `${task.name}失败：${error.message}`,
      };
      saveSchedulerState(lastTaskStatus);
    }
    break;
  }
}

function isWithinTaskWindow(now, task) {
  const start = new Date(now);
  start.setHours(task.hour, task.minute, 0, 0);
  const end = new Date(now);
  end.setHours(task.windowEndHour, 59, 59, 999);
  return now >= start && now <= end;
}

function hasRunTask(taskId, date) {
  return loadSchedulerRuns().some((item) => item.taskId === taskId && item.date === date);
}

function saveSchedulerRun(type, record) {
  const date = record.date ?? new Date().toISOString().slice(0, 10);
  const runs = loadSchedulerRuns().filter((item) => !(item.taskId === type && item.date === date));
  const nextRuns = [{ taskId: type, date, generatedAt: record.generatedAt, reportId: record.id }, ...runs].slice(0, 60);
  window.localStorage.setItem(schedulerRunsKey, JSON.stringify(nextRuns));
  saveSchedulerState(lastTaskStatus);
}

function loadSchedulerRuns() {
  try {
    return JSON.parse(window.localStorage.getItem(schedulerRunsKey) ?? "[]");
  } catch {
    return [];
  }
}

function loadSchedulerState() {
  try {
    return JSON.parse(window.localStorage.getItem(schedulerStateKey) ?? "null") ?? {};
  } catch {
    return {};
  }
}

function saveSchedulerState(status) {
  window.localStorage.setItem(schedulerStateKey, JSON.stringify(status));
}

function buildReportTitle(type) {
  if (isMorningTask(type)) return "AI早盘投资研究日报";
  if (isCloseTask(type)) return "AI收盘复盘报告";
  return "今日AI投资研究日报";
}

function normalizeTaskName(type) {
  if (isMorningTask(type)) return "早盘自动日报";
  if (isCloseTask(type)) return "收盘自动复盘";
  return "手动生成AI日报";
}

function notificationTypeForTask(type) {
  if (isMorningTask(type)) return "morning";
  if (isCloseTask(type)) return "close";
  return "manual-report";
}

function isMorningTask(type) {
  return type === "morning-auto" || type === "morning" || type === "早盘";
}

function isCloseTask(type) {
  return type === "close-auto" || type === "close" || type === "收盘";
}

function normalizeHotDirections(aiHotDirections, marketData = {}, newsEvents = []) {
  if (Array.isArray(aiHotDirections) && aiHotDirections.length) return aiHotDirections.slice(0, 5);
  const sectors = (marketData.hotSectors ?? []).slice(0, 8);
  const source = sectors.length ? sectors : inferSectorsFromNews(newsEvents);
  return source.slice(0, 5).map((item) => {
    const name = item.name ?? item;
    const relatedNews = newsEvents.find((event) => `${event.title ?? ""}${event.relatedIndustry ?? ""}${(event.relatedIndustries ?? []).join("")}`.includes(name));
    return {
      name,
      reason: item.status ?? item.flow ?? item.changePercent ?? "板块活跃度靠前",
      catalyst: relatedNews ? `${relatedNews.title}（${relatedNews.source ?? "新闻"}）` : "暂未匹配到强新闻催化，主要依据行情热度",
      sustainability: item.status?.includes("流入") || item.flow?.includes("流入") ? "持续性偏强，继续看成交延续" : "持续性需观察成交和新闻后续",
      risk: "若成交缩量或高位分歧放大，板块持续性会下降",
    };
  });
}

function inferSectorsFromNews(news = []) {
  const text = JSON.stringify(news);
  const names = [];
  if (/AI|人工智能|算力|服务器/.test(text)) names.push({ name: "AI算力" });
  if (/芯片|半导体/.test(text)) names.push({ name: "半导体" });
  if (/光模块|通信|5G/.test(text)) names.push({ name: "光模块/通信" });
  if (/电力|储能|电网/.test(text)) names.push({ name: "电力储能" });
  if (/消费|白酒/.test(text)) names.push({ name: "消费" });
  return names.length ? names : [{ name: "市场结构性机会" }];
}

function buildMarketFactors(marketData = {}, newsEvents = []) {
  const factors = [];
  if ((marketData.marketOverview ?? []).length) factors.push(...marketData.marketOverview.slice(0, 3).map((item) => `${item.label ?? item.name} ${item.value ?? ""} ${item.change ?? item.changePercent ?? ""}`.trim()));
  if ((marketData.hotSectors ?? []).length) factors.push(`热点方向：${marketData.hotSectors.slice(0, 5).map((item) => item.name).join("、")}`);
  if (newsEvents.length) factors.push(`新闻催化：${newsEvents.slice(0, 3).map((item) => item.title).join("；")}`);
  return factors;
}

export function buildWatchlistChangeAnalysis(watchlist = [], marketData = {}, newsSnapshot = {}, risks = []) {
  const newsEvents = [...(newsSnapshot.stockNews ?? []), ...(newsSnapshot.news ?? [])];
  const hotSectors = marketData.hotSectors ?? [];
  const updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  return watchlist.slice(0, 20).map((stock) => {
    const relatedNews = newsEvents.filter((item) => {
      const text = `${item.title ?? ""}${item.relatedStock ?? ""}${(item.relatedStocks ?? []).join("")}${item.relatedIndustry ?? ""}${(item.relatedIndustries ?? []).join("")}`;
      return text.includes(stock.code) || text.includes(stock.name) || text.includes(stock.industry);
    }).slice(0, 3);
    const relatedHotSector = hotSectors.find((sector) => {
      const text = `${sector.name ?? ""}${sector.reason ?? ""}${sector.aiReason ?? ""}${sector.rankingReason ?? ""}`;
      return text.includes(stock.industry) || String(stock.industry ?? "").includes(sector.name);
    });
    const stockRisks = risks.filter((item) => item.target === stock.name || item.target === stock.code || String(item.message ?? item.title ?? "").includes(stock.name));
    const changeValue = Number(String(stock.changePercent ?? "").replace("%", "").replace("+", ""));
    const priceChange = Number.isFinite(changeValue)
      ? `${changeValue >= 0 ? "上涨" : "下跌"} ${Math.abs(changeValue).toFixed(2)}%`
      : "涨跌幅数据暂缺";
    const attentionChange = buildAttentionChange({ stock, changeValue, relatedNews, relatedHotSector, stockRisks });
    return {
      code: stock.code,
      name: stock.name,
      assetType: stock.assetType ?? "股票",
      price: stock.price ?? "数据源未返回",
      changePercent: stock.changePercent ?? "数据源未返回",
      priceChange,
      attentionChange,
      newsChange: relatedNews[0]?.title ?? "暂无新的强相关新闻",
      hotspotChange: relatedHotSector ? `${relatedHotSector.name}处于热点方向，需观察持续性` : "暂未匹配到TOP热点板块",
      riskChange: stockRisks[0]?.message ?? stockRisks[0]?.title ?? "未出现新增高风险信号",
      updatedAt,
    };
  });
}

export function buildPortfolioDailyReport(portfolioSummary = {}, marketData = {}) {
  const positions = portfolioSummary.positions ?? [];
  const topIndustry = portfolioSummary.industryAllocation?.[0];
  const concentrationRisk = portfolioSummary.concentrationRisk ?? {};
  const todayPnl = Number(portfolioSummary.todayPnl ?? 0);
  const marketHeat = marketData.marketSentiment?.heat ?? marketData.marketSentiment?.moneyEffect ?? "数据源未返回";
  return {
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    positionCount: positions.length,
    todayPnl,
    todayPnlText: `${todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(2)}元`,
    riskLevel: concentrationRisk.level ?? "暂无持仓",
    riskChange: positions.length ? `当前组合风险${concentrationRisk.level ?? "中等"}，需结合市场热度${marketHeat}复核。` : "暂无持仓，未生成组合风险变化。",
    industryConcentration: topIndustry ? `${topIndustry.industry}占比${topIndustry.weight.toFixed(1)}%` : "暂无行业集中度",
    industryChange: topIndustry ? `${topIndustry.industry}是当前主要风险暴露方向。` : "暂无持仓行业变化。",
    summary: positions.length
      ? `今日组合盈亏${todayPnl >= 0 ? "为正" : "为负"}，最大行业集中在${topIndustry?.industry ?? "数据不足"}，不涉及自动交易。`
      : "暂无持仓记录，组合日报仅保留入口。",
    source: portfolioSummary.syncStatus?.source ?? "portfolioService",
  };
}

function buildYesterdayJudgementReview(savedReports = [], marketData = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const previous = savedReports
    .filter((record) => record.date && record.date < today)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!previous) {
    return {
      status: "pending",
      prediction: "暂无昨日AI判断",
      actual: marketData.marketSentiment?.summary ?? "等待市场数据",
      result: "待积累历史报告",
      basis: "需要至少一条前一交易日报告。",
    };
  }
  const predicted = previous.content?.morning?.marketState ?? previous.marketState ?? previous.mainView ?? "历史判断未记录";
  const actual = marketData.marketSentiment?.summary ?? marketData.strategy?.state ?? "当前市场状态数据不足";
  return {
    status: "pending",
    date: previous.date,
    prediction: predicted,
    actual,
    result: "待人工复核",
    basis: `上一份报告生成于${previous.generatedAt ?? previous.date}，本次仅展示对照，不自动判定准确率。`,
  };
}

function buildAiObservationPool(watchlistAnalysis = [], hotDirections = []) {
  const stockIdeas = watchlistAnalysis.slice(0, 5).map((item) => ({
    name: item.name,
    code: item.code,
    rating: item.rating,
    reason: item.reasons?.[0] ?? item.aiOpinion,
    risk: item.risks?.[0] ?? "需观察成交和新闻变化",
  }));
  const sectorIdeas = hotDirections.slice(0, 5).map((item) => ({
    name: item.name,
    code: "板块",
    rating: item.sustainability ?? "持续性观察",
    reason: item.reason,
    risk: item.risk,
  }));
  return [...stockIdeas, ...sectorIdeas].slice(0, 10);
}

function buildAttentionChange({ stock, changeValue, relatedNews, relatedHotSector, stockRisks }) {
  if (stockRisks.length) return "关注变化：风险信号上升，优先复核原因";
  if (relatedNews.length && relatedHotSector) return "关注变化：新闻与热点共振，观察优先级提高";
  if (relatedHotSector) return "关注变化：所属方向进入热点，观察成交延续";
  if (relatedNews.length) return "关注变化：出现相关新闻，复核影响方向";
  if (Number.isFinite(changeValue) && Math.abs(changeValue) >= 3) return "关注变化：价格波动放大，观察是否异动";
  return "关注变化：暂无明显新增变化，维持跟踪";
}

function buildWatchlistDailyAnalysis(watchlist = [], marketData = {}, newsEvents = [], risks = []) {
  return watchlist.map((stock) => {
    const technicalScore = scoreByChange(stock.changePercent);
    const capitalScore = /亿|万/.test(String(stock.amount ?? "")) ? 14 : 8;
    const basicScore = stock.assetType === "ETF" ? 12 : (stock.marketCap && stock.marketCap !== "数据源未返回" ? 14 : 10);
    const relatedNews = newsEvents.filter((item) => String(item.title ?? "").includes(stock.name) || String(item.relatedStock ?? "").includes(stock.code));
    const newsScore = Math.min(20, 10 + relatedNews.length * 3);
    const marketScore = Number(marketData.marketSentiment?.heat ?? 50) >= 60 ? 14 : 10;
    const score = Math.max(0, Math.min(100, Math.round(technicalScore + capitalScore + basicScore + newsScore + marketScore)));
    const stockRisks = risks.filter((item) => item.target === stock.name || item.target === stock.code).map((item) => item.message ?? item.title).filter(Boolean);
    return {
      code: stock.code,
      name: stock.name,
      assetType: stock.assetType ?? "股票",
      score,
      rating: stock.aiRating ?? stock.aiLevel ?? scoreToRating(score),
      riskLevel: stock.riskLevel ?? (score >= 70 ? "中" : "高"),
      latestNews: stock.latestNews ?? relatedNews[0]?.title ?? "暂无强相关新闻，继续观察公告和行情变化。",
      aiOpinion: stock.aiOpinion ?? `${stock.name}当前判断为${scoreToRating(score)}，评分${score}/100仅作辅助，重点跟踪成交额、涨跌幅、新闻公告和行业热度。`,
      shortTerm: score >= 70 ? "1-5天偏强观察" : score >= 50 ? "1-5天震荡观察" : "1-5天偏弱观察",
      weekTrend: score >= 70 ? "上涨" : score >= 50 ? "震荡" : "下跌",
      action: score >= 75 ? "关注" : score >= 60 ? "持有" : score >= 45 ? "等待" : "降低仓位",
      reasons: [
        `技术面${technicalScore}/20：今日涨跌幅 ${stock.changePercent ?? "数据源未返回"}。`,
        `资金面${capitalScore}/20：成交额 ${stock.amount ?? "数据源未返回"}。`,
        relatedNews.length ? `消息面${newsScore}/20：匹配到 ${relatedNews.length} 条相关新闻。` : `消息面${newsScore}/20：未匹配到强相关新闻。`,
      ],
      risks: [
        ...stockRisks,
        "短期涨跌幅放大时需要防止追高或情绪回落。",
        "公告、新闻和财务数据可能存在延迟，需要复核来源。",
        "若板块热度下降，个股或ETF弹性会减弱。",
      ].slice(0, 4),
    };
  });
}

function scoreByChange(value) {
  const change = Number(String(value ?? "").replace("%", "").replace("+", ""));
  if (!Number.isFinite(change)) return 8;
  if (change >= 3) return 18;
  if (change >= 1) return 15;
  if (change >= 0) return 12;
  if (change > -2) return 9;
  return 5;
}

function scoreToRating(score) {
  if (score >= 78) return "重点关注";
  if (score >= 62) return "可以观察";
  if (score >= 40) return "等待机会";
  if (score >= 25) return "暂不参与";
  return "风险较高";
}

function normalizeRiskTexts(risks = [], fallback = []) {
  const source = risks.length ? risks : fallback;
  return source.map((item) => typeof item === "string" ? item : item.message ?? item.title ?? "风险待跟踪").filter(Boolean).slice(0, 6);
}

function normalizeAiSource(aiAnalysis = {}) {
  const source = aiAnalysis?.aiStatus?.source ?? aiAnalysis?.source;
  if (source === "deepseek" || source === "DeepSeek") return "DeepSeek";
  if (source === "openai" || source === "ai-api" || source === "OpenAI") return "OpenAI";
  return "fallback";
}

function scoreQuality({ marketData, newsEvents, risks }) {
  let score = 55;
  if ((marketData.marketOverview ?? []).length >= 3) score += 15;
  if ((marketData.hotSectors ?? []).length >= 2) score += 10;
  if ((newsEvents ?? []).length >= 2) score += 10;
  if ((risks ?? []).length >= 1) score += 10;
  return {
    score: Math.min(100, score),
    dataCompleteness: score >= 80 ? "较完整" : "部分完整",
    newsCount: newsEvents?.length ?? 0,
    basis: "行情、新闻、风险、自选股、AI分析",
  };
}
