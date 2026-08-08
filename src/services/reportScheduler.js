import { generateDailyReports } from "./aiService.js";
import { getMarketSnapshot } from "./marketService.js";
import { buildNotificationText, notifyUser } from "./notificationService.js";
import { getNewsSnapshot } from "./newsService.js";
import { analyzeRisks } from "./riskService.js";
import { saveSyncedReport, syncReports } from "./syncService.js";
import { getWatchlistSnapshot } from "./stockService.js";
import { getInvestmentProfile } from "./investmentProfileService.js";

let lastTaskStatus = {
  marketUpdated: false,
  newsFetched: false,
  reportGenerated: false,
  lastRunAt: "尚未生成",
};

export function getTaskSchedule() {
  return [
    { id: "morning", name: "早盘任务", time: "08:00", description: "获取市场数据、关注股票、新闻并生成早盘报告。" },
    { id: "close", name: "收盘任务", time: "20:00", description: "获取收盘行情、新闻变化并生成收盘复盘。" },
  ];
}

export function getTaskStatus() {
  return lastTaskStatus;
}

export async function getSavedReports() {
  return (await syncReports()).data;
}

export async function runReportTask(type = "manual") {
  const [marketData, newsSnapshot, watchlist] = await Promise.all([
    getMarketSnapshot(),
    getNewsSnapshot(),
    getWatchlistSnapshot(),
  ]);

  const risks = analyzeRisks({ watchlist, newsEvents: newsSnapshot.stockNews, marketData });
  const rawReport = generateDailyReports({
    marketData,
    newsEvents: newsSnapshot.stockNews,
    watchlist,
    investmentProfile: getInvestmentProfile(),
    riskAlerts: risks,
  });
  const report = normalizeDailyReport(rawReport, { marketData, newsEvents: newsSnapshot.stockNews, watchlist, risks, profile: getInvestmentProfile() });

  const record = {
    id: `${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    type,
    title: type === "manual" || type === "手动生成" ? "今日AI投资研究日报" : `${type}报告`,
    generatedAt: report.generatedAt,
    score: report.morning.score,
    marketState: report.morning.marketState,
    mainView: report.morning.strategy,
    content: report,
    sourceData: ["东方财富行情", "stockService", "新闻接口/公告", "riskService", "aiService"],
  };

  await saveSyncedReport(record);
  lastTaskStatus = {
    marketUpdated: true,
    newsFetched: true,
    reportGenerated: true,
    lastRunAt: record.generatedAt,
  };

  const notificationType = type === "早盘" ? "morning" : type === "收盘" ? "close" : "risk";
  const message = buildNotificationText(notificationType);
  notifyUser(message.title, message.body);

  return record;
}

function normalizeDailyReport(report, { marketData, newsEvents, watchlist, risks, profile }) {
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const strategy = marketData.strategy ?? {};
  const sentiment = marketData.marketSentiment ?? {};
  const hotSectors = (marketData.hotSectors ?? []).map((item) => item.name);
  const watchNames = (watchlist ?? []).map((item) => item.name).filter(Boolean).slice(0, 4);
  const riskTexts = normalizeRiskTexts(risks, report.morning?.risks);
  const quality = report.morning?.quality ?? report.close?.quality ?? scoreQuality({ marketData, newsEvents, risks });

  const marketSummary = report.close?.marketSummary ?? report.close?.performance ?? report.morning?.marketSummary ?? sentiment.summary ?? "市场处于结构性观察阶段。";
  const profileFocus = buildProfileFocus(profile);
  const focus = [...new Set([...(profileFocus.length ? profileFocus : []), ...(report.morning?.focus ?? []), ...hotSectors, ...watchNames])].slice(0, 8);
  const nextFocus = report.close?.nextFocus?.length ? report.close.nextFocus : [...focus, "观察成交额变化", "检查自选股公告"].slice(0, 6);

  return {
    generatedAt,
    morning: {
      date: new Date().toLocaleDateString("zh-CN"),
      generatedAt,
      score: strategy.score ?? report.morning?.score ?? 70,
      marketState: strategy.state ?? report.morning?.marketState ?? sentiment.summary ?? "震荡观察",
      marketSummary,
      riseReason: `热点集中在${hotSectors.slice(0, 3).join("、") || "结构性方向"}，需要继续观察成交额和资金持续性。`,
      downsideRisk: riskTexts.join("；") || "成交不足、热点轮动过快、外部扰动可能压制风险偏好。",
      strategy: `结合你的关注板块（${profile.industries.join("、")}），今日重点观察${focus.join("、") || "市场主线"}。保持研究观察，不追高。`,
      focus,
      watchFocus: watchNames,
      risks: riskTexts,
      tomorrowPlan: nextFocus,
      positionAdvice: strategy.position ?? report.morning?.positionAdvice ?? "建议保持观察仓位，避免追高。",
      sources: ["东方财富行情", "新闻接口/公告", "stockService自选股", "riskService", "AI分析"],
      basis: `基于指数涨跌、成交额、涨跌家数、热点板块、新闻事件、关注股票和你的投资画像（${profile.style}/${profile.riskLevel}风险）生成。`,
      evidence: report.morning?.evidence ?? {},
      credibility: report.morning?.credibility ?? {},
      quality,
    },
    close: {
      date: new Date().toLocaleDateString("zh-CN"),
      generatedAt,
      performance: marketSummary,
      marketSummary,
      breadth: `上涨 ${sentiment.upCount ?? "未知"} 家，下跌 ${sentiment.downCount ?? "未知"} 家。`,
      hotSectors,
      hotAnalysis: `${hotSectors.slice(0, 4).join("、") || "暂无明确主线"} 是当前主要复盘方向。`,
      events: (newsEvents ?? []).slice(0, 4).map((item) => `${item.title}：${item.impact ?? item.category ?? "待判断"}`),
      summary: `今日市场总结：${marketSummary}`,
      aiReview: "当日判断需要结合后续市场和板块表现复盘，不代表未来结果。",
      nextFocus,
      positionAdvice: strategy.position ?? "控制仓位，关注风险收益比。",
      sources: ["东方财富行情", "新闻接口/公告", "stockService", "aiService"],
      basis: "基于收盘行情、新闻变化、关注股票表现和风险信号生成。",
      evidence: report.close?.evidence ?? {},
      credibility: report.close?.credibility ?? {},
      quality,
    },
    history: report.history ?? [],
  };
}

function normalizeRiskTexts(risks = [], fallback = []) {
  const source = risks.length ? risks : fallback;
  return source.map((item) => typeof item === "string" ? item : item.message ?? item.title ?? "风险待跟踪").filter(Boolean).slice(0, 6);
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

function buildProfileFocus(profile) {
  const semi = "\u534a\u5bfc\u4f53";
  const optical = "\u5149\u6a21\u5757";
  const power = "\u7535\u529b";
  const storage = "\u50a8\u80fd";
  const resource = "\u8d44\u6e90";
  const domestic = "\u56fd\u4ea7\u66ff\u4ee3";
  const map = {
    AI: ["AI\u4ea7\u4e1a\u94fe", "\u7b97\u529b", "\u82af\u7247", optical],
    [semi]: ["\u534a\u5bfc\u4f53\u8bbe\u5907", domestic, "\u5148\u8fdb\u5c01\u88c5"],
    [optical]: ["\u9ad8\u901f\u5149\u6a21\u5757", "\u6570\u636e\u4e2d\u5fc3", "\u6d77\u5916\u4e91\u5382\u5546\u9700\u6c42"],
    [power]: ["\u7535\u7f51", "\u7535\u529b\u8bbe\u5907", "\u6570\u636e\u4e2d\u5fc3\u7528\u7535"],
    [storage]: ["\u50a8\u80fd\u8ba2\u5355", "\u7535\u529b\u5e02\u573a\u5316", "\u6570\u636e\u4e2d\u5fc3\u5907\u7535"],
    [resource]: ["\u6709\u8272\u91d1\u5c5e", "\u80fd\u6e90\u4ef7\u683c", "\u5468\u671f\u4fee\u590d"],
    [domestic]: ["\u4fe1\u521b", "\u534a\u5bfc\u4f53\u8bbe\u5907", "\u57fa\u7840\u8f6f\u4ef6"],
  };
  return [...new Set((profile.industries ?? []).flatMap((item) => map[item] ?? [item]))];
}
