import { buildAiResearchInput, generateAiAnalysis, generateDailyReports } from "./aiService.js";
import { getMarketSnapshot } from "./marketService.js";
import { buildNotificationText, notifyUser } from "./notificationService.js";
import { getNewsSnapshot } from "./newsService.js";
import { analyzeRisks } from "./riskService.js";
import { saveSyncedReport, syncReports } from "./syncService.js";
import { getSyncedWatchlist } from "./watchlistSyncService.js";
import { getInvestmentProfile } from "./investmentProfileService.js";

let lastTaskStatus = {
  marketUpdated: false,
  newsFetched: false,
  reportGenerated: false,
  lastRunAt: "尚未生成",
};

export function getTaskSchedule() {
  return [
    { id: "manual", name: "手动生成AI日报", time: "用户点击", description: "获取行情、新闻、自选股、持仓和投资档案后生成今日研究报告。" },
  ];
}

export function getTaskStatus() {
  return lastTaskStatus;
}

export async function getSavedReports() {
  return (await syncReports()).data;
}

export async function runReportTask(type = "manual") {
  const [marketData, newsSnapshot, syncedWatchlist, savedReports] = await Promise.all([
    getMarketSnapshot(),
    getNewsSnapshot(),
    getSyncedWatchlist(),
    syncReports(),
  ]);
  const watchlist = syncedWatchlist.items ?? [];
  const profile = getInvestmentProfile();
  const risks = analyzeRisks({ watchlist, newsEvents: newsSnapshot.stockNews, marketData });

  const aiInput = buildAiResearchInput({
    marketData,
    stockQuote: null,
    newsEvents: newsSnapshot.stockNews,
    riskData: risks,
    investmentProfile: profile,
    portfolio: watchlist,
    historicalReports: savedReports.data ?? [],
  });
  const aiAnalysis = await generateAiAnalysis(aiInput);
  const rawReport = generateDailyReports({
    marketData,
    newsEvents: newsSnapshot.stockNews,
    watchlist,
    investmentProfile: profile,
    riskAlerts: risks,
  });
  const report = normalizeDailyReport(rawReport, { marketData, newsEvents: newsSnapshot.stockNews, watchlist, risks, profile, aiAnalysis, newsSnapshot });

  const record = {
    id: `${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    type,
    title: "今日AI投资研究日报",
    generatedAt: report.generatedAt,
    score: report.morning.score,
    marketState: report.morning.marketState,
    mainView: report.morning.strategy,
    content: report,
    sourceData: ["东方财富行情", "东方财富公告/快讯", "stockService", "riskService", aiAnalysis.source ?? "aiService"],
  };

  await saveSyncedReport(record);
  lastTaskStatus = {
    marketUpdated: true,
    newsFetched: true,
    reportGenerated: true,
    lastRunAt: record.generatedAt,
  };

  const message = buildNotificationText("manual-report");
  notifyUser(message.title, message.body);
  return record;
}

function normalizeDailyReport(report, { marketData, newsEvents, watchlist, risks, profile, aiAnalysis, newsSnapshot }) {
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

  return {
    generatedAt,
    morning: {
      date: new Date().toLocaleDateString("zh-CN"),
      investmentDecision,
      generatedAt,
      score: strategy.score ?? investmentDecision.score ?? report.morning?.score ?? 70,
      marketState: strategy.state ?? report.morning?.marketState ?? sentiment.summary ?? "震荡观察",
      marketSummary,
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
      risks: riskTexts,
      tomorrowPlan: nextFocus,
      positionAdvice: strategy.position ?? investmentDecision.positionAdvice ?? "保持观察仓位，避免追高。",
      sources: ["东方财富行情", newsSnapshot.source ?? "东方财富公告/快讯", "stockService自选股", "riskService", aiAnalysis?.source ?? "AI分析"],
      basis: `基于指数、成交额、涨跌家数、热点行业、新闻事件、自选股和投资档案生成。行情更新时间：${marketData.updatedAt ?? generatedAt}；新闻更新时间：${newsSnapshot.updatedAt ?? generatedAt}。`,
      evidence,
      credibility: aiAnalysis?.credibility ?? report.morning?.credibility ?? {},
      quality,
      aiStatus: ["真实AI模型", "deepseek"].includes(aiAnalysis?.source) ? "真实AI" : "fallback",
    },
    close: {
      date: new Date().toLocaleDateString("zh-CN"),
      investmentDecision,
      generatedAt,
      performance: marketSummary,
      marketSummary,
      breadth: `上涨 ${sentiment.upCount ?? "数据源未返回"} 家，下跌 ${sentiment.downCount ?? "数据源未返回"} 家。`,
      hotSectors: hotNames,
      hotDirections,
      hotAnalysis: hotDirections.map((item) => `${item.name}：${item.reason}；催化：${item.catalyst}；持续性：${item.sustainability}；风险：${item.risk}`).join("\n"),
      events: (newsEvents ?? []).slice(0, 5).map((item) => `${item.title}：${item.impact ?? item.category ?? "中性"}，来源 ${item.source ?? "新闻接口"}`),
      summary: `今日市场总结：${marketSummary}`,
      aiReview: "当日判断需要结合后续市场和板块表现复盘，不代表未来结果。",
      nextFocus,
      positionAdvice: strategy.position ?? investmentDecision.positionAdvice ?? "控制仓位，关注风险收益比。",
      sources: ["东方财富行情", newsSnapshot.source ?? "东方财富公告/快讯", "stockService", aiAnalysis?.source ?? "aiService"],
      basis: `基于收盘行情、新闻变化、关注股票表现和风险信号生成。行情更新时间：${marketData.updatedAt ?? generatedAt}；新闻更新时间：${newsSnapshot.updatedAt ?? generatedAt}。`,
      evidence,
      credibility: aiAnalysis?.credibility ?? report.close?.credibility ?? {},
      quality,
      aiStatus: ["真实AI模型", "deepseek"].includes(aiAnalysis?.source) ? "真实AI" : "fallback",
    },
    history: report.history ?? [],
  };
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
      aiOpinion: stock.aiOpinion ?? `${stock.name}当前评分${score}/100，重点跟踪成交额、涨跌幅、新闻公告和行业热度。`,
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
  if (score >= 85) return "强烈关注";
  if (score >= 70) return "积极关注";
  if (score >= 55) return "中性观察";
  if (score >= 40) return "等待机会";
  return "风险较高";
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
