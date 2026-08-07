import { generateDailyReports } from "./aiService.js";
import { getMarketSnapshot } from "./marketService.js";
import { buildNotificationText, notifyUser } from "./notificationService.js";
import { getNewsSnapshot } from "./newsService.js";
import { analyzeRisks } from "./riskService.js";
import { saveSyncedReport, syncReports } from "./syncService.js";
import { getWatchlistSnapshot } from "./stockService.js";

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
  const report = generateDailyReports({
    marketData,
    newsEvents: newsSnapshot.stockNews,
    watchlist,
    investmentProfile: getDefaultInvestmentProfile(),
    riskAlerts: risks,
  });

  const record = {
    id: `${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    type,
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    content: report,
    sourceData: ["marketService", "stockService", "newsService", "riskService", "aiService"],
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

function getDefaultInvestmentProfile() {
  return {
    preference: "稳健成长，重视基本面和风险控制",
    industries: ["AI算力", "半导体", "新能源", "高端消费"],
    riskLevel: "中等",
  };
}
