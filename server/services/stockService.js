const eastmoneyQuoteApi = "https://push2.eastmoney.com/api/qt/ulist.np/get";
const eastmoneySearchApi = "https://searchapi.eastmoney.com/api/suggest/get";
const eastmoneyNoticeApi = "https://np-anotice-stock.eastmoney.com/api/security/ann";
const eastmoneyFinanceApi = "https://datacenter.eastmoney.com/securities/api/data/v1/get";

const SOURCE_EASTMONEY = "\u4e1c\u65b9\u8d22\u5bcc";
const SOURCE_MOCK = "\u6a21\u62df\u6570\u636e";
const STATUS_REAL = "\u771f\u5b9e\u6570\u636e";
const STATUS_PARTIAL = "\u90e8\u5206\u771f\u5b9e";
const STATUS_MOCK = "\u6a21\u62df\u6570\u636e";
const UNKNOWN = "\u5f85\u8865\u5145";

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
  buildFallbackStock({ code: "300750", name: "\u5b81\u5fb7\u65f6\u4ee3", pinyin: "NDSD", shortName: "\u5b81\u5fb7", industry: "\u7535\u6c60", market: "\u521b\u4e1a\u677f", price: "214.20", changePercent: "+1.36%", amount: "96.10\u4ebf", volume: "45.2\u4e07\u624b", turnoverRate: "1.08%", marketCap: "9420\u4ebf", pe: "22.4", pb: "4.7", listingDate: "2018-06-11", companyName: "\u5b81\u5fb7\u65f6\u4ee3\u65b0\u80fd\u6e90\u79d1\u6280\u80a1\u4efd\u6709\u9650\u516c\u53f8", industryPosition: "\u5168\u7403\u52a8\u529b\u7535\u6c60\u9f99\u5934\u3002" }),
  buildFallbackStock({ code: "301396", name: "\u5b8f\u666f\u79d1\u6280", pinyin: "HJKJ", shortName: "\u5b8f\u666f", industry: "\u8f6f\u4ef6\u670d\u52a1", market: "\u521b\u4e1a\u677f", price: "28.64", changePercent: "-0.74%", amount: "3.20\u4ebf", volume: "11.3\u4e07\u624b", turnoverRate: "5.72%", marketCap: "31.2\u4ebf", pe: "68.5", pb: "3.6", listingDate: "2022-11-11", companyName: "\u5b8f\u666f\u79d1\u6280\u80a1\u4efd\u6709\u9650\u516c\u53f8", industryPosition: "\u667a\u6167\u57ce\u5e02\u548c\u6570\u5b57\u5316\u5e94\u7528\u5c0f\u5e02\u503c\u516c\u53f8\u3002" }),
  buildFallbackStock({ code: "688981", name: "\u4e2d\u82af\u56fd\u9645", pinyin: "ZXGJ", shortName: "\u4e2d\u82af", industry: "\u534a\u5bfc\u4f53", market: "\u79d1\u521b\u677f", price: "58.73", changePercent: "+2.18%", amount: "67.80\u4ebf", volume: "113.8\u4e07\u624b", turnoverRate: "1.46%", marketCap: "4680\u4ebf", pe: "86.2", pb: "3.1", listingDate: "2020-07-16", companyName: "\u4e2d\u82af\u56fd\u9645\u96c6\u6210\u7535\u8def\u5236\u9020\u6709\u9650\u516c\u53f8", industryPosition: "\u56fd\u5185\u6676\u5706\u4ee3\u5de5\u9f99\u5934\u3002" }),
  buildEtf({ code: "512760", name: "\u82af\u7247ETF", pinyin: "XPETF", aliases: ["AI", "\u82af\u7247", "\u534a\u5bfc\u4f53", "CHIP"], industry: "\u534a\u5bfc\u4f53ETF", trackingIndex: "\u534a\u5bfc\u4f53\u82af\u7247\u884c\u4e1a\u6307\u6570" }),
  buildEtf({ code: "159819", name: "\u4eba\u5de5\u667a\u80fdETF", pinyin: "RGETF", aliases: ["AI", "AIETF", "\u4eba\u5de5\u667a\u80fd", "\u7b97\u529b"], industry: "AI\u4e3b\u9898ETF", trackingIndex: "\u4eba\u5de5\u667a\u80fd\u4e3b\u9898\u6307\u6570" }),
  buildEtf({ code: "512480", name: "\u534a\u5bfc\u4f53ETF", pinyin: "BDTETF", aliases: ["\u534a\u5bfc\u4f53", "\u82af\u7247"], industry: "\u534a\u5bfc\u4f53ETF", trackingIndex: "\u534a\u5bfc\u4f53\u82af\u7247\u6307\u6570" }),
  buildEtf({ code: "515880", name: "\u901a\u4fe1ETF", pinyin: "TXETF", aliases: ["\u901a\u4fe1", "5G"], industry: "\u901a\u4fe1ETF", trackingIndex: "\u901a\u4fe1\u8bbe\u5907\u6307\u6570" }),
  buildEtf({ code: "588000", name: "\u79d1\u521b50ETF", pinyin: "KCETF", aliases: ["\u79d1\u521b", "\u79d1\u521b50"], industry: "\u79d1\u521bETF", trackingIndex: "\u79d1\u521b50\u6307\u6570" }),
  buildEtf({ code: "510300", name: "\u6caa\u6df1300ETF", pinyin: "HS300ETF", aliases: ["\u6caa\u6df1300", "300ETF"], industry: "\u5bbd\u57faETF", trackingIndex: "\u6caa\u6df1300\u6307\u6570" }),
  buildEtf({ code: "510500", name: "\u4e2d\u8bc1500ETF", pinyin: "ZZ500ETF", aliases: ["\u4e2d\u8bc1500", "500ETF"], industry: "\u5bbd\u57faETF", trackingIndex: "\u4e2d\u8bc1500\u6307\u6570" }),
  buildEtf({ code: "513100", name: "\u7eb3\u6307ETF", pinyin: "NZETF", aliases: ["\u7eb3\u6307", "NASDAQ", "\u7f8e\u80a1"], industry: "\u8de8\u5883ETF", trackingIndex: "\u7eb3\u65af\u8fbe\u514b100\u6307\u6570" }),
];

export async function searchStockCandidates(query) {
  const keyword = normalizeQuery(query);
  if (!keyword) return buildSearchResult(fallbackStocks, SOURCE_MOCK, STATUS_MOCK, keyword);

  const fallbackMatches = matchFallbackStocks(keyword);
  try {
    const remote = /^\d{6}$/.test(keyword)
      ? [{ code: keyword, secid: toSecid(keyword) }]
      : await searchEastmoney(keyword);
    const quoted = await Promise.all(remote.slice(0, 12).map((stock) => fetchQuote(stock).catch(() => stock)));
    const combined = dedupeStocks([...quoted, ...fallbackMatches]).map((stock) => enrichResearchFields(mergeKnown(stock)));
    const hasReal = combined.some((item) => item.dataStatus === STATUS_REAL);
    return buildSearchResult(combined, hasReal ? SOURCE_EASTMONEY : SOURCE_MOCK, hasReal ? STATUS_PARTIAL : STATUS_MOCK, keyword);
  } catch (error) {
    return buildSearchResult(fallbackMatches, SOURCE_MOCK, STATUS_MOCK, keyword, error.message);
  }
}

export async function getStockDetail(query) {
  const result = await searchStockCandidates(query);
  const stock = result.data[0];
  if (!stock) {
    return { ok: false, message: `\u672a\u627e\u5230\u5339\u914d\u6807\u7684\uff1a${query}`, source: result.source, status: result.status, updatedAt: result.updatedAt, data: null };
  }

  const [announcements, financials] = await Promise.all([
    fetchAnnouncements(stock.code).catch(() => []),
    fetchFinancials(stock).catch(() => buildUnavailableFinancials(stock)),
  ]);
  const detail = enrichResearchFields({
    ...stock,
    announcements,
    financials,
    dataSource: announcements.length ? `${stock.dataSource || SOURCE_EASTMONEY} / \u4e1c\u65b9\u8d22\u5bcc\u516c\u544a` : stock.dataSource,
    dataStatus: stock.dataStatus === STATUS_REAL && (announcements.length || financials.status === STATUS_REAL) ? STATUS_REAL : stock.dataStatus,
  });
  return { ok: true, source: detail.dataSource, status: detail.dataStatus, updatedAt: detail.updatedAt, data: detail };
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
  const fields = "f12,f14,f2,f3,f4,f5,f6,f8,f20,f100,f162,f167";
  const url = `${eastmoneyQuoteApi}?fltt=2&fields=${fields}&secids=${stock.secid ?? toSecid(stock.code, stock.market)}`;
  const json = await fetchJson(url);
  const row = json?.data?.diff?.[0];
  if (!row) throw new Error("\u884c\u60c5\u4e3a\u7a7a");
  const code = row.f12 || stock.code;
  const assetType = isEtfCode(code) ? "ETF" : "\u80a1\u7968";
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
    industry: row.f100 || stock.industry || (assetType === "ETF" ? "ETF" : UNKNOWN),
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
  return { ...(known ?? {}), ...stock };
}

function enrichResearchFields(stock) {
  const code = stock.code ?? "";
  const name = stock.name ?? stock.stockName ?? code;
  const assetType = stock.assetType ?? (isEtfCode(code) ? "ETF" : "\u80a1\u7968");
  const industry = stock.industry ?? (assetType === "ETF" ? "ETF" : UNKNOWN);
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
    price: stock.price ?? "\u6682\u65e0",
    changePercent: stock.changePercent ?? "\u6682\u65e0",
    changeAmount: stock.changeAmount ?? "\u6682\u65e0",
    amount: stock.amount ?? "\u6682\u65e0",
    volume: stock.volume ?? "\u6682\u65e0",
    turnoverRate: stock.turnoverRate ?? "\u6682\u65e0",
    marketCap: stock.marketCap ?? "\u6682\u65e0",
    pe: stock.pe ?? (assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN),
    pb: stock.pb ?? (assetType === "ETF" ? "\u4e0d\u9002\u7528" : UNKNOWN),
    valuationStatus: stock.valuationStatus ?? "\u5f85\u89c2\u5bdf",
    dataSource: stock.dataSource ?? SOURCE_MOCK,
    quoteSource: stock.quoteSource ?? stock.dataSource ?? SOURCE_MOCK,
    dataStatus: stock.dataStatus ?? STATUS_MOCK,
    updatedAt: stock.updatedAt ?? nowText(),
    profile: stock.profile ?? `${name}\u7684\u57fa\u7840\u8d44\u6599\u6765\u81ea\u884c\u60c5\u63a5\u53e3\u548c\u672c\u5730\u7814\u7a76\u5e93\uff0c\u540e\u7eed\u53ef\u63a5\u5165\u5b8c\u6574\u5e74\u62a5\u548c\u884c\u4e1a\u6570\u636e\u6821\u9a8c\u3002`,
    mainBusiness: stock.mainBusiness ?? (assetType === "ETF" ? `\u8ddf\u8e2a${stock.trackingIndex ?? "\u76f8\u5173\u6307\u6570"}` : `${industry}\u76f8\u5173\u4e1a\u52a1\uff0c\u9700\u7ed3\u5408\u5e74\u62a5\u548c\u516c\u544a\u7ee7\u7eed\u9a8c\u8bc1\u3002`),
    industryPosition: stock.industryPosition ?? `${industry}\u65b9\u5411\u9700\u7ed3\u5408\u666f\u6c14\u5ea6\u3001\u4f30\u503c\u548c\u8d44\u91d1\u6301\u7eed\u6027\u89c2\u5bdf\u3002`,
    financials: stock.financials ?? buildFinancials(stock),
    valuationRange: stock.valuationRange ?? { pe: "\u5386\u53f2PE\u5f85\u63a5\u5165", pb: "\u5386\u53f2PB\u5f85\u63a5\u5165" },
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
  const notAvailable = stock.assetType === "ETF" || isEtfCode(stock.code) ? "\u4e0d\u9002\u7528" : "\u6570\u636e\u6682\u4e0d\u53ef\u7528";
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
    newsImpact: (stock.announcements ?? []).length ? `\u6700\u65b0\u516c\u544a\uff1a${stock.announcements[0].title}\uff1b\u5f71\u54cd\uff1a${stock.announcements[0].analysis?.impact ?? stock.announcements[0].impact ?? "\u5f85\u89c2\u5bdf"}` : "\u6682\u65e0\u786e\u5b9a\u91cd\u5927\u65b0\u95fb\u5f71\u54cd\uff0c\u540e\u7eed\u7531\u65b0\u95fb\u548c\u516c\u544a\u670d\u52a1\u81ea\u52a8\u66f4\u65b0\u3002",
    capitalFlow: `\u6210\u4ea4\u989d ${stock.amount ?? "\u6682\u65e0"}\uff0c\u6210\u4ea4\u91cf ${stock.volume ?? "\u6682\u65e0"}\uff0c\u8d44\u91d1\u60c5\u51b5\u4ec5\u4f5c\u89c2\u5bdf\u3002`,
    technicalTrend: `\u6da8\u8dcc\u5e45 ${stock.changePercent ?? "\u6682\u65e0"}\uff0c\u6362\u624b\u7387 ${stock.turnoverRate ?? "\u6682\u65e0"}\uff0c\u77ed\u7ebf\u9700\u89c2\u5bdf\u91cf\u4ef7\u914d\u5408\u3002`,
    risks: stock.riskTips ?? defaultRiskTips,
    aiScore: scoreStock(stock),
    summary: "\u5f53\u524d\u5b9a\u4f4d\u4e3a\u673a\u4f1a\u89c2\u5bdf\u548c\u98ce\u9669\u8ddf\u8e2a\uff0c\u4e0d\u8f93\u51fa\u660e\u786e\u4e70\u5165\u3001\u5356\u51fa\u6216\u4fdd\u8bc1\u4e0a\u6da8\u7ed3\u8bba\u3002",
  };
}

function buildSearchResult(data, source, status, query, message = "") {
  const list = dedupeStocks(data).map(enrichResearchFields);
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

function buildFallbackStock(stock) {
  return enrichResearchFields({ ...stock, assetType: stock.assetType ?? "\u80a1\u7968", dataSource: SOURCE_MOCK, quoteSource: SOURCE_MOCK, dataStatus: STATUS_MOCK, updatedAt: nowText() });
}

function buildEtf(stock) {
  return buildFallbackStock({ ...stock, assetType: "ETF", market: inferMarket(stock.code), price: stock.price ?? "1.000", changePercent: stock.changePercent ?? "+0.00%", pe: "\u4e0d\u9002\u7528", pb: "\u4e0d\u9002\u7528", companyName: stock.name, listingDate: stock.listingDate ?? UNKNOWN });
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

function toSecid(code, market) {
  const text = String(code ?? "");
  if (String(market) === "1" || text.startsWith("6") || text.startsWith("5")) return `1.${text}`;
  return `0.${text}`;
}

function inferMarket(code) {
  const text = String(code ?? "");
  if (isEtfCode(text)) return text.startsWith("5") ? "\u6caa\u5e02ETF" : "\u6df1\u5e02ETF";
  if (text.startsWith("688") || text.startsWith("689")) return "\u79d1\u521b\u677f";
  if (text.startsWith("300") || text.startsWith("301")) return "\u521b\u4e1a\u677f";
  if (text.startsWith("6")) return "\u6caa\u5e02";
  if (text.startsWith("0") || text.startsWith("2") || text.startsWith("3")) return "\u6df1\u5e02";
  return UNKNOWN;
}

function isEtfCode(code) {
  return /^(51|52|56|58|15|16)\d{4}$/.test(String(code ?? ""));
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Referer: "https://quote.eastmoney.com/" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
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
