import { DATA_MODE } from "../config/dataSources.js";
import { stockDatabase, stockEvents, watchlist } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addLog } from "./logService.js";

export async function getStockDatabase() {
  return stockDatabase;
}

export async function queryStock(query) {
  const keyword = String(query ?? "").trim();
  const fallback = findMockStock(keyword) ?? stockDatabase[0];

  if (DATA_MODE !== "real") return withMockQuote(fallback);

  try {
    const result = await cloudDataApi.getStocks(keyword || fallback.code);
    const stock = result.data?.[0];
    if (!stock) throw new Error("未找到股票");
    return normalizeCloudStock(stock, fallback);
  } catch (error) {
    addLog({
      module: "stock",
      status: "failed",
      mode: "real-fallback",
      source: "stockService",
      message: "真实股票查询失败，已回退示例数据",
      error: error.message,
    });
    return withMockQuote(fallback);
  }
}

export async function searchStocks(query) {
  const keyword = String(query ?? "").trim();
  if (!keyword) return stockDatabase.map(withMockQuote);
  try {
    const result = await cloudDataApi.getStocks(keyword);
    return result.data ?? [];
  } catch {
    return stockDatabase.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword));
  }
}

export async function getWatchlistSnapshot() {
  if (DATA_MODE !== "real") return watchlist;

  try {
    return await Promise.all(watchlist.map(async (stock) => {
      const quote = await queryStock(stock.code);
      return {
        ...stock,
        price: quote.price ?? stock.price,
        change: quote.changeAmount ?? stock.change,
        changePercent: quote.changePercent ?? stock.change,
        amount: quote.amount ?? "暂无",
        tracking: buildQuoteTracking(stock, quote),
      };
    }));
  } catch (error) {
    addLog({
      module: "stock",
      status: "failed",
      mode: "real-fallback",
      source: "stockService",
      message: "真实自选股行情获取失败，已回退",
      error: error.message,
    });
    return watchlist;
  }
}

export function getStockEvents(code) {
  return stockEvents.filter((event) => event.code === code);
}

export function findMockStock(query) {
  const keyword = String(query ?? "").trim();
  return stockDatabase.find((stock) => stock.code === keyword || stock.name.includes(keyword));
}

function normalizeCloudStock(stock, fallback) {
  return {
    ...fallback,
    ...stock,
    code: stock.code ?? fallback.code,
    name: stock.name ?? fallback.name,
    industry: stock.industry ?? fallback.industry ?? "待补充",
    profile: stock.profile ?? fallback.profile ?? `${stock.name ?? fallback.name}，基础资料来自公开行情接口。`,
    riskTips: stock.riskTips ?? fallback.riskTips ?? ["行情存在延迟，请结合公告和财报继续观察。"],
    quoteSource: stock.quoteSource ?? "东方财富",
    updatedAt: stock.updatedAt ?? new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

function withMockQuote(stock) {
  return {
    ...stock,
    price: stock.basics?.find((item) => item.label === "当前价格")?.value ?? stock.price ?? "模拟",
    changePercent: stock.changePercent ?? "模拟",
    changeAmount: stock.changeAmount ?? "模拟",
    amount: stock.amount ?? "模拟",
    marketCap: stock.basics?.find((item) => item.label === "总市值")?.value ?? stock.marketCap ?? "模拟",
    quoteSource: "模拟数据",
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

function buildQuoteTracking(stock, quote) {
  if (!quote) return stock.tracking;
  const change = Number(String(quote.changePercent).replace("%", ""));
  const direction = change >= 0 ? "价格上涨" : "价格下跌";
  return [
    {
      date: "今日",
      event: `${direction} ${quote.changePercent}`,
      analysis: `成交额 ${quote.amount}，AI提醒：短期关注，但避免追高。`,
    },
    ...(stock.tracking ?? []),
  ];
}
