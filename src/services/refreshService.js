import { getMarketSnapshot } from "./marketService.js";
import { addLog } from "./logService.js";
import { getNewsSnapshot } from "./newsService.js";
import { getWatchlistSnapshot } from "./stockService.js";

const refreshIntervalMs = 30 * 60 * 1000;
const cache = {
  market: null,
  news: null,
  watchlist: null,
};

let timerId = null;
let lastRefreshStatus = {
  updatedAt: "尚未刷新",
  marketOk: false,
  newsOk: false,
  watchlistOk: false,
  message: "等待刷新",
};

export async function refreshAllData() {
  const previous = { ...cache };
  const status = {
    updatedAt: formatNow(),
    marketOk: false,
    newsOk: false,
    watchlistOk: false,
    message: "数据已更新",
  };

  try {
    cache.market = await getMarketSnapshot();
    status.marketOk = true;
    addLog({ module: "行情", source: cache.market.source ?? "marketService", status: "成功", mode: cache.market.source?.includes("模拟") ? "mock回退" : "real" });
  } catch {
    cache.market = previous.market;
    status.message = "部分数据刷新失败，已保留旧数据";
    addLog({ module: "行情", source: "marketService", status: "失败", mode: "保留旧数据" });
  }

  try {
    cache.news = await getNewsSnapshot();
    status.newsOk = true;
    addLog({ module: "新闻", source: cache.news.source ?? "newsService", status: "成功", mode: cache.news.source?.includes("模拟") ? "mock回退" : "real" });
  } catch {
    cache.news = previous.news;
    status.message = "部分数据刷新失败，已保留旧数据";
    addLog({ module: "新闻", source: "newsService", status: "失败", mode: "保留旧数据" });
  }

  try {
    cache.watchlist = await getWatchlistSnapshot();
    status.watchlistOk = true;
    addLog({ module: "自选股", source: cache.watchlist?.[0]?.quoteSource ?? "stockService", status: "成功", mode: cache.watchlist?.[0]?.quoteSource === "东方财富" ? "real" : "mock回退" });
  } catch {
    cache.watchlist = previous.watchlist;
    status.message = "部分数据刷新失败，已保留旧数据";
    addLog({ module: "自选股", source: "stockService", status: "失败", mode: "保留旧数据" });
  }

  lastRefreshStatus = status;
  return status;
}

export async function getCachedMarketData() {
  if (!cache.market) await refreshAllData();
  return cache.market;
}

export async function getCachedNewsData() {
  if (!cache.news) await refreshAllData();
  return cache.news;
}

export async function getCachedWatchlistData() {
  if (!cache.watchlist) await refreshAllData();
  return cache.watchlist;
}

export function getRefreshStatus() {
  return lastRefreshStatus;
}

export function initAutoRefresh(onRefresh) {
  refreshAllData().then(onRefresh);
  if (timerId) window.clearInterval(timerId);
  timerId = window.setInterval(async () => {
    const status = await refreshAllData();
    onRefresh?.(status);
  }, refreshIntervalMs);
}

function formatNow() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
