import { cloudDataApi } from "./cloudService.js";
import { getAiStatus } from "./aiService.js";
import { getCachedMarketData, getCachedNewsData, getRefreshStatus } from "./refreshService.js";
import { getNewsSnapshot } from "./newsService.js";

export async function getSystemStatusData() {
  const [market, news, ai, db, scheduler] = await Promise.all([
    getCachedMarketData().catch((error) => ({ error: error.message })),
    getCachedNewsData().catch(() => getNewsSnapshot()).catch((error) => ({ error: error.message })),
    getAiStatus().catch((error) => ({ mode: "fallback", label: "Fallback模式", message: error.message })),
    cloudDataApi.getDbStatus().catch((error) => ({ mode: "memory", connected: false, tables: [], error: error.message })),
    cloudDataApi.getSchedulerStatus().catch((error) => ({ data: { enabled: false, tasks: [], lastError: error.message } })),
  ]);
  const refresh = getRefreshStatus();
  const schedulerData = scheduler.data ?? scheduler;

  return {
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    refresh,
    dataSources: [
      {
        name: "行情接口",
        status: market.error ? "异常/fallback" : sourceStatus(market.source),
        source: market.source ?? "marketService",
        updatedAt: market.updatedAt ?? refresh.updatedAt,
        detail: market.error ?? "指数、成交额、涨跌家数、热点板块",
      },
      {
        name: "新闻接口",
        status: news.error ? "异常/fallback" : (news.dataStatus ?? "部分真实"),
        source: news.source ?? "newsService",
        updatedAt: news.updatedAt ?? refresh.updatedAt,
        detail: news.error ?? "东方财富资讯/公告，财联社和巨潮预留",
      },
      {
        name: "公告接口",
        status: news.error ? "异常/fallback" : (String(news.source ?? "").includes("公告") ? "部分真实" : "待验证"),
        source: "东方财富公告 / stockService",
        updatedAt: news.updatedAt ?? refresh.updatedAt,
        detail: "股票详情页按标的拉取最新公告并做影响分析",
      },
    ],
    ai: {
      status: ai.label ?? "Fallback模式",
      mode: ai.mode ?? "fallback",
      provider: ai.provider ?? "local",
      connected: Boolean(ai.connected),
      message: ai.message ?? ai.lastFailureReason ?? "AI fallback可用",
      updatedAt: ai.lastCallAt ? new Date(ai.lastCallAt).toLocaleString("zh-CN", { hour12: false }) : "暂无调用",
    },
    database: {
      mode: db.mode ?? "memory",
      connected: Boolean(db.connected),
      tables: db.tables ?? [],
      error: db.error ?? "",
    },
    scheduler: {
      enabled: schedulerData.enabled,
      timezone: schedulerData.timezone ?? "Asia/Shanghai",
      tasks: normalizeSchedulerTasks(schedulerData.tasks ?? []),
      lastMorningAt: schedulerData.lastMorningAt,
      lastCloseAt: schedulerData.lastCloseAt,
      lastReviewAt: schedulerData.lastReviewAt,
      lastError: schedulerData.lastError ?? "",
    },
  };
}

function sourceStatus(source = "") {
  if (String(source).includes("模拟")) return "fallback";
  if (source) return "真实/部分真实";
  return "待刷新";
}

function normalizeSchedulerTasks(tasks) {
  const names = {
    "08:00": "早盘报告",
    "20:00": "收盘复盘",
    "21:00": "AI判断复盘",
  };
  return tasks.map((task) => ({
    ...task,
    name: names[task.time] ?? task.name,
    status: String(task.status ?? "").includes("宸") ? "已运行" : String(task.status ?? "").includes("绛") ? "等待" : task.status,
  }));
}
