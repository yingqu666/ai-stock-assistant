import { cloudDataApi } from "./cloudService.js";
import { getAiStatus } from "./aiService.js";
import { getCachedMarketData, getCachedNewsData, getRefreshStatus } from "./refreshService.js";
import { getNewsSnapshot } from "./newsService.js";

export async function getSystemStatusData() {
  const [market, news, ai, db, scheduler, researchStatus] = await Promise.all([
    getCachedMarketData().catch((error) => ({ error: error.message })),
    getCachedNewsData().catch(() => getNewsSnapshot()).catch((error) => ({ error: error.message })),
    getAiStatus().catch((error) => ({ mode: "fallback", provider: "local", connected: false, keyStatus: "未配置", aiMode: "fallback", label: "Fallback模式", message: error.message })),
    cloudDataApi.getDbStatus().catch((error) => ({ mode: "memory", connected: false, tables: [], error: error.message })),
    cloudDataApi.getSchedulerStatus().catch((error) => ({ data: { enabled: false, tasks: [], lastError: error.message, mode: "manual" } })),
    cloudDataApi.getResearchSourceStatus().catch((error) => ({ data: { sources: {}, error: error.message } })),
  ]);

  const refresh = getRefreshStatus();
  const sources = researchStatus.data?.sources ?? {};
  const schedulerData = scheduler.data ?? scheduler;
  const aiMode = ai.aiMode ?? (ai.mode === "api" && ai.hasApiKey ? "真实AI" : "fallback");
  const keyStatus = ai.keyStatus ?? (ai.hasApiKey ? "已配置" : "未配置");

  return {
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    refresh,
    dataSources: [
      {
        name: "东方财富",
        status: normalizeProviderStatus(sources.eastmoney?.status),
        source: "行情 / 公告 / 财务",
        updatedAt: sources.eastmoney?.updatedAt ?? refresh.updatedAt,
        detail: sources.eastmoney?.message ?? "股票研究优先使用东方财富行情和公告",
      },
      {
        name: "新浪财经",
        status: normalizeProviderStatus(sources.sina?.status),
        source: "备用行情",
        updatedAt: sources.sina?.updatedAt ?? refresh.updatedAt,
        detail: sources.sina?.message ?? "东方财富行情失败时尝试新浪行情",
      },
      {
        name: "腾讯财经",
        status: normalizeProviderStatus(sources.tencent?.status),
        source: "备用行情",
        updatedAt: sources.tencent?.updatedAt ?? refresh.updatedAt,
        detail: sources.tencent?.message ?? "新浪行情失败时尝试腾讯行情",
      },
      {
        name: "完整证券池",
        status: normalizeProviderStatus(sources.universe?.status),
        source: "东方财富证券列表",
        updatedAt: sources.universe?.updatedAt ?? refresh.updatedAt,
        detail: sources.universe?.message ?? "每日自动缓存A股和ETF基础列表",
      },
      {
        name: "行情接口",
        status: market.error ? "异常/备用模式" : (market.dataStatus ?? sourceStatus(market.source)),
        source: market.source ?? "marketService",
        updatedAt: market.updatedAt ?? refresh.updatedAt,
        detail: market.error ?? "指数、成交额、涨跌家数、热点板块",
      },
      {
        name: "股票接口",
        status: "真实优先",
        source: "后端 researchDataService / stockService",
        updatedAt: refresh.updatedAt,
        detail: "股票和ETF查询统一经过后端，失败时明确标记数据状态",
      },
      {
        name: "新闻接口",
        status: news.error ? "异常/备用模式" : (news.dataStatus ?? normalizeProviderStatus(sources.news?.status)),
        source: news.source ?? "东方财富资讯 / 财联社预留 / 巨潮公告",
        updatedAt: news.updatedAt ?? sources.news?.updatedAt ?? refresh.updatedAt,
        detail: news.error ?? "股票研究读取东方财富快讯和公告；财联社、巨潮接口位置已预留",
      },
      {
        name: "公告接口",
        status: news.error ? "异常/备用模式" : "真实优先",
        source: "东方财富公告 / 巨潮资讯预留",
        updatedAt: news.updatedAt ?? refresh.updatedAt,
        detail: "股票详情按标的拉取最新公告并进行影响分析",
      },
    ],
    ai: {
      status: ai.label ?? (aiMode === "真实AI" ? "真实AI模型" : "Fallback模式"),
      mode: ai.mode ?? "fallback",
      aiMode,
      provider: ai.provider ?? "local",
      keyStatus,
      hasApiKey: Boolean(ai.hasApiKey),
      model: ai.model ?? "",
      endpointConfigured: Boolean(ai.endpointConfigured),
      connected: Boolean(ai.connected ?? (ai.mode === "api" && ai.hasApiKey)),
      message: ai.message ?? ai.lastFailureReason ?? "AI fallback可用",
      updatedAt: ai.lastCallAt ? new Date(ai.lastCallAt).toLocaleString("zh-CN", { hour12: false }) : "未调用",
      lastFailureReason: ai.lastFailureReason ?? "",
    },
    database: {
      mode: db.mode ?? "memory",
      connected: Boolean(db.connected),
      tables: db.tables ?? [],
      error: db.error ?? "",
    },
    scheduler: {
      enabled: Boolean(schedulerData.enabled),
      mode: schedulerData.mode ?? "manual",
      timezone: schedulerData.timezone ?? "Asia/Shanghai",
      tasks: normalizeSchedulerTasks(schedulerData.tasks ?? []),
      lastMorningAt: schedulerData.lastMorningAt,
      lastCloseAt: schedulerData.lastCloseAt,
      lastReviewAt: schedulerData.lastReviewAt,
      lastError: schedulerData.lastError ?? "",
    },
  };
}

function normalizeProviderStatus(status = "unknown") {
  if (status === "ok" || status === "real") return "正常";
  if (status === "partial" || status === "stale") return "部分真实";
  if (status === "failed") return "异常";
  if (status === "fallback") return "备用模式";
  if (status === "empty") return "接口返回为空";
  return "待检测";
}

function sourceStatus(source = "") {
  if (String(source).includes("模拟")) return "备用模式";
  if (source) return "真实/部分真实";
  return "待刷新";
}

function normalizeSchedulerTasks(tasks) {
  return tasks.map((task) => ({
    ...task,
    name: task.name ?? "AI日报",
    status: task.status ?? "手动模式",
  }));
}
