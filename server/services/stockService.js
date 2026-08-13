import { getEtfKnowledge, getSecurityUniverseStatus, searchSecurityUniverse } from "./stockUniverseService.js";

const eastmoneyQuoteApi = "https://push2.eastmoney.com/api/qt/ulist.np/get";
const eastmoneySearchApi = "https://searchapi.eastmoney.com/api/suggest/get";
const eastmoneyNoticeApi = "https://np-anotice-stock.eastmoney.com/api/security/ann";
const eastmoneyFinanceApi = "https://datacenter.eastmoney.com/securities/api/data/v1/get";
const sinaQuoteApi = "https://hq.sinajs.cn/list=";
const tencentQuoteApi = "https://qt.gtimg.cn/q=";

const SOURCE_EASTMONEY = "\u4e1c\u65b9\u8d22\u5bcc";
const SOURCE_SINA = "\u65b0\u6d6a\u884c\u60c5";
const SOURCE_TENCENT = "\u817e\u8baf\u8d22\u7ecf";
const SOURCE_PUBLIC_BACKUP = "\u4e1c\u65b9\u8d22\u5bcc\u5386\u53f2\u884c\u60c5\u5907\u7528";
const SOURCE_MOCK = "\u672c\u5730\u5907\u7528\u6570\u636e";
const STATUS_REAL = "\u771f\u5b9e\u6570\u636e";
const STATUS_PARTIAL = "\u90e8\u5206\u6570\u636e";
const STATUS_MOCK = "\u6570\u636e\u4e0d\u8db3";
const UNKNOWN = "\u6570\u636e\u6e90\u672a\u8fd4\u56de";
const INDUSTRY_MISSING = "\u884c\u4e1a\u6570\u636e\u6682\u7f3a";
const BOARD_LABELS = new Set(["\u6caa\u5e02\u4e3b\u677f", "\u6df1\u5e02\u4e3b\u677f", "\u521b\u4e1a\u677f", "\u79d1\u521b\u677f", "\u5317\u4ea4\u6240", "\u6caa\u5e02", "\u6df1\u5e02", "A\u80a1"]);
const BSE_CODE_MAP = {
  "830799": "920799",
  "430489": "920489",
  "832982": "920982",
  "835185": "920185",
};

const defaultRiskTips = [
  "\u884c\u60c5\u3001\u4f30\u503c\u548c\u8d22\u52a1\u6570\u636e\u53ef\u80fd\u5b58\u5728\u5ef6\u8fdf\uff0c\u9700\u7ed3\u5408\u4ea4\u6613\u6240\u548c\u516c\u53f8\u516c\u544a\u590d\u6838\u3002",
  "\u672c\u9875\u4ec5\u7528\u4e8e\u673a\u4f1a\u89c2\u5bdf\u548c\u98ce\u9669\u63d0\u793a\uff0c\u4e0d\u6784\u6210\u660e\u786e\u4e70\u5356\u5efa\u8bae\u3002",
];

export const fallbackStocks = [
  buildFallbackStock({
    code: "600176",
    name: "\u4e2d\u56fd\u5de8\u77f3",
    pinyin: "ZGJS",
    shortName: "\u5de8\u77f3",
    industry: "\u73bb\u7483\u73bb\u7ea4",
    market: "\u6caa\u5e02",
    price: "11.36",
    changePercent: "+0.71%",
    amount: "5.82\u4ebf",
    volume: "51.4\u4e07\u624b",
    turnoverRate: "1.18%",
    marketCap: "455\u4ebf",
    pe: "18.4",
    pb: "1.7",
    listingDate: "1999-04-22",
    companyName: "\u4e2d\u56fd\u5de8\u77f3\u80a1\u4efd\u6709\u9650\u516c\u53f8",
    profile: "\u56fd\u5185\u73bb\u7ea4\u9f99\u5934\u4f01\u4e1a\u4e4b\u4e00\uff0c\u4ea7\u54c1\u8986\u76d6\u73bb\u7483\u7ea4\u7ef4\u53ca\u5236\u54c1\uff0c\u53d7\u98ce\u7535\u3001\u6c7d\u8f66\u8f7b\u91cf\u5316\u3001\u7535\u5b50\u6750\u6599\u7b49\u9700\u6c42\u5f71\u54cd\u3002",
    mainBusiness: "\u73bb\u7483\u7ea4\u7ef4\u53ca\u5236\u54c1\u7684\u751f\u4ea7\u548c\u9500\u552e\u3002",
    industryPosition: "\u73bb\u7ea4\u884c\u4e1a\u9f99\u5934\uff0c\u89c4\u6a21\u3001\u6210\u672c\u548c\u5ba2\u6237\u7ed3\u6784\u5177\u5907\u4f18\u52bf\u3002",
    financials: { revenue: "\u5f85\u63a5\u771f\u5b9e\u8d22\u62a5", netProfit: "\u5f85\u63a5\u771f\u5b9e\u8d22\u62a5", grossMargin: "\u5f85\u63a5\u771f\u5b9e\u8d22\u62a5", roe: "\u5f85\u63a5\u771f\u5b9e\u8d22\u62a5", cashFlow: "\u5f85\u63a5\u771f\u5b9e\u8d22\u62a5" },
    valuationRange: { pe: "10-30\u500d", pb: "1-4\u500d" },
    valuationStatus: "\u4e2d\u6027\u504f\u4f4e",
    hotspotRelation: "\u98ce\u7535\u6750\u6599\u3001\u51fa\u53e3\u94fe\u3001\u5468\u671f\u4fee\u590d",
  }),
  buildFallbackStock({ code: "600519", name: "\u8d35\u5dde\u8305\u53f0", pinyin: "GZMT", shortName: "\u8305\u53f0", industry: "\u767d\u9152", market: "\u6caa\u5e02", price: "1688.50", changePercent: "+0.82%", amount: "82.40\u4ebf", volume: "4.9\u4e07\u624b", turnoverRate: "0.39%", marketCap: "2.12\u4e07\u4ebf", pe: "28.6", pb: "9.8", listingDate: "2001-08-27", companyName: "\u8d35\u5dde\u8305\u53f0\u9152\u80a1\u4efd\u6709\u9650\u516c\u53f8", industryPosition: "\u9ad8\u7aef\u767d\u9152\u6838\u5fc3\u9f99\u5934\u3002" }),
  buildFallbackStock({ code: "000001", name: "\u5e73\u5b89\u94f6\u884c", pinyin: "PAYH", shortName: "\u5e73\u5b89", industry: "\u94f6\u884c", market: "\u6df1\u5e02", companyName: "\u5e73\u5b89\u94f6\u884c\u80a1\u4efd\u6709\u9650\u516c\u53f8", industryPosition: "\u5168\u56fd\u6027\u80a1\u4efd\u5236\u5546\u4e1a\u94f6\u884c\u3002" }),
  buildFallbackStock({ code: "300750", name: "\u5b81\u5fb7\u65f6\u4ee3", pinyin: "NDSD", shortName: "\u5b81\u5fb7", industry: "\u7535\u6c60", market: "\u521b\u4e1a\u677f", price: "214.20", changePercent: "+1.36%", amount: "96.10\u4ebf", volume: "45.2\u4e07\u624b", turnoverRate: "1.08%", marketCap: "9420\u4ebf", pe: "22.4", pb: "4.7", listingDate: "2018-06-11", companyName: "\u5b81\u5fb7\u65f6\u4ee3\u65b0\u80fd\u6e90\u79d1\u6280\u80a1\u4efd\u6709\u9650\u516c\u53f8", industryPosition: "\u5168\u7403\u52a8\u529b\u7535\u6c60\u9f99\u5934\u3002" }),
  buildFallbackStock({ code: "301396", name: "\u5b8f\u666f\u79d1\u6280", pinyin: "HJKJ", shortName: "\u5b8f\u666f", industry: "\u8f6f\u4ef6\u670d\u52a1", market: "\u521b\u4e1a\u677f", price: "28.64", changePercent: "-0.74%", amount: "3.20\u4ebf", volume: "11.3\u4e07\u624b", turnoverRate: "5.72%", marketCap: "31.2\u4ebf", pe: "68.5", pb: "3.6", listingDate: "2022-11-11", companyName: "\u5b8f\u666f\u79d1\u6280\u80a1\u4efd\u6709\u9650\u516c\u53f8", industryPosition: "\u667a\u6167\u57ce\u5e02\u548c\u6570\u5b57\u5316\u5e94\u7528\u5c0f\u5e02\u503c\u516c\u53f8\u3002" }),
  buildFallbackStock({ code: "688981", name: "\u4e2d\u82af\u56fd\u9645", pinyin: "ZXGJ", shortName: "\u4e2d\u82af", industry: "\u534a\u5bfc\u4f53", market: "\u79d1\u521b\u677f", price: "58.73", changePercent: "+2.18%", amount: "67.80\u4ebf", volume: "113.8\u4e07\u624b", turnoverRate: "1.46%", marketCap: "4680\u4ebf", pe: "86.2", pb: "3.1", listingDate: "2020-07-16", companyName: "\u4e2d\u82af\u56fd\u9645\u96c6\u6210\u7535\u8def\u5236\u9020\u6709\u9650\u516c\u53f8", industryPosition: "\u56fd\u5185\u6676\u5706\u4ee3\u5de5\u9f99\u5934\u3002" }),
  buildEtf({ code: "512760", name: "\u82af\u7247ETF", pinyin: "XPETF", aliases: ["AI", "\u82af\u7247", "\u534a\u5bfc\u4f53", "CHIP"], industry: "\u534a\u5bfc\u4f53ETF", trackingIndex: "\u534a\u5bfc\u4f53\u82af\u7247\u884c\u4e1a\u6307\u6570" }),
  buildEtf({ code: "159819", name: "\u4eba\u5de5\u667a\u80fdETF", pinyin: "RGETF", aliases: ["AI", "AIETF", "\u4eba\u5de5\u667a\u80fd", "\u7b97\u529b"], industry: "AI\u4e3b\u9898ETF", trackingIndex: "\u4eba\u5de5\u667a\u80fd\u4e3b\u9898\u6307\u6570" }),
  buildEtf({ code: "515050", name: "5GETF", pinyin: "TXETF", aliases: ["5GETF", "5G", "\u901a\u4fe1", "\u901a\u4fe1ETF", "515050"], industry: "\u901a\u4fe1ETF", trackingIndex: "5G\u901a\u4fe1\u4e3b\u9898\u6307\u6570" }),
  buildEtf({ code: "512480", name: "\u534a\u5bfc\u4f53ETF", pinyin: "BDTETF", aliases: ["\u534a\u5bfc\u4f53", "\u82af\u7247"], industry: "\u534a\u5bfc\u4f53ETF", trackingIndex: "\u534a\u5bfc\u4f53\u82af\u7247\u6307\u6570" }),
  buildEtf({ code: "515880", name: "\u901a\u4fe1ETF", pinyin: "TXETF2", aliases: ["\u901a\u4fe1", "5G"], industry: "\u901a\u4fe1ETF", trackingIndex: "\u901a\u4fe1\u8bbe\u5907\u6307\u6570" }),
  buildEtf({ code: "588000", name: "\u79d1\u521b50ETF", pinyin: "KCETF", aliases: ["\u79d1\u521b", "\u79d1\u521b50"], industry: "\u79d1\u521bETF", trackingIndex: "\u79d1\u521b50\u6307\u6570" }),
  buildEtf({ code: "510300", name: "\u6caa\u6df1300ETF", pinyin: "HS300ETF", aliases: ["\u6caa\u6df1300", "300ETF"], industry: "\u5bbd\u57faETF", trackingIndex: "\u6caa\u6df1300\u6307\u6570" }),
  buildEtf({ code: "510500", name: "\u4e2d\u8bc1500ETF", pinyin: "ZZ500ETF", aliases: ["\u4e2d\u8bc1500", "500ETF"], industry: "\u5bbd\u57faETF", trackingIndex: "\u4e2d\u8bc1500\u6307\u6570" }),
  buildEtf({ code: "513100", name: "\u7eb3\u6307ETF", pinyin: "NZETF", aliases: ["\u7eb3\u6307", "NASDAQ", "\u7f8e\u80a1"], industry: "\u8de8\u5883ETF", trackingIndex: "\u7eb3\u65af\u8fbe\u514b100\u6307\u6570" }),
];

export async function searchStockCandidates(query) {
  const keyword = normalizeQuery(query);
  if (!keyword) {
    const universe = await searchSecurityUniverse("", 50).catch(() => []);
    return buildSearchResult(universe.length ? universe : fallbackStocks, universe.length ? "\u4e1c\u65b9\u8d22\u5bcc\u8bc1\u5238\u5217\u8868" : SOURCE_MOCK, universe.length ? STATUS_PARTIAL : STATUS_MOCK, keyword);
  }

  const fallbackMatches = matchFallbackStocks(keyword);
  try {
    const [universe, remote] = await Promise.all([
      searchSecurityUniverse(keyword, 40).catch(() => []),
      /^\d{6}$/.test(keyword)
      ? [{ code: keyword, secid: toSecid(keyword) }]
      : searchEastmoney(keyword).catch(() => []),
    ]);
    const candidates = sortStockMatches(dedupeStocks([...fallbackMatches, ...universe, ...remote]), keyword);
    if (!candidates.length) return buildSearchResult([], "\u4e1c\u65b9\u8d22\u5bcc\u8bc1\u5238\u5217\u8868", "未命中", keyword);
    const quoted = await Promise.all(candidates.slice(0, 20).map((stock) => fetchQuote(stock).catch((error) => toUnavailableSecurity(stock, error.message))));
    const combined = sortStockMatches(dedupeStocks([...quoted, ...candidates.slice(20)]).map((stock) => enrichResearchFields(mergeKnown(stock))), keyword);
    const hasLiveQuote = combined.some((item) => [STATUS_REAL, STATUS_PARTIAL].includes(item.dataStatus)
      && item.price && ![UNKNOWN, "\u6682\u65e0"].includes(item.price));
    const universeStatus = getSecurityUniverseStatus();
    return buildSearchResult(combined, hasLiveQuote ? combined.find((item) => item.price && ![UNKNOWN, "\u6682\u65e0"].includes(item.price))?.dataSource : universeStatus.source, hasLiveQuote ? STATUS_PARTIAL : universeStatus.status === "real" ? STATUS_PARTIAL : STATUS_MOCK, keyword, universeStatus.message);
  } catch (error) {
    return buildSearchResult(fallbackMatches.map((stock) => toUnavailableSecurity(stock, error.message)), SOURCE_MOCK, STATUS_MOCK, keyword, error.message);
  }
}

export async function getStockDetail(query) {
  const keyword = normalizeQuery(query);
  const startedAt = Date.now();
  const isCodeQuery = isSupportedSecurityCode(keyword);
  const result = isCodeQuery ? null : await withTimeout(
    searchStockCandidates(keyword),
    4500,
    () => ({ ok: true, source: SOURCE_MOCK, status: STATUS_MOCK, updatedAt: nowText(), data: [], message: "\u641c\u7d22\u8d85\u65f6\uff0c\u8bf7\u76f4\u63a5\u8f93\u51656\u4f4d\u4ee3\u7801" }),
  );
  const stock = isCodeQuery ? await getFastQuoteByCode(keyword) : result.data[0];
  if (!stock) {
    console.info("[stock-detail]", { code: keyword, quote: "fail", elapsedMs: Date.now() - startedAt, failureReason: result.message });
    return { ok: false, message: `\u672a\u627e\u5230\u5339\u914d\u6807\u7684\uff1a${query}`, source: result.source, status: result.status, updatedAt: result.updatedAt, data: null };
  }

  const [announcements, financials] = await Promise.all([
    withTimeout(fetchAnnouncements(stock.code).catch(() => []), 700, () => []),
    withTimeout(
      fetchFinancials(stock).catch(() => buildUnavailableFinancials(stock, "\u8d22\u52a1\u63a5\u53e3\u672a\u8fd4\u56de\uff0c\u4e0d\u5f71\u54cd\u57fa\u7840\u884c\u60c5\u5c55\u793a")),
      700,
      () => buildUnavailableFinancials(stock, "\u8d22\u52a1\u63a5\u53e3\u54cd\u5e94\u8d85\u65f6\uff0c\u4e0d\u5f71\u54cd\u57fa\u7840\u884c\u60c5\u5c55\u793a"),
    ),
  ]);
  const detail = enrichResearchFields({
    ...stock,
    announcements,
    financials,
    dataSource: announcements.length ? `${stock.dataSource || SOURCE_EASTMONEY} / \u4e1c\u65b9\u8d22\u5bcc\u516c\u544a` : stock.dataSource,
    dataStatus: stock.dataStatus === STATUS_REAL && (announcements.length || financials.status === STATUS_REAL) ? STATUS_REAL : stock.dataStatus,
  });
  console.info("[stock-detail]", {
    code: detail.code,
    quote: detail.price && detail.price !== UNKNOWN ? "success" : "fail",
    source: detail.dataSource,
    status: detail.dataStatus,
    elapsedMs: Date.now() - startedAt,
    failureReason: detail.dataMessage || "",
  });
  return { ok: true, source: detail.dataSource, status: detail.dataStatus, updatedAt: detail.updatedAt, data: detail };
}

async function getFastQuoteByCode(code) {
  const quoteCode = normalizeQuoteCode(code);
  const fallback = fallbackStocks.find((item) => item.code === code);
  const base = enrichResearchFields({
    ...pickReferenceMetadata(fallback),
    code,
    quoteCode,
    secid: toSecid(quoteCode),
    market: inferMarket(quoteCode),
    assetType: isEtfCode(quoteCode) ? "ETF" : "\u80a1\u7968",
    industry: normalizeIndustry(fallback?.industry ?? inferIndustryByCode(quoteCode), isEtfCode(quoteCode)),
    dataSource: "\u884c\u60c5\u63a5\u53e3",
    dataStatus: STATUS_PARTIAL,
    updatedAt: nowText(),
  });

  try {
    const quote = await withTimeout(fetchQuote(base), 3800, () => {
      throw new Error("\u884c\u60c5\u63a5\u53e3\u8d85\u8fc75\u79d2\u672a\u8fd4\u56de");
    });
    return enrichResearchFields({ ...base, ...quote });
  } catch (error) {
    return enrichResearchFields({
      ...base,
      name: fallback?.name ?? code,
      price: UNKNOWN,
      changePercent: UNKNOWN,
      changeAmount: UNKNOWN,
      amount: UNKNOWN,
      volume: UNKNOWN,
      quoteSource: "\u771f\u5b9e\u884c\u60c5\u83b7\u53d6\u5931\u8d25",
      dataSource: "\u771f\u5b9e\u884c\u60c5\u83b7\u53d6\u5931\u8d25",
      dataStatus: STATUS_MOCK,
      dataMessage: error.message,
      updatedAt: nowText(),
    });
  }
}

async function searchEastmoney(keyword) {
  const url = `${eastmoneySearchApi}?input=${encodeURIComponent(keyword)}&type=14&token=`;
  const json = await fetchJson(url);
  const rows = json?.QuotationCodeTable?.Data ?? json?.data ?? [];
  const stocks = rows
    .map((item) => ({ code: String(item.Code ?? item.code ?? ""), name: item.Name ?? item.name, market: item.MktNum ?? item.market }))
    .filter((item) => /^\d{6}$/.test(item.code))
    .map((item) => ({ ...item, secid: toSecid(item.code, item.market) }));
  if (!stocks.length) throw new Error("\u8fdc\u7a0b\u641c\u7d22\u672a\u8fd4\u56de\u5339\u914d\u8bc1\u5238");
  return stocks;
}

async function fetchQuote(stock) {
  const normalizedStock = { ...stock, quoteCode: normalizeQuoteCode(stock.quoteCode ?? stock.code) };
  try {
    return restoreInputCode(await fetchEastmoneyQuote(normalizedStock), stock);
  } catch (eastmoneyError) {
    const [sinaResult, tencentResult] = await Promise.allSettled([
      fetchSinaQuote(normalizedStock),
      fetchTencentQuote(normalizedStock, eastmoneyError.message),
    ]);
    if (sinaResult.status === "fulfilled" && tencentResult.status === "fulfilled") {
      return restoreInputCode(mergeBackupQuotes(sinaResult.value, tencentResult.value), stock);
    }
    if (sinaResult.status === "fulfilled") return restoreInputCode(sinaResult.value, stock);
    if (tencentResult.status === "fulfilled") return restoreInputCode(tencentResult.value, stock);
    return restoreInputCode(await fetchEastmoneyKlineQuote(normalizedStock, `${eastmoneyError.message}; ${sinaResult.reason?.message}; ${tencentResult.reason?.message}`), stock);
  }
}

function mergeBackupQuotes(sina, tencent) {
  const missing = new Set([UNKNOWN, "\u6682\u65e0", "", undefined, null]);
  const value = (primary, secondary) => missing.has(primary) ? secondary : primary;
  return {
    ...tencent,
    ...sina,
    turnoverRate: value(sina.turnoverRate, tencent.turnoverRate),
    marketCap: value(sina.marketCap, tencent.marketCap),
    pe: value(sina.pe, tencent.pe),
    pb: value(sina.pb, tencent.pb),
    dataSource: `${SOURCE_SINA} / ${SOURCE_TENCENT}`,
    quoteSource: `${SOURCE_SINA} / ${SOURCE_TENCENT}`,
    dataStatus: STATUS_PARTIAL,
  };
}

async function fetchEastmoneyQuote(stock) {
  const fields = "f12,f14,f2,f3,f4,f5,f6,f8,f20,f100,f162,f167";
  const quoteCode = normalizeQuoteCode(stock.quoteCode ?? stock.code);
  const url = `${eastmoneyQuoteApi}?fltt=2&fields=${fields}&secids=${toSecid(quoteCode, stock.market)}`;
  const json = await fetchJson(url);
  const row = json?.data?.diff?.[0];
  if (!row) throw new Error("\u884c\u60c5\u4e3a\u7a7a");
  const code = row.f12 || stock.code;
  const assetType = isEtfCode(code) ? "ETF" : "\u80a1\u7968";
  const etfInfo = assetType === "ETF" ? getEtfKnowledge(code) : {};
  return {
    code,
    name: row.f14 || stock.name || code,
    price: formatPrice(row.f2),
    changePercent: formatPercent(row.f3),
    changeAmount: formatPrice(row.f4),
    volume: formatVolume(row.f5),
    amount: formatAmount(row.f6),
    turnoverRate: assetType === "ETF" ? "\u4e0d\u9002\u7528" : formatPercent(row.f8),
    marketCap: formatAmount(row.f20),
    fundScale: assetType === "ETF" ? formatAmount(row.f20) : undefined,
    trackingIndex: stock.trackingIndex ?? etfInfo.trackingIndex ?? (assetType === "ETF" ? "\u8ddf\u8e2a\u6307\u6570\u7531\u57fa\u91d1\u516c\u544a\u590d\u6838" : undefined),
    inceptionDate: assetType === "ETF" ? stock.inceptionDate ?? UNKNOWN : undefined,
    fundManager: assetType === "ETF" ? stock.fundManager ?? UNKNOWN : undefined,
    components: assetType === "ETF" ? stock.components ?? etfInfo.components ?? [] : undefined,
    capitalFlow: assetType === "ETF" ? `\u6210\u4ea4\u989d ${formatAmount(row.f6)}\uff0c\u7528\u4e8e\u89c2\u5bdf\u8d44\u91d1\u6d3b\u8dc3\u5ea6\u3002` : undefined,
    valuationLevel: assetType === "ETF" ? "\u8bf7\u7ed3\u5408\u8ddf\u8e2a\u6307\u6570\u4f30\u503c\u548c\u6298\u6ea2\u4ef7\u89c2\u5bdf" : undefined,
    industry: normalizeIndustry(row.f100 || stock.industry || etfInfo.industry, assetType === "ETF"),
    market: inferMarket(code),
    assetType,
    pe: assetType === "ETF" ? "\u4e0d\u9002\u7528" : formatMetric(row.f162),
    pb: assetType === "ETF" ? "\u4e0d\u9002\u7528" : formatMetric(row.f167),
    valuationStatus: assetType === "ETF" ? "\u89c2\u5bdf\u8ddf\u8e2a\u6307\u6570\u4f30\u503c" : buildValuationStatus(row.f162),
    quoteSource: SOURCE_EASTMONEY,
    dataSource: SOURCE_EASTMONEY,
    dataStatus: STATUS_REAL,
    updatedAt: nowText(),
  };
}

async function fetchSinaQuote(stock) {
  const code = String(stock.quoteCode ?? stock.code ?? "");
  const displayCode = String(stock.code ?? code);
  const symbol = `${quoteMarketPrefix(code)}${code}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1400);
  let fields;
  try {
    const response = await fetch(`${sinaQuoteApi}${symbol}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Referer: "https://finance.sina.com.cn/" },
    });
    if (!response.ok) throw new Error(`Sina HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = new TextDecoder("gb18030").decode(buffer);
    const raw = text.match(/="([^"]*)"/)?.[1] ?? "";
    fields = raw.split(",");
    if (fields.length < 10 || !fields[0]) throw new Error("\u65b0\u6d6a\u884c\u60c5\u4e3a\u7a7a");
  } finally {
    clearTimeout(timeout);
  }

  const assetType = isEtfCode(code) ? "ETF" : "\u80a1\u7968";
  const etfInfo = assetType === "ETF" ? getEtfKnowledge(code) : {};
  const previousClose = normalizeNumber(fields[2]);
  const current = normalizeNumber(fields[3]);
  if (current <= 0 || previousClose <= 0) throw new Error("\u65b0\u6d6a\u884c\u60c5\u672a\u8fd4\u56de\u6709\u6548\u4ef7\u683c");
  const change = current - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  return {
    code,
    inputCode: displayCode,
    name: fields[0] || stock.name || code,
    price: formatPrice(current),
    changePercent: formatPercent(changePercent),
    changeAmount: formatPrice(change),
    volume: formatVolume(normalizeNumber(fields[8]) / 100),
    amount: formatAmount(normalizeNumber(fields[9])),
    turnoverRate: assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN,
    marketCap: UNKNOWN,
    fundScale: assetType === "ETF" ? UNKNOWN : undefined,
    trackingIndex: stock.trackingIndex ?? etfInfo.trackingIndex ?? (assetType === "ETF" ? "\u8ddf\u8e2a\u6307\u6570\u7531\u57fa\u91d1\u516c\u544a\u590d\u6838" : undefined),
    inceptionDate: assetType === "ETF" ? stock.inceptionDate ?? UNKNOWN : undefined,
    fundManager: assetType === "ETF" ? stock.fundManager ?? UNKNOWN : undefined,
    components: assetType === "ETF" ? stock.components ?? etfInfo.components ?? [] : undefined,
    capitalFlow: assetType === "ETF" ? `\u6210\u4ea4\u989d ${formatAmount(normalizeNumber(fields[9]))}\uff0c\u7528\u4e8e\u89c2\u5bdf\u8d44\u91d1\u6d3b\u8dc3\u5ea6\u3002` : undefined,
    valuationLevel: assetType === "ETF" ? "\u8bf7\u7ed3\u5408\u8ddf\u8e2a\u6307\u6570\u4f30\u503c\u548c\u6298\u6ea2\u4ef7\u89c2\u5bdf" : undefined,
    industry: normalizeIndustry(stock.industry || etfInfo.industry, assetType === "ETF"),
    market: inferMarket(code),
    assetType,
    pe: assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN,
    pb: assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN,
    valuationStatus: assetType === "ETF" ? "\u89c2\u5bdf\u8ddf\u8e2a\u6307\u6570\u4f30\u503c" : buildValuationStatus(stock.pe),
    quoteSource: SOURCE_SINA,
    dataSource: SOURCE_SINA,
    dataStatus: STATUS_PARTIAL,
    updatedAt: fields[30] && fields[31] ? `${fields[30]} ${fields[31]}` : nowText(),
  };
}

async function fetchTencentQuote(stock, previousError = "") {
  const code = String(stock.quoteCode ?? stock.code ?? "");
  const displayCode = String(stock.code ?? code);
  const symbol = `${quoteMarketPrefix(code)}${code}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1400);
  try {
    const response = await fetch(`${tencentQuoteApi}${symbol}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Referer: "https://gu.qq.com/" },
    });
    if (!response.ok) throw new Error(`Tencent HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = new TextDecoder("gb18030").decode(buffer);
    const fields = (text.match(/="([^"]*)"/)?.[1] ?? "").split("~");
    if (fields.length < 40 || !fields[1]) throw new Error(`腾讯行情为空${previousError ? `；${previousError}` : ""}`);
    const assetType = isEtfCode(code) ? "ETF" : "\u80a1\u7968";
    const etfInfo = assetType === "ETF" ? getEtfKnowledge(code) : {};
    return {
      code,
      inputCode: displayCode,
      name: fields[1] || stock.name || code,
      price: formatPrice(fields[3]),
      changePercent: formatPercent(fields[32]),
      changeAmount: formatPrice(fields[31]),
      volume: fields[36] ? `${fields[36]}\u624b` : UNKNOWN,
      amount: fields[37] ? `${fields[37]}\u4e07\u5143` : UNKNOWN,
      turnoverRate: assetType === "ETF" ? "\u4e0d\u9002\u7528" : formatPercent(fields[38]),
      marketCap: fields[45] ? `${normalizeNumber(fields[45]).toFixed(2)}\u4ebf` : UNKNOWN,
      fundScale: assetType === "ETF" ? UNKNOWN : undefined,
      trackingIndex: stock.trackingIndex ?? etfInfo.trackingIndex ?? (assetType === "ETF" ? "\u8ddf\u8e2a\u6307\u6570\u7531\u57fa\u91d1\u516c\u544a\u590d\u6838" : undefined),
      inceptionDate: assetType === "ETF" ? stock.inceptionDate ?? UNKNOWN : undefined,
      fundManager: assetType === "ETF" ? stock.fundManager ?? UNKNOWN : undefined,
      components: assetType === "ETF" ? stock.components ?? etfInfo.components ?? [] : undefined,
      capitalFlow: assetType === "ETF" ? `\u6210\u4ea4\u989d ${fields[37] ?? UNKNOWN}\u4e07\u5143\uff0c\u7528\u4e8e\u89c2\u5bdf\u8d44\u91d1\u6d3b\u8dc3\u5ea6\u3002` : undefined,
      valuationLevel: assetType === "ETF" ? "\u8bf7\u7ed3\u5408\u8ddf\u8e2a\u6307\u6570\u4f30\u503c\u548c\u6298\u6ea2\u4ef7\u89c2\u5bdf" : undefined,
      industry: normalizeIndustry(stock.industry || etfInfo.industry, assetType === "ETF"),
      market: inferMarket(code),
      assetType,
      pe: assetType === "ETF" ? "\u4e0d\u9002\u7528" : formatMetric(fields[39]),
      pb: assetType === "ETF" ? "\u4e0d\u9002\u7528" : formatMetric(fields[46]),
      valuationStatus: assetType === "ETF" ? "\u89c2\u5bdf\u8ddf\u8e2a\u6307\u6570\u4f30\u503c" : buildValuationStatus(stock.pe),
      quoteSource: SOURCE_TENCENT,
      dataSource: SOURCE_TENCENT,
      dataStatus: STATUS_PARTIAL,
      updatedAt: fields[30] || nowText(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchEastmoneyKlineQuote(stock, previousError = "") {
  const code = String(stock.quoteCode ?? stock.code ?? "");
  const displayCode = String(stock.code ?? code);
  const assetType = isEtfCode(code) ? "ETF" : "\u80a1\u7968";
  const etfInfo = assetType === "ETF" ? getEtfKnowledge(code) : {};
  const secid = stock.secid ?? toSecid(code, stock.market);
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=1`;
  const json = await fetchJson(url);
  const raw = json?.data?.klines?.[0];
  if (!raw) throw new Error(`\u5907\u7528\u516c\u5f00\u884c\u60c5\u4e3a\u7a7a${previousError ? `\uff1b${previousError}` : ""}`);
  const fields = String(raw).split(",");
  const amount = normalizeNumber(fields[6]);
  return {
    code,
    inputCode: displayCode,
    name: stock.name || json?.data?.name || code,
    price: formatPrice(fields[2]),
    changePercent: formatPercent(fields[8]),
    changeAmount: formatPrice(fields[9]),
    volume: formatVolume(normalizeNumber(fields[5])),
    amount: formatAmount(amount),
    turnoverRate: assetType === "ETF" ? "\u4e0d\u9002\u7528" : formatPercent(fields[10]),
    marketCap: stock.marketCap ?? UNKNOWN,
    fundScale: assetType === "ETF" ? stock.fundScale ?? UNKNOWN : undefined,
    trackingIndex: stock.trackingIndex ?? etfInfo.trackingIndex ?? (assetType === "ETF" ? "\u8ddf\u8e2a\u6307\u6570\u7531\u57fa\u91d1\u516c\u544a\u590d\u6838" : undefined),
    inceptionDate: assetType === "ETF" ? stock.inceptionDate ?? UNKNOWN : undefined,
    fundManager: assetType === "ETF" ? stock.fundManager ?? UNKNOWN : undefined,
    components: assetType === "ETF" ? stock.components ?? etfInfo.components ?? [] : undefined,
    capitalFlow: assetType === "ETF" ? `\u6210\u4ea4\u989d ${formatAmount(amount)}\uff0c\u6765\u81ea\u65e5\u7ebf\u5907\u7528\u884c\u60c5\u3002` : undefined,
    valuationLevel: assetType === "ETF" ? "\u8bf7\u7ed3\u5408\u8ddf\u8e2a\u6307\u6570\u4f30\u503c\u548c\u6298\u6ea2\u4ef7\u89c2\u5bdf" : undefined,
    industry: normalizeIndustry(stock.industry || etfInfo.industry || inferIndustryByCode(code), assetType === "ETF"),
    market: inferMarket(code),
    assetType,
    pe: assetType === "ETF" ? "\u4e0d\u9002\u7528" : stock.pe ?? UNKNOWN,
    pb: assetType === "ETF" ? "\u4e0d\u9002\u7528" : stock.pb ?? UNKNOWN,
    valuationStatus: assetType === "ETF" ? "\u89c2\u5bdf\u8ddf\u8e2a\u6307\u6570\u4f30\u503c" : buildValuationStatus(stock.pe),
    quoteSource: SOURCE_PUBLIC_BACKUP,
    dataSource: SOURCE_PUBLIC_BACKUP,
    dataStatus: STATUS_PARTIAL,
    updatedAt: fields[0] || nowText(),
    dataMessage: "\u5b9e\u65f6\u63a5\u53e3\u672a\u8fd4\u56de\uff0c\u4f7f\u7528\u516c\u5f00\u65e5\u7ebf\u5907\u7528\u884c\u60c5",
  };
}

async function fetchAnnouncements(code) {
  if (!/^\d{6}$/.test(String(code))) return [];
  const url = `${eastmoneyNoticeApi}?sr=-1&page_size=5&page_index=1&ann_type=A&client_source=web&stock_list=${encodeURIComponent(code)}`;
  const json = await fetchJson(url);
  const rows = json?.data?.list ?? json?.data?.items ?? [];
  return rows.slice(0, 5).map((item) => ({
    title: item.title || item.notice_title || "\u516c\u544a",
    date: String(item.notice_date || item.eiTime || item.display_time || "").slice(0, 10) || nowText(),
    type: classifyAnnouncement(item.title || item.notice_title || ""),
    source: "\u4e1c\u65b9\u8d22\u5bcc\u516c\u544a",
    relatedStock: code,
    link: item.art_code ? `https://data.eastmoney.com/notices/detail/${code}/${item.art_code}.html` : "",
    impact: classifyImpact(item.title || item.notice_title || ""),
    analysis: analyzeAnnouncementImpact(item.title || item.notice_title || "", code),
  }));
}

async function fetchFinancials(stock) {
  if (stock.assetType === "ETF" || isEtfCode(stock.code)) {
    return buildUnavailableFinancials(stock, "\u57fa\u91d1\u54c1\u79cd\u4e0d\u9002\u7528\u516c\u53f8\u8d22\u52a1");
  }

  const columns = [
    "SECUCODE",
    "SECURITY_CODE",
    "REPORT_DATE",
    "REPORT_TYPE",
    "TOTAL_OPERATE_INCOME",
    "TOTAL_OPERATE_INCOME_YOY",
    "PARENT_NETPROFIT",
    "PARENT_NETPROFIT_YOY",
    "GROSS_PROFIT_RATIO",
    "ROE_WEIGHT",
    "ASSET_LIAB_RATIO",
    "NETCASH_OPERATE",
    "NOTICE_DATE",
  ].join(",");
  const params = new URLSearchParams({
    reportName: "RPT_F10_FINANCE_MAINFINADATA",
    columns,
    quoteColumns: "",
    filter: `(SECUCODE="${toFinanceSecuCode(stock.code)}")`,
    pageNumber: "1",
    pageSize: "1",
    sortTypes: "-1",
    sortColumns: "REPORT_DATE",
    source: "HSF10",
    client: "PC",
  });
  const json = await fetchJson(`${eastmoneyFinanceApi}?${params.toString()}`);
  const row = json?.result?.data?.[0] ?? json?.data?.[0];
  if (!row) return buildUnavailableFinancials(stock);
  return {
    revenue: formatAmount(row.TOTAL_OPERATE_INCOME),
    revenueYoY: formatPercent(row.TOTAL_OPERATE_INCOME_YOY),
    netProfit: formatAmount(row.PARENT_NETPROFIT),
    netProfitYoY: formatPercent(row.PARENT_NETPROFIT_YOY),
    grossMargin: formatPercent(row.GROSS_PROFIT_RATIO),
    roe: formatPercent(row.ROE_WEIGHT),
    debtRatio: formatPercent(row.ASSET_LIAB_RATIO),
    cashFlow: formatAmount(row.NETCASH_OPERATE),
    reportDate: String(row.REPORT_DATE ?? row.NOTICE_DATE ?? "").slice(0, 10) || UNKNOWN,
    source: "\u4e1c\u65b9\u8d22\u5bccF10\u8d22\u52a1",
    updatedAt: nowText(),
    status: STATUS_REAL,
    credibility: { level: "\u9ad8", reason: "\u6765\u81ea\u4e1c\u65b9\u8d22\u5bccF10\u8d22\u52a1\u63a5\u53e3\uff0c\u4f46\u4ecd\u5efa\u8bae\u4e0e\u516c\u544a\u539f\u6587\u590d\u6838" },
  };
}

function mergeKnown(stock) {
  const known = fallbackStocks.find((item) => item.code === stock.code);
  return { ...pickReferenceMetadata(known), ...stock, industry: normalizeIndustry(stock.industry ?? known?.industry, (stock.assetType ?? known?.assetType) === "ETF" || isEtfCode(stock.code)) };
}

function pickReferenceMetadata(stock = {}) {
  const {
    code,
    name,
    pinyin,
    shortName,
    aliases,
    industry,
    market,
    assetType,
    companyName,
    listingDate,
    profile,
    mainBusiness,
    industryPosition,
    trackingIndex,
    inceptionDate,
    fundManager,
    fundScale,
    components,
    capitalFlow,
    valuationLevel,
    hotspotRelation,
  } = stock;
  return {
    code,
    name,
    pinyin,
    shortName,
    aliases,
    industry,
    market,
    assetType,
    companyName,
    listingDate,
    profile,
    mainBusiness,
    industryPosition,
    trackingIndex,
    inceptionDate,
    fundManager,
    fundScale,
    components,
    capitalFlow,
    valuationLevel,
    hotspotRelation,
  };
}

function enrichResearchFields(stock) {
  const code = stock.code ?? "";
  const name = stock.name ?? stock.stockName ?? code;
  const assetType = stock.assetType ?? (isEtfCode(code) ? "ETF" : "\u80a1\u7968");
  const industry = normalizeIndustry(stock.industry, assetType === "ETF");
  const base = {
    ...stock,
    code,
    name,
    assetType,
    pinyin: stock.pinyin ?? "",
    aliases: stock.aliases ?? [],
    market: stock.market ?? inferMarket(code),
    industry,
    companyName: stock.companyName ?? name,
    listingDate: stock.listingDate ?? UNKNOWN,
    price: stock.price ?? UNKNOWN,
    changePercent: stock.changePercent ?? UNKNOWN,
    changeAmount: stock.changeAmount ?? UNKNOWN,
    amount: stock.amount ?? UNKNOWN,
    volume: stock.volume ?? UNKNOWN,
    turnoverRate: stock.turnoverRate ?? UNKNOWN,
    marketCap: stock.marketCap ?? UNKNOWN,
    pe: stock.pe ?? (assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN),
    pb: stock.pb ?? (assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN),
    valuationStatus: stock.valuationStatus ?? "\u9700\u7ee7\u7eed\u89c2\u5bdf",
    dataSource: stock.dataSource ?? SOURCE_MOCK,
    quoteSource: stock.quoteSource ?? stock.dataSource ?? SOURCE_MOCK,
    dataStatus: stock.dataStatus ?? STATUS_MOCK,
    updatedAt: stock.updatedAt ?? nowText(),
    profile: stock.profile ?? `${name}\u7684\u57fa\u7840\u8d44\u6599\u6765\u81ea\u884c\u60c5\u63a5\u53e3\u548c\u672c\u5730\u7814\u7a76\u5e93\uff0c\u540e\u7eed\u53ef\u63a5\u5165\u5b8c\u6574\u5e74\u62a5\u548c\u884c\u4e1a\u6570\u636e\u6821\u9a8c\u3002`,
    mainBusiness: stock.mainBusiness ?? (assetType === "ETF" ? `\u8ddf\u8e2a${stock.trackingIndex ?? "\u76f8\u5173\u6307\u6570"}` : `${industry}\u76f8\u5173\u4e1a\u52a1\uff0c\u9700\u7ed3\u5408\u5e74\u62a5\u548c\u516c\u544a\u7ee7\u7eed\u9a8c\u8bc1\u3002`),
    industryPosition: stock.industryPosition ?? `${industry}\u65b9\u5411\u9700\u7ed3\u5408\u666f\u6c14\u5ea6\u3001\u4f30\u503c\u548c\u8d44\u91d1\u6301\u7eed\u6027\u89c2\u5bdf\u3002`,
    financials: stock.financials ?? buildFinancials(stock),
    valuationRange: stock.valuationRange ?? { pe: "\u5386\u53f2PE\u7531\u6570\u636e\u6e90\u8865\u5145", pb: "\u5386\u53f2PB\u7531\u6570\u636e\u6e90\u8865\u5145" },
    announcements: stock.announcements ?? [],
    riskTips: stock.riskTips ?? defaultRiskTips,
  };
  return { ...base, researchReport: stock.researchReport ?? buildResearchReport(base) };
}

function buildFinancials(stock) {
  if ((stock.assetType ?? "") === "ETF" || isEtfCode(stock.code)) {
    return buildUnavailableFinancials(stock, "\u57fa\u91d1\u54c1\u79cd\u4e0d\u9002\u7528\u516c\u53f8\u8d22\u52a1");
  }
  return {
    ...buildUnavailableFinancials(stock),
    ...stock.financials,
  };
}

function buildUnavailableFinancials(stock, reason = "\u8d22\u52a1\u63a5\u53e3\u672a\u8fd4\u56de\u6709\u6548\u6570\u636e") {
  const notAvailable = stock.assetType === "ETF" || isEtfCode(stock.code) ? "\u4e0d\u9002\u7528" : UNKNOWN;
  return {
    revenue: notAvailable,
    revenueYoY: notAvailable,
    netProfit: notAvailable,
    netProfitYoY: notAvailable,
    grossMargin: notAvailable,
    roe: notAvailable,
    debtRatio: notAvailable,
    cashFlow: notAvailable,
    reportDate: UNKNOWN,
    source: reason,
    updatedAt: nowText(),
    status: stock.assetType === "ETF" || isEtfCode(stock.code) ? STATUS_PARTIAL : STATUS_MOCK,
    credibility: { level: stock.assetType === "ETF" || isEtfCode(stock.code) ? "\u4e2d" : "\u4f4e", reason },
  };
}

function buildResearchReport(stock) {
  const isEtf = stock.assetType === "ETF";
  return {
    company: isEtf ? `${stock.name}\u662fETF\u54c1\u79cd\uff0c\u7814\u7a76\u91cd\u70b9\u662f\u8ddf\u8e2a\u6307\u6570\u3001\u6210\u4efd\u7ed3\u6784\u3001\u6d41\u52a8\u6027\u548c\u6298\u6ea2\u4ef7\u3002` : `${stock.name}\u5df2\u7eb3\u5165\u4e2a\u80a1\u7814\u7a76\u89c6\u56fe\uff0c\u9700\u7ed3\u5408\u516c\u544a\u3001\u8d22\u62a5\u548c\u884c\u4e1a\u6570\u636e\u6301\u7eed\u9a8c\u8bc1\u3002`,
    industry: `${stock.industry}\u65b9\u5411\u9700\u89c2\u5bdf\u653f\u7b56\u3001\u666f\u6c14\u5ea6\u3001\u4f30\u503c\u4f4d\u7f6e\u548c\u8d44\u91d1\u6301\u7eed\u6027\u3002`,
    moat: isEtf ? "ETF\u6ca1\u6709\u516c\u53f8\u62a4\u57ce\u6cb3\uff0c\u91cd\u70b9\u770b\u8ddf\u8e2a\u6307\u6570\u8d28\u91cf\u3001\u8d39\u7387\u548c\u6d41\u52a8\u6027\u3002" : "\u6838\u5fc3\u7ade\u4e89\u529b\u9700\u4ece\u4e3b\u8425\u4e1a\u52a1\u3001\u5ba2\u6237\u7ed3\u6784\u3001\u76c8\u5229\u80fd\u529b\u548c\u7814\u53d1\u6295\u5165\u9a8c\u8bc1\u3002",
    hotspotRelation: stock.hotspotRelation ?? `${stock.industry}\u4e0e\u5f53\u524d\u5e02\u573a\u70ed\u70b9\u53ef\u80fd\u5b58\u5728\u5173\u8054\uff0c\u9700\u89c2\u5bdf\u6301\u7eed\u6027\u3002`,
    upFactors: ["\u884c\u4e1a\u666f\u6c14\u6216\u653f\u7b56\u9884\u671f\u6539\u5584", "\u6210\u4ea4\u6d3b\u8dc3\u5ea6\u63d0\u5347", "\u76f8\u5173\u4e3b\u9898\u8d44\u91d1\u5173\u6ce8"],
    downsideRisks: ["\u77ed\u671f\u6da8\u5e45\u8fc7\u9ad8", "\u4f30\u503c\u6ce2\u52a8", "\u884c\u4e1a\u666f\u6c14\u6216\u653f\u7b56\u9884\u671f\u53d8\u5316"],
    moveReason: "\u6700\u8fd1\u6da8\u8dcc\u9700\u7ed3\u5408\u6307\u6570\u3001\u884c\u4e1a\u677f\u5757\u3001\u65b0\u95fb\u4e8b\u4ef6\u548c\u6210\u4ea4\u91cf\u7efc\u5408\u5224\u65ad\u3002",
    newsImpact: (stock.announcements ?? []).length ? `\u6700\u65b0\u516c\u544a\uff1a${stock.announcements[0].title}\uff1b\u5f71\u54cd\uff1a${stock.announcements[0].analysis?.impact ?? stock.announcements[0].impact ?? "\u9700\u7ee7\u7eed\u89c2\u5bdf"}` : "\u672a\u5339\u914d\u5230\u91cd\u5927\u65b0\u95fb\u5f71\u54cd\uff0c\u540e\u7eed\u7531\u65b0\u95fb\u548c\u516c\u544a\u670d\u52a1\u81ea\u52a8\u66f4\u65b0\u3002",
    capitalFlow: `\u6210\u4ea4\u989d ${stock.amount ?? UNKNOWN}\uff0c\u6210\u4ea4\u91cf ${stock.volume ?? UNKNOWN}\uff0c\u8d44\u91d1\u60c5\u51b5\u4ec5\u4f5c\u89c2\u5bdf\u3002`,
    technicalTrend: `\u6da8\u8dcc\u5e45 ${stock.changePercent ?? UNKNOWN}\uff0c\u6362\u624b\u7387 ${stock.turnoverRate ?? UNKNOWN}\uff0c\u77ed\u7ebf\u9700\u89c2\u5bdf\u91cf\u4ef7\u914d\u5408\u3002`,
    risks: stock.riskTips ?? defaultRiskTips,
    aiScore: scoreStock(stock),
    summary: "\u5f53\u524d\u5b9a\u4f4d\u4e3a\u673a\u4f1a\u89c2\u5bdf\u548c\u98ce\u9669\u8ddf\u8e2a\uff0c\u4e0d\u8f93\u51fa\u660e\u786e\u4e70\u5165\u3001\u5356\u51fa\u6216\u4fdd\u8bc1\u4e0a\u6da8\u7ed3\u8bba\u3002",
  };
}

function buildSearchResult(data, source, status, query, message = "") {
  const list = sortStockMatches(dedupeStocks(data).map(enrichResearchFields), query);
  return { ok: true, source, status, updatedAt: nowText(), message: list.length ? message : `\u672a\u627e\u5230\u5339\u914d\u6807\u7684\uff1a${query}`, data: list };
}

function matchFallbackStocks(keyword) {
  const upper = keyword.toUpperCase();
  return fallbackStocks.filter((stock) => stock.code.includes(keyword)
    || String(stock.name ?? "").includes(keyword)
    || String(stock.shortName ?? "").includes(keyword)
    || String(stock.pinyin ?? "").toUpperCase().includes(upper)
    || (stock.aliases ?? []).some((alias) => String(alias).toUpperCase().includes(upper) || String(alias).includes(keyword)));
}

function sortStockMatches(stocks, query) {
  const keyword = normalizeQuery(query);
  if (!keyword) return stocks;
  const upper = keyword.toUpperCase();
  return [...stocks].sort((a, b) => scoreStockMatch(b, keyword, upper) - scoreStockMatch(a, keyword, upper));
}

function scoreStockMatch(stock, keyword, upper) {
  const code = String(stock.code ?? "");
  const name = String(stock.name ?? "");
  const shortName = String(stock.shortName ?? "");
  const pinyin = String(stock.pinyin ?? "").toUpperCase();
  const aliases = (stock.aliases ?? []).map((alias) => String(alias));
  let score = 0;
  if (code === keyword) score += 1200;
  else if (code.startsWith(keyword)) score += 700;
  else if (code.includes(keyword)) score += 250;
  if (name === keyword || shortName === keyword) score += 1000;
  else if (name.startsWith(keyword) || shortName.startsWith(keyword)) score += 650;
  else if (name.includes(keyword) || shortName.includes(keyword)) score += 250;
  if (pinyin === upper) score += 950;
  else if (pinyin.startsWith(upper)) score += 550;
  else if (pinyin.includes(upper)) score += 120;
  for (const alias of aliases) {
    const aliasUpper = alias.toUpperCase();
    if (aliasUpper === upper || alias === keyword) score += 900;
    else if (aliasUpper.startsWith(upper) || alias.startsWith(keyword)) score += 500;
    else if (aliasUpper.includes(upper) || alias.includes(keyword)) score += 100;
  }
  if ((stock.assetType === "ETF" || isEtfCode(code)) && /ETF$/i.test(upper)) score += 300;
  if (name.includes("指数") && !name.includes("ETF")) score -= 350;
  return score;
}

function buildFallbackStock(stock) {
  return enrichResearchFields({
    ...pickReferenceMetadata(stock),
    assetType: stock.assetType ?? "\u80a1\u7968",
    dataSource: SOURCE_MOCK,
    quoteSource: SOURCE_MOCK,
    dataStatus: STATUS_MOCK,
    dataMessage: "\u4ec5\u4f5c\u8bc1\u5238\u5339\u914d\u5143\u6570\u636e\uff0c\u4e0d\u5305\u542b\u884c\u60c5",
    updatedAt: nowText(),
  });
}

function toUnavailableSecurity(stock, reason = "\u771f\u5b9e\u884c\u60c5\u63a5\u53e3\u672a\u8fd4\u56de") {
  return enrichResearchFields({
    ...pickReferenceMetadata(stock),
    code: stock.code,
    name: stock.name,
    assetType: stock.assetType,
    market: stock.market,
    industry: stock.industry,
    price: UNKNOWN,
    changePercent: UNKNOWN,
    amount: UNKNOWN,
    volume: UNKNOWN,
    turnoverRate: stock.assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN,
    marketCap: UNKNOWN,
    pe: stock.assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN,
    pb: stock.assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN,
    dataSource: "\u771f\u5b9e\u884c\u60c5\u83b7\u53d6\u5931\u8d25",
    quoteSource: "\u771f\u5b9e\u884c\u60c5\u83b7\u53d6\u5931\u8d25",
    dataStatus: STATUS_MOCK,
    dataMessage: reason,
    updatedAt: nowText(),
  });
}

function buildEtf(stock) {
  return buildFallbackStock({
    ...stock,
    assetType: "ETF",
    market: inferMarket(stock.code),
    price: stock.price,
    changePercent: stock.changePercent,
    pe: "\u4e0d\u9002\u7528",
    pb: "\u4e0d\u9002\u7528",
    companyName: stock.name,
    listingDate: stock.listingDate ?? UNKNOWN,
    inceptionDate: stock.inceptionDate ?? UNKNOWN,
    fundManager: stock.fundManager ?? UNKNOWN,
    fundScale: stock.fundScale ?? UNKNOWN,
    components: stock.components ?? [],
    capitalFlow: stock.capitalFlow ?? "\u8d44\u91d1\u6d41\u5411\u7531\u884c\u60c5\u6210\u4ea4\u6570\u636e\u8f85\u52a9\u89c2\u5bdf",
    valuationLevel: stock.valuationLevel ?? "\u9700\u7ed3\u5408\u8ddf\u8e2a\u6307\u6570\u4f30\u503c\u89c2\u5bdf",
  });
}

function dedupeStocks(stocks) {
  const seen = new Set();
  return stocks.filter((stock) => {
    if (!stock?.code || seen.has(stock.code)) return false;
    seen.add(stock.code);
    return true;
  });
}

function normalizeQuery(query) {
  return String(query ?? "").trim();
}

function isSupportedSecurityCode(code) {
  const text = String(code ?? "");
  return /^(?:60[0135]\d{3}|688\d{3}|00[0123]\d{3}|30[01]\d{3}|8\d{5}|920\d{3}|5\d{5}|1[56]\d{4})$/.test(text);
}

function toSecid(code, market) {
  const text = String(code ?? "");
  if (text.startsWith("8") || text.startsWith("920")) return `0.${text}`;
  if (String(market) === "1" || text.startsWith("6") || text.startsWith("5")) return `1.${text}`;
  return `0.${text}`;
}

function quoteMarketPrefix(code) {
  const text = String(code ?? "");
  if (text.startsWith("6") || text.startsWith("5")) return "sh";
  if (text.startsWith("8") || text.startsWith("920")) return "bj";
  return "sz";
}

function inferMarket(code) {
  const text = String(code ?? "");
  if (isEtfCode(text)) return text.startsWith("5") ? "\u6caa\u5e02ETF" : "\u6df1\u5e02ETF";
  if (text.startsWith("688") || text.startsWith("689")) return "\u79d1\u521b\u677f";
  if (text.startsWith("300") || text.startsWith("301")) return "\u521b\u4e1a\u677f";
  if (text.startsWith("8") || text.startsWith("920")) return "\u5317\u4ea4\u6240";
  if (text.startsWith("6")) return "\u6caa\u5e02";
  if (text.startsWith("0") || text.startsWith("2") || text.startsWith("3")) return "\u6df1\u5e02";
  return UNKNOWN;
}

function isEtfCode(code) {
  return /^(?:5\d{5}|1[56]\d{4})$/.test(String(code ?? ""));
}

function inferIndustryByCode(code) {
  const text = String(code ?? "");
  if (isEtfCode(text)) return getEtfKnowledge(text)?.industry || "ETF";
  return INDUSTRY_MISSING;
}

function normalizeIndustry(value, isEtf = false) {
  const text = String(value ?? "").trim();
  if (isEtf) return text && text !== UNKNOWN ? text : "ETF";
  if (!text || text === UNKNOWN || BOARD_LABELS.has(text)) return INDUSTRY_MISSING;
  return text;
}

function normalizeQuoteCode(code) {
  const text = String(code ?? "");
  return BSE_CODE_MAP[text] ?? text;
}

function restoreInputCode(quote, stock = {}) {
  const inputCode = String(stock.code ?? quote.code ?? "");
  if (!inputCode || inputCode === quote.code) return quote;
  return {
    ...quote,
    code: inputCode,
    quoteCode: quote.code,
    dataMessage: [quote.dataMessage, `北交所行情使用新代码 ${quote.code} 映射`].filter(Boolean).join("；"),
  };
}

function withTimeout(promise, timeoutMs, fallbackFactory) {
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      try {
        resolve(fallbackFactory());
      } catch (error) {
        reject(error);
      }
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function fetchJson(url) {
  const targets = buildEastmoneyUrls(url);
  let lastError;
  for (const target of targets) {
    const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch(target, { cache: "no-store", signal: controller.signal, headers: { Referer: "https://quote.eastmoney.com/" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function buildEastmoneyUrls(url) {
  const urls = [url];
  if (url.includes("https://push2.eastmoney.com")) {
    urls.push(url.replace("https://push2.eastmoney.com", "https://push2his.eastmoney.com"));
    urls.push(url.replace("https://push2.eastmoney.com", "http://push2.eastmoney.com"));
  }
  if (url.includes("https://searchapi.eastmoney.com")) {
    urls.push(url.replace("https://searchapi.eastmoney.com", "http://searchapi.eastmoney.com"));
  }
  if (url.includes("https://np-anotice-stock.eastmoney.com")) {
    urls.push(url.replace("https://np-anotice-stock.eastmoney.com", "http://np-anotice-stock.eastmoney.com"));
  }
  if (url.includes("https://datacenter.eastmoney.com")) {
    urls.push(url.replace("https://datacenter.eastmoney.com", "http://datacenter.eastmoney.com"));
  }
  return [...new Set(urls)];
}

function classifyAnnouncement(title) {
  if (/业绩|年报|季报|半年报|财报|预告/.test(title)) return "\u8d22\u62a5";
  if (/增持|减持|股东/.test(title)) return "\u80a1\u4e1c\u53d8\u5316";
  if (/回购/.test(title)) return "\u56de\u8d2d";
  if (/重大|重组|投资|合同|中标|政策/.test(title)) return "\u91cd\u5927\u4e8b\u9879";
  return "\u516c\u544a";
}

function classifyImpact(title) {
  if (/增长|预增|回购|中标|签订|增持|盈利|突破/.test(title)) return "\u5229\u597d";
  if (/下降|预减|亏损|减持|处罚|诉讼|终止|风险/.test(title)) return "\u5229\u7a7a";
  return "\u4e2d\u6027";
}

function analyzeAnnouncementImpact(title, code) {
  const type = classifyAnnouncement(title);
  const direction = classifyImpact(title);
  const impactMap = {
    "\u5229\u597d": "\u53ef\u80fd\u6539\u5584\u5e02\u573a\u5bf9\u516c\u53f8\u57fa\u672c\u9762\u6216\u80a1\u4e1c\u56de\u62a5\u7684\u9884\u671f\uff0c\u9700\u7ee7\u7eed\u770b\u6570\u636e\u843d\u5730\u3002",
    "\u5229\u7a7a": "\u53ef\u80fd\u5bf9\u77ed\u671f\u60c5\u7eea\u3001\u4f30\u503c\u6216\u7ecf\u8425\u9884\u671f\u5f62\u6210\u538b\u529b\uff0c\u9700\u91cd\u70b9\u590d\u6838\u516c\u544a\u539f\u6587\u3002",
    "\u4e2d\u6027": "\u6682\u65f6\u66f4\u504f\u4fe1\u606f\u62ab\u9732\u6216\u5e38\u89c4\u4e8b\u9879\uff0c\u9700\u7ed3\u5408\u540e\u7eed\u884c\u60c5\u548c\u57fa\u672c\u9762\u9a8c\u8bc1\u3002",
  };
  return {
    event: `${type}\uff1a${title}`,
    impact: impactMap[direction],
    direction,
    risk: "\u9700\u5173\u6ce8\u516c\u544a\u539f\u6587\u3001\u8d22\u52a1\u6307\u6807\u53d8\u5316\u3001\u5e02\u573a\u662f\u5426\u5df2\u7ecf\u5145\u5206\u53cd\u6620\u9884\u671f\u3002",
    relatedStock: code,
    confidence: "\u4e2d",
  };
}

function toFinanceSecuCode(code) {
  return `${code}.${String(code).startsWith("6") ? "SH" : "SZ"}`;
}

function scoreStock(stock) {
  let score = 60;
  if (stock.dataStatus === STATUS_REAL) score += 10;
  if (stock.dataStatus === STATUS_PARTIAL) score += 6;
  if (stock.pe && ![UNKNOWN, "\u4e0d\u9002\u7528"].includes(stock.pe)) score += 8;
  if (stock.pb && ![UNKNOWN, "\u4e0d\u9002\u7528"].includes(stock.pb)) score += 6;
  if (String(stock.changePercent ?? "").startsWith("+")) score += 4;
  if (stock.assetType === "ETF") score += 3;
  return Math.min(90, score);
}

function buildValuationStatus(pe) {
  const number = normalizeNumber(pe);
  if (!number) return "\u5f85\u89c2\u5bdf";
  if (number < 20) return "\u504f\u4f4e";
  if (number < 45) return "\u4e2d\u6027";
  return "\u504f\u9ad8";
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  const number = normalizeNumber(value);
  return number ? number.toFixed(2) : "\u6682\u65e0";
}

function formatPercent(value) {
  const number = normalizeNumber(value);
  return Number.isFinite(number) ? `${number >= 0 ? "+" : ""}${number.toFixed(2)}%` : "\u6682\u65e0";
}

function formatMetric(value) {
  const number = normalizeNumber(value);
  return number ? number.toFixed(2) : UNKNOWN;
}

function formatVolume(value) {
  const number = normalizeNumber(value);
  if (number >= 10000) return `${(number / 10000).toFixed(2)}\u4e07\u624b`;
  return number ? `${Math.round(number)}\u624b` : "\u6682\u65e0";
}

function formatAmount(value) {
  const number = normalizeNumber(value);
  if (number >= 1_0000_0000_0000) return `${(number / 1_0000_0000_0000).toFixed(2)}\u4e07\u4ebf`;
  if (number >= 1_0000_0000) return `${(number / 1_0000_0000).toFixed(2)}\u4ebf`;
  if (number >= 10000) return `${(number / 10000).toFixed(2)}\u4e07`;
  return number ? String(Math.round(number)) : "\u6682\u65e0";
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
