import { DATA_MODE } from "../config/dataSources.js";
import { stockDatabase, stockEvents, watchlist } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addLog } from "./logService.js";

const SOURCE_LOCAL = "本地备用数据";
const STATUS_LOCAL = "数据不足";
const STATUS_PARTIAL = "部分数据";
const DATA_MISSING = "数据源未返回";

export async function getStockDatabase() {
  return stockDatabase;
}

export async function queryStock(query) {
  const keyword = String(query ?? "").trim();
  const fallback = findMockStock(keyword) ?? {};
  const codeOrQuery = keyword || fallback.code;
  const errors = [];

  if (DATA_MODE !== "real") return withLocalQuote(fallback);

  try {
    const detailResult = await cloudDataApi.getStockDetail(codeOrQuery);
    const detail = detailResult.data;
    if (!detail) throw new Error(detailResult.message || "\u672a\u627e\u5230\u80a1\u7968\u6216ETF");
    return normalizeCloudStock(detail, fallback, detailResult);
  } catch (detailError) {
    errors.push("\u8be6\u60c5\u63a5\u53e3\u5931\u8d25\uff1a" + detailError.message);
    addLog({
      module: "stock",
      status: "failed",
      mode: "detail-fallback",
      source: "stockService",
      message: "\u80a1\u7968\u8be6\u60c5\u63a5\u53e3\u672a\u8fd4\u56de\uff0c\u7ee7\u7eed\u5c1d\u8bd5\u65e7\u80a1\u7968\u641c\u7d22\u63a5\u53e3",
      error: detailError.message,
    });
  }

  try {
    const result = await cloudDataApi.getStocks(codeOrQuery);
    const stock = result.data?.[0];
    if (!stock) throw new Error(result.message || "\u672a\u627e\u5230\u80a1\u7968\u6216ETF");
    return normalizeCloudStock(stock, fallback, result);
  } catch (error) {
    errors.push("\u641c\u7d22\u63a5\u53e3\u5931\u8d25\uff1a" + error.message);
    addLog({
      module: "stock",
      status: "failed",
      mode: "local-backup",
      source: "stockService",
      message: "\u771f\u5b9e\u80a1\u7968\u67e5\u8be2\u5931\u8d25\uff0c\u663e\u793a\u6570\u636e\u4e0d\u53ef\u7528",
      error: error.message,
    });
    return withUnavailableQuote(fallback, errors.join("\uff1b"));
  }
}

export async function searchStocks(query) {
  const keyword = String(query ?? "").trim();
  if (DATA_MODE !== "real") return localSearch(keyword);

  try {
    const result = await cloudDataApi.getStocks(keyword);
    if (result.data?.length) return result.data.map((stock) => normalizeCloudStock(stock, findMockStock(stock.code) ?? {}, result));
    return [];
  } catch (error) {
    addLog({
      module: "stock",
      status: "failed",
      mode: "local-backup",
      source: "stockService",
      message: "证券搜索失败，显示本地备用证券库",
      error: error.message,
    });
    return localSearch(keyword);
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
        price: quote.price ?? stock.price ?? DATA_MISSING,
        change: quote.changeAmount ?? stock.change ?? DATA_MISSING,
        changePercent: quote.changePercent ?? stock.changePercent ?? stock.change ?? DATA_MISSING,
        amount: quote.amount ?? DATA_MISSING,
        volume: quote.volume ?? DATA_MISSING,
        turnoverRate: quote.turnoverRate ?? DATA_MISSING,
        industry: quote.industry ?? stock.industry ?? DATA_MISSING,
        assetType: quote.assetType ?? stock.assetType ?? "股票",
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
      mode: "local-backup",
      source: "stockService",
      message: "自选股真实行情获取失败，保留现有本地列表",
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
  return stockDatabase.find((stock) => matchesLocalStock(stock, keyword));
}

function normalizeResearchStock(research, fallback = {}, result = {}) {
  const security = research.security ?? {};
  const quote = research.quote ?? {};
  const company = research.company ?? {};
  const etf = research.etf ?? {};
  const aiReport = research.aiReport ?? {};
  const isEtf = security.assetType === "ETF";
  const dataStatus = normalizeDataStatus(research.dataStatus?.overall);
  return {
    ...fallback,
    code: security.code ?? quote.code ?? fallback.code,
    name: security.name ?? quote.name ?? fallback.name,
    assetType: security.assetType ?? fallback.assetType ?? "股票",
    market: security.market ?? fallback.market ?? DATA_MISSING,
    industry: security.industry ?? fallback.industry ?? DATA_MISSING,
    companyName: company.name ?? etf.name ?? security.name ?? fallback.companyName,
    profile: company.profile ?? (isEtf ? `${etf.name ?? security.name}为ETF品种，重点观察跟踪指数、规模、流动性和成分方向。` : `公司简介由公告和年报补充；行情更新时间：${research.sourceTimes?.quoteUpdatedAt ?? research.updatedAt}`),
    mainBusiness: company.mainBusiness ?? (isEtf ? `跟踪指数：${etf.trackingIndex ?? DATA_MISSING}` : `主营业务由公告和年报补充；行情更新时间：${research.sourceTimes?.quoteUpdatedAt ?? research.updatedAt}`),
    industryPosition: company.industryPosition ?? (isEtf ? "ETF重点看跟踪指数、基金规模和成交活跃度。" : `行业地位由行业数据补充；行情更新时间：${research.sourceTimes?.quoteUpdatedAt ?? research.updatedAt}`),
    listingDate: company.listingDate ?? etf.inceptionDate ?? DATA_MISSING,
    price: quote.price ?? DATA_MISSING,
    changePercent: quote.changePercent ?? DATA_MISSING,
    changeAmount: quote.changeAmount ?? DATA_MISSING,
    highPrice: quote.highPrice ?? DATA_MISSING,
    lowPrice: quote.lowPrice ?? DATA_MISSING,
    previousClose: quote.previousClose ?? DATA_MISSING,
    limitUpPrice: quote.limitUpPrice ?? DATA_MISSING,
    limitDownPrice: quote.limitDownPrice ?? DATA_MISSING,
    volume: quote.volume ?? DATA_MISSING,
    amount: quote.amount ?? DATA_MISSING,
    volumeChange: quote.volumeChange ?? DATA_MISSING,
    amountChange: quote.amountChange ?? DATA_MISSING,
    turnoverRate: quote.turnoverRate ?? DATA_MISSING,
    marketCap: quote.marketCap ?? etf.fundScale ?? DATA_MISSING,
    fundScale: etf.fundScale,
    trackingIndex: etf.trackingIndex,
    inceptionDate: etf.inceptionDate,
    fundManager: etf.fundManager,
    components: etf.components ?? [],
    capitalFlow: etf.capitalFlow ?? (quote.amount ? `成交额 ${quote.amount}` : `资金方向由成交额辅助观察；行情更新时间：${research.sourceTimes?.quoteUpdatedAt ?? research.updatedAt}`),
    pe: quote.pe ?? (isEtf ? "ETF不适用PE" : DATA_MISSING),
    pb: quote.pb ?? (isEtf ? "ETF不适用PB" : DATA_MISSING),
    valuationStatus: quote.status === "real" ? "按实时行情观察" : `数据状态：${research.dataStatus?.message ?? DATA_MISSING}`,
    financials: research.financials ?? {},
    announcements: research.announcements ?? [],
    stockNews: research.news ?? [],
    researchReport: {
      ...(fallback.researchReport ?? {}),
      aiScore: aiReport.investmentDecision?.score,
      summary: aiReport.conclusion ?? aiReport.summary,
      capitalFlow: quote.status === "real" ? `成交额 ${quote.amount}，成交量 ${quote.volume}` : `行情接口状态：${quote.message ?? DATA_MISSING}`,
      newsImpact: (research.news ?? []).slice(0, 2).map((item) => `${item.title}；${item.impact}`).join("；") || `新闻更新时间：${research.sourceTimes?.newsUpdatedAt ?? research.updatedAt}`,
    },
    riskTips: [...(aiReport.investmentDecision?.risks ?? []), ...((research.dataStatus?.message && research.dataStatus.message !== "真实行情可用") ? [research.dataStatus.message] : [])],
    aiReport,
    dataSource: result.source ?? research.dataStatus?.sources?.join(" / ") ?? security.dataSource,
    quoteSource: quote.source ?? security.dataSource,
    dataStatus,
    dataMessage: research.dataStatus?.message ?? quote.message ?? "",
    sourceTimes: research.sourceTimes ?? {},
    updatedAt: research.updatedAt ?? result.updatedAt ?? nowText(),
  };
}

function normalizeCloudStock(stock, fallback = {}, result = {}) {
  const reference = pickLocalReferenceMetadata(fallback);
  return {
    ...reference,
    ...stock,
    code: stock.code ?? reference.code,
    name: stock.name ?? reference.name,
    assetType: stock.assetType ?? reference.assetType ?? "股票",
    market: stock.market ?? reference.market ?? DATA_MISSING,
    industry: stock.industry ?? reference.industry ?? DATA_MISSING,
    companyName: stock.companyName ?? reference.companyName ?? stock.name ?? reference.name,
    profile: stock.profile ?? reference.profile ?? `${stock.name ?? reference.name}基础资料来自公开行情接口。`,
    mainBusiness: stock.mainBusiness ?? reference.mainBusiness ?? "主营业务由公告和年报补充。",
    industryPosition: stock.industryPosition ?? reference.industryPosition ?? "行业地位需要结合行业数据继续观察。",
    volume: stock.volume ?? DATA_MISSING,
    amount: stock.amount ?? DATA_MISSING,
    highPrice: stock.highPrice ?? DATA_MISSING,
    lowPrice: stock.lowPrice ?? DATA_MISSING,
    previousClose: stock.previousClose ?? DATA_MISSING,
    limitUpPrice: stock.limitUpPrice ?? DATA_MISSING,
    limitDownPrice: stock.limitDownPrice ?? DATA_MISSING,
    volumeChange: stock.volumeChange ?? DATA_MISSING,
    amountChange: stock.amountChange ?? DATA_MISSING,
    turnoverRate: stock.turnoverRate ?? DATA_MISSING,
    marketCap: stock.marketCap ?? DATA_MISSING,
    pe: stock.pe ?? (stock.assetType === "ETF" ? "ETF不适用PE" : DATA_MISSING),
    pb: stock.pb ?? (stock.assetType === "ETF" ? "ETF不适用PB" : DATA_MISSING),
    valuationStatus: stock.valuationStatus ?? "继续观察",
    financials: stock.financials ?? {},
    valuationRange: stock.valuationRange ?? {},
    announcements: stock.announcements ?? [],
    researchReport: stock.researchReport ?? {},
    riskTips: stock.riskTips ?? ["行情可能存在延迟，请结合公告和财报继续观察。"],
    quoteSource: stock.quoteSource ?? result.source ?? "东方财富",
    dataSource: stock.dataSource ?? result.source ?? "东方财富",
    dataStatus: normalizeDataStatus(stock.dataStatus ?? result.status),
    updatedAt: stock.updatedAt ?? result.updatedAt ?? nowText(),
  };
}

function pickLocalReferenceMetadata(stock = {}) {
  const {
    code,
    name,
    assetType,
    market,
    industry,
    companyName,
    profile,
    mainBusiness,
    industryPosition,
  } = stock;
  return { code, name, assetType, market, industry, companyName, profile, mainBusiness, industryPosition };
}

function withLocalQuote(stock = {}, message = "") {
  return {
    ...stock,
    price: stock.price ?? DATA_MISSING,
    changePercent: stock.changePercent ?? DATA_MISSING,
    changeAmount: stock.changeAmount ?? DATA_MISSING,
    amount: stock.amount ?? DATA_MISSING,
    volume: stock.volume ?? DATA_MISSING,
    highPrice: stock.highPrice ?? DATA_MISSING,
    lowPrice: stock.lowPrice ?? DATA_MISSING,
    previousClose: stock.previousClose ?? DATA_MISSING,
    limitUpPrice: stock.limitUpPrice ?? DATA_MISSING,
    limitDownPrice: stock.limitDownPrice ?? DATA_MISSING,
    volumeChange: stock.volumeChange ?? DATA_MISSING,
    amountChange: stock.amountChange ?? DATA_MISSING,
    turnoverRate: stock.turnoverRate ?? DATA_MISSING,
    marketCap: stock.marketCap ?? DATA_MISSING,
    pe: stock.pe ?? DATA_MISSING,
    pb: stock.pb ?? DATA_MISSING,
    listingDate: stock.listingDate ?? DATA_MISSING,
    announcements: stock.announcements ?? [],
    financials: stock.financials ?? {},
    dataSource: stock.dataSource ?? SOURCE_LOCAL,
    quoteSource: stock.quoteSource ?? SOURCE_LOCAL,
    dataStatus: stock.dataStatus ?? STATUS_LOCAL,
    dataMessage: message || stock.dataMessage || "真实接口暂未返回，已使用旧股票接口/本地备用数据。",
    updatedAt: nowText(),
  };
}

function withUnavailableQuote(stock = {}, message = "") {
  return {
    ...stock,
    code: stock.code ?? "",
    name: stock.name ?? stock.code ?? "",
    assetType: stock.assetType ?? "股票",
    price: DATA_MISSING,
    changePercent: DATA_MISSING,
    changeAmount: DATA_MISSING,
    amount: DATA_MISSING,
    volume: DATA_MISSING,
    highPrice: DATA_MISSING,
    lowPrice: DATA_MISSING,
    previousClose: DATA_MISSING,
    limitUpPrice: DATA_MISSING,
    limitDownPrice: DATA_MISSING,
    volumeChange: DATA_MISSING,
    amountChange: DATA_MISSING,
    turnoverRate: DATA_MISSING,
    marketCap: DATA_MISSING,
    pe: stock.assetType === "ETF" ? "ETF不适用PE" : DATA_MISSING,
    pb: stock.assetType === "ETF" ? "ETF不适用PB" : DATA_MISSING,
    announcements: [],
    financials: {},
    dataSource: "真实行情获取失败",
    quoteSource: "真实行情获取失败",
    dataStatus: "数据源未返回",
    dataMessage: message || "真实行情获取失败，请稍后重试。",
    updatedAt: nowText(),
  };
}

function localSearch(keyword) {
  if (!keyword) return stockDatabase.map(withLocalQuote);
  return stockDatabase.filter((stock) => matchesLocalStock(stock, keyword)).map(withLocalQuote);
}

function matchesLocalStock(stock, keyword) {
  const upper = keyword.toUpperCase();
  const aliases = (stock.aliases ?? []).map((item) => String(item).toUpperCase());
  return stock.code === keyword
    || stock.code.includes(keyword)
    || String(stock.name ?? "").includes(keyword)
    || String(stock.shortName ?? "").includes(keyword)
    || String(stock.pinyin ?? "").toUpperCase().includes(upper)
    || aliases.some((alias) => alias.includes(upper) || alias.includes(keyword));
}

function buildQuoteTracking(stock, quote) {
  if (!quote) return stock.tracking;
  const change = Number(String(quote.changePercent).replace("%", ""));
  const direction = Number.isFinite(change) && change >= 0 ? "价格上涨" : "价格下跌";
  return [
    {
      date: "今日",
      event: `${direction} ${quote.changePercent ?? DATA_MISSING}`,
      analysis: `成交额 ${quote.amount ?? DATA_MISSING}，AI提醒：短期关注，但避免追高。`,
    },
    ...(stock.tracking ?? []),
  ];
}

function normalizeDataStatus(status) {
  if (status === "real" || status === "真实数据") return "真实数据";
  if (status === "partial" || status === "部分真实" || status === "部分数据") return STATUS_PARTIAL;
  if (status === "unavailable" || status === "fallback" || status === "备用数据" || status === "数据不足") return STATUS_LOCAL;
  return status ?? STATUS_LOCAL;
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
