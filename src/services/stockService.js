import { DATA_MODE } from "../config/dataSources.js";
import { stockDatabase, stockEvents, watchlist } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addLog } from "./logService.js";

const SOURCE_MOCK = "\u6a21\u62df\u6570\u636e";
const STATUS_MOCK = "\u6a21\u62df\u6570\u636e";
const STATUS_PARTIAL = "\u90e8\u5206\u771f\u5b9e";

export async function getStockDatabase() {
  return stockDatabase;
}

export async function queryStock(query) {
  const keyword = String(query ?? "").trim();
  const fallback = findMockStock(keyword) ?? stockDatabase[0];

  if (DATA_MODE !== "real") return withMockQuote(fallback);

  try {
    const detailResult = await cloudDataApi.getStockDetail(keyword || fallback.code);
    const detail = detailResult.data;
    if (!detail) throw new Error(detailResult.message || "\u672a\u627e\u5230\u80a1\u7968\u6216ETF");
    return normalizeCloudStock(detail, fallback, detailResult);
  } catch (detailError) {
    try {
      const result = await cloudDataApi.getStocks(keyword || fallback.code);
      const stock = result.data?.[0];
      if (!stock) throw new Error(result.message || detailError.message);
      return normalizeCloudStock(stock, fallback, result);
    } catch (error) {
      addLog({
        module: "stock",
        status: "failed",
        mode: "real-fallback",
        source: "stockService",
        message: "\u771f\u5b9e\u80a1\u7968\u67e5\u8be2\u5931\u8d25\uff0c\u5df2\u56de\u9000\u793a\u4f8b\u6570\u636e",
        error: error.message,
      });
      return withMockQuote(fallback);
    }
  }
}

export async function searchStocks(query) {
  const keyword = String(query ?? "").trim();
  if (!keyword) return stockDatabase.map(withMockQuote);
  if (DATA_MODE !== "real") return stockDatabase.filter((stock) => matchesMockStock(stock, keyword)).map(withMockQuote);

  try {
    const result = await cloudDataApi.getStocks(keyword);
    if (result.data?.length) return result.data.map((stock) => normalizeCloudStock(stock, findMockStock(stock.code) ?? {}, result));
    return stockDatabase.filter((stock) => matchesMockStock(stock, keyword)).map(withMockQuote);
  } catch (error) {
    addLog({
      module: "stock",
      status: "failed",
      mode: "real-fallback",
      source: "stockService",
      message: "\u8bc1\u5238\u641c\u7d22\u5931\u8d25\uff0c\u5df2\u56de\u9000\u672c\u5730\u8bc1\u5238\u5e93",
      error: error.message,
    });
    return stockDatabase.filter((stock) => matchesMockStock(stock, keyword)).map(withMockQuote);
  }
}

export async function getWatchlistSnapshot() {
  if (DATA_MODE !== "real") return watchlist;

  try {
    return await Promise.all(watchlist.map(async (stock) => {
      const quote = await queryStock(stock.code);
      return {
        ...stock,
        name: quote.name ?? stock.name,
        price: quote.price ?? stock.price,
        change: quote.changeAmount ?? stock.change,
        changePercent: quote.changePercent ?? stock.changePercent ?? stock.change,
        amount: quote.amount ?? "\u6682\u65e0",
        volume: quote.volume ?? "\u6682\u65e0",
        turnoverRate: quote.turnoverRate ?? "\u6682\u65e0",
        industry: quote.industry ?? stock.industry,
        assetType: quote.assetType ?? stock.assetType,
        dataSource: quote.dataSource,
        dataStatus: quote.dataStatus,
        updatedAt: quote.updatedAt,
        tracking: buildQuoteTracking(stock, quote),
      };
    }));
  } catch (error) {
    addLog({
      module: "stock",
      status: "failed",
      mode: "real-fallback",
      source: "stockService",
      message: "\u771f\u5b9e\u81ea\u9009\u884c\u60c5\u83b7\u53d6\u5931\u8d25\uff0c\u5df2\u56de\u9000",
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
  return stockDatabase.find((stock) => matchesMockStock(stock, keyword));
}

function matchesMockStock(stock, keyword) {
  const upper = keyword.toUpperCase();
  const aliases = (stock.aliases ?? []).map((item) => String(item).toUpperCase());
  return stock.code === keyword
    || stock.code.includes(keyword)
    || String(stock.name ?? "").includes(keyword)
    || String(stock.shortName ?? "").includes(keyword)
    || String(stock.pinyin ?? "").toUpperCase().includes(upper)
    || aliases.some((alias) => alias.includes(upper) || alias.includes(keyword));
}

function normalizeCloudStock(stock, fallback = {}, result = {}) {
  return {
    ...fallback,
    ...stock,
    code: stock.code ?? fallback.code,
    name: stock.name ?? fallback.name,
    assetType: stock.assetType ?? fallback.assetType ?? "\u80a1\u7968",
    market: stock.market ?? fallback.market ?? "\u5f85\u8865\u5145",
    industry: stock.industry ?? fallback.industry ?? "\u5f85\u8865\u5145",
    companyName: stock.companyName ?? fallback.companyName ?? stock.name ?? fallback.name,
    profile: stock.profile ?? fallback.profile ?? `${stock.name ?? fallback.name}\u57fa\u7840\u8d44\u6599\u6765\u81ea\u516c\u5f00\u884c\u60c5\u63a5\u53e3\u3002`,
    mainBusiness: stock.mainBusiness ?? fallback.mainBusiness ?? "\u5f85\u63a5\u5165\u5e74\u62a5\u548c\u516c\u544a\u6570\u636e\u3002",
    industryPosition: stock.industryPosition ?? fallback.industryPosition ?? "\u9700\u7ed3\u5408\u884c\u4e1a\u6570\u636e\u7ee7\u7eed\u89c2\u5bdf\u3002",
    volume: stock.volume ?? fallback.volume ?? "\u5f85\u8865\u5145",
    amount: stock.amount ?? fallback.amount ?? "\u5f85\u8865\u5145",
    turnoverRate: stock.turnoverRate ?? fallback.turnoverRate ?? "\u5f85\u8865\u5145",
    marketCap: stock.marketCap ?? fallback.marketCap ?? "\u5f85\u8865\u5145",
    pe: stock.pe ?? fallback.pe ?? "\u5f85\u8865\u5145",
    pb: stock.pb ?? fallback.pb ?? "\u5f85\u8865\u5145",
    valuationStatus: stock.valuationStatus ?? fallback.valuationStatus ?? "\u5f85\u89c2\u5bdf",
    financials: stock.financials ?? fallback.financials ?? {},
    valuationRange: stock.valuationRange ?? fallback.valuationRange ?? {},
    announcements: stock.announcements ?? fallback.announcements ?? [],
    researchReport: stock.researchReport ?? fallback.researchReport ?? {},
    riskTips: stock.riskTips ?? fallback.riskTips ?? ["\u884c\u60c5\u5b58\u5728\u5ef6\u8fdf\uff0c\u8bf7\u7ed3\u5408\u516c\u544a\u548c\u8d22\u62a5\u7ee7\u7eed\u89c2\u5bdf\u3002"],
    quoteSource: stock.quoteSource ?? result.source ?? "\u4e1c\u65b9\u8d22\u5bcc",
    dataSource: stock.dataSource ?? result.source ?? "\u4e1c\u65b9\u8d22\u5bcc",
    dataStatus: stock.dataStatus ?? result.status ?? STATUS_PARTIAL,
    updatedAt: stock.updatedAt ?? result.updatedAt ?? new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

function withMockQuote(stock) {
  return {
    ...stock,
    price: stock.price ?? "\u6a21\u62df",
    changePercent: stock.changePercent ?? "\u6a21\u62df",
    changeAmount: stock.changeAmount ?? "\u6a21\u62df",
    amount: stock.amount ?? "\u6a21\u62df",
    volume: stock.volume ?? "\u6a21\u62df",
    turnoverRate: stock.turnoverRate ?? "\u6a21\u62df",
    marketCap: stock.marketCap ?? "\u6a21\u62df",
    pe: stock.pe ?? "\u6a21\u62df",
    pb: stock.pb ?? "\u6a21\u62df",
    listingDate: stock.listingDate ?? "\u6a21\u62df",
    announcements: stock.announcements ?? [],
    financials: stock.financials ?? {},
    dataSource: stock.dataSource ?? SOURCE_MOCK,
    quoteSource: stock.quoteSource ?? SOURCE_MOCK,
    dataStatus: stock.dataStatus ?? STATUS_MOCK,
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

function buildQuoteTracking(stock, quote) {
  if (!quote) return stock.tracking;
  const change = Number(String(quote.changePercent).replace("%", ""));
  const direction = change >= 0 ? "\u4ef7\u683c\u4e0a\u6da8" : "\u4ef7\u683c\u4e0b\u8dcc";
  return [
    {
      date: "\u4eca\u65e5",
      event: `${direction} ${quote.changePercent}`,
      analysis: `\u6210\u4ea4\u989d ${quote.amount}\uff0cAI\u63d0\u9192\uff1a\u77ed\u671f\u5173\u6ce8\uff0c\u4f46\u907f\u514d\u8ffd\u9ad8\u3002`,
    },
    ...(stock.tracking ?? []),
  ];
}
