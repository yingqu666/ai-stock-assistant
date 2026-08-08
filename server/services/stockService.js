const eastmoneyQuoteApi = "https://push2.eastmoney.com/api/qt";
const eastmoneySearchApi = "https://searchapi.eastmoney.com/api/suggest/get";

const defaultRiskTips = ["行情与估值数据可能存在延迟", "研究结论只用于机会观察和风险提示，不构成明确买卖建议"];

export const fallbackStocks = [
  buildFallbackStock({
    code: "600176",
    name: "中国巨石",
    pinyin: "ZGJS",
    shortName: "巨石",
    industry: "玻璃玻纤",
    market: "沪市",
    price: "11.36",
    changePercent: "+0.71%",
    amount: "5.82亿",
    volume: "51.4万手",
    turnoverRate: "1.18%",
    marketCap: "455亿",
    pe: "18.4",
    pb: "1.7",
    listingDate: "1999-04-22",
    companyName: "中国巨石股份有限公司",
    profile: "公司是国内玻纤龙头企业之一，产品覆盖玻璃纤维及制品，受益于风电、汽车轻量化、电子材料等需求变化。",
    mainBusiness: "玻璃纤维及制品的生产和销售。",
    industryPosition: "玻纤行业龙头，成本控制和规模优势突出。",
    financials: { revenue: "约150亿", netProfit: "约25亿", grossMargin: "25%-35%", roe: "10%+" },
    valuationRange: { pe: "10-30倍", pb: "1-4倍" },
    valuationStatus: "中性偏低",
    hotspotRelation: "风电材料、出口链、周期修复",
  }),
  buildFallbackStock({
    code: "600519",
    name: "贵州茅台",
    pinyin: "GZMT",
    shortName: "茅台",
    industry: "白酒",
    market: "沪市",
    price: "1688.50",
    changePercent: "+0.82%",
    amount: "82.40亿",
    volume: "4.9万手",
    turnoverRate: "0.39%",
    marketCap: "2.12万亿",
    pe: "28.6",
    pb: "9.8",
    listingDate: "2001-08-27",
    companyName: "贵州茅台酒股份有限公司",
    profile: "公司是高端白酒龙头，品牌壁垒强，现金流质量高。",
    mainBusiness: "茅台酒及系列酒的生产与销售。",
    industryPosition: "高端白酒核心龙头，品牌力和渠道议价能力突出。",
    financials: { revenue: "约1500亿", netProfit: "约800亿", grossMargin: "90%+", roe: "30%+" },
    valuationRange: { pe: "20-45倍", pb: "7-15倍" },
    valuationStatus: "中性",
    hotspotRelation: "消费复苏、红利资产",
  }),
  buildFallbackStock({
    code: "300750",
    name: "宁德时代",
    pinyin: "NDSD",
    shortName: "宁德",
    industry: "电池",
    market: "创业板",
    price: "214.20",
    changePercent: "+1.36%",
    amount: "96.10亿",
    volume: "45.2万手",
    turnoverRate: "1.08%",
    marketCap: "9420亿",
    pe: "22.4",
    pb: "4.7",
    listingDate: "2018-06-11",
    companyName: "宁德时代新能源科技股份有限公司",
    profile: "公司是全球动力电池龙头，储能业务提供新的增长方向。",
    mainBusiness: "动力电池、储能电池和相关系统解决方案。",
    industryPosition: "全球动力电池龙头，技术、产能和客户资源领先。",
    financials: { revenue: "约4000亿", netProfit: "约400亿", grossMargin: "20%+", roe: "20%+" },
    valuationRange: { pe: "18-60倍", pb: "4-12倍" },
    valuationStatus: "中性",
    hotspotRelation: "新能源车、储能、电力设备",
  }),
  buildFallbackStock({
    code: "301396",
    name: "宏景科技",
    pinyin: "HJKJ",
    shortName: "宏景",
    industry: "软件服务",
    market: "创业板",
    price: "28.64",
    changePercent: "-0.74%",
    amount: "3.20亿",
    volume: "11.3万手",
    turnoverRate: "5.72%",
    marketCap: "31.2亿",
    pe: "68.5",
    pb: "3.6",
    listingDate: "2022-11-11",
    companyName: "宏景科技股份有限公司",
    profile: "公司主要面向智慧城市、智慧园区等数字化场景提供解决方案。",
    mainBusiness: "智慧城市、智慧园区和数字化应用解决方案。",
    industryPosition: "小市值软件服务公司，弹性较强但业绩验证要求高。",
    financials: { revenue: "待接财报", netProfit: "待接财报", grossMargin: "待接财报", roe: "待接财报" },
    valuationRange: { pe: "亏损/高波动", pb: "2-8倍" },
    valuationStatus: "偏高波动",
    hotspotRelation: "数字经济、AI应用、智慧城市",
  }),
  buildFallbackStock({
    code: "688981",
    name: "中芯国际",
    pinyin: "ZXGJ",
    shortName: "中芯",
    industry: "半导体",
    market: "科创板",
    price: "58.73",
    changePercent: "+2.18%",
    amount: "67.80亿",
    volume: "113.8万手",
    turnoverRate: "1.46%",
    marketCap: "4680亿",
    pe: "86.2",
    pb: "3.1",
    listingDate: "2020-07-16",
    companyName: "中芯国际集成电路制造有限公司",
    profile: "公司是国内晶圆代工龙头，受益于半导体国产替代趋势。",
    mainBusiness: "集成电路晶圆代工及相关技术服务。",
    industryPosition: "国内晶圆代工龙头，国产替代主线核心公司之一。",
    financials: { revenue: "约450亿", netProfit: "周期波动", grossMargin: "15%-25%", roe: "中低个位数" },
    valuationRange: { pe: "40-120倍", pb: "2-6倍" },
    valuationStatus: "偏高",
    hotspotRelation: "国产替代、半导体设备材料",
  }),
  buildEtf({ code: "512760", name: "芯片ETF", pinyin: "XPETF", aliases: ["芯片", "半导体", "芯片ETF", "CHIP"], industry: "半导体ETF", trackingIndex: "中华交易服务半导体芯片行业指数" }),
  buildEtf({ code: "159819", name: "人工智能ETF", pinyin: "RGETF", aliases: ["AI", "AIETF", "人工智能", "算力"], industry: "AI主题ETF", trackingIndex: "中证人工智能主题指数" }),
  buildEtf({ code: "512480", name: "半导体ETF", pinyin: "BDTETF", aliases: ["半导体", "半导体ETF", "芯片"], industry: "半导体ETF", trackingIndex: "国证半导体芯片指数" }),
  buildEtf({ code: "515880", name: "通信ETF", pinyin: "TXETF", aliases: ["通信", "5G", "通信ETF"], industry: "通信ETF", trackingIndex: "中证全指通信设备指数" }),
  buildEtf({ code: "588000", name: "科创50ETF", pinyin: "KCETF", aliases: ["科创", "科创ETF", "科创50"], industry: "科创ETF", trackingIndex: "上证科创板50成份指数" }),
  buildEtf({ code: "510300", name: "沪深300ETF", pinyin: "HS300ETF", aliases: ["沪深300", "300ETF", "宽基"], industry: "宽基ETF", trackingIndex: "沪深300指数" }),
  buildEtf({ code: "510500", name: "中证500ETF", pinyin: "ZZ500ETF", aliases: ["中证500", "500ETF", "宽基"], industry: "宽基ETF", trackingIndex: "中证500指数" }),
  buildEtf({ code: "513100", name: "纳指ETF", pinyin: "NZETF", aliases: ["纳指", "纳斯达克", "NASDAQ", "美股"], industry: "跨境ETF", trackingIndex: "纳斯达克100指数" }),
];

export async function searchStockCandidates(query) {
  const keyword = normalizeQuery(query);
  if (!keyword) return { data: fallbackStocks, source: "模拟数据", status: "模拟数据", message: "" };

  const fallbackMatches = matchFallbackStocks(keyword);
  if (/^\d{6}$/.test(keyword)) {
    const fallback = fallbackMatches[0];
    const stock = await fetchStockQuote({ code: keyword, name: fallback?.name ?? keyword, secid: toSecid(keyword) }).catch(() => null);
    return buildSearchResult(stock ? [mergeStock(stock, fallback)] : fallbackMatches, stock ? "东方财富" : "模拟数据", stock ? "真实数据" : "模拟数据", keyword);
  }

  try {
    const remote = await searchEastmoney(keyword);
    const quoted = await Promise.all(remote.slice(0, 8).map((stock) => fetchStockQuote(stock).catch(() => stock)));
    const combined = dedupeStocks([...quoted.map((stock) => mergeStock(stock, fallbackStocks.find((item) => item.code === stock.code))), ...fallbackMatches]);
    return buildSearchResult(combined, "东方财富", combined.some((item) => item.dataStatus === "真实数据") ? "部分真实" : "模拟数据", keyword);
  } catch (error) {
    return buildSearchResult(fallbackMatches, "模拟数据", "模拟数据", keyword, error.message);
  }
}

export async function getStockDetail(query) {
  const result = await searchStockCandidates(query);
  const stock = result.data[0];
  if (!stock) {
    return { ok: false, message: `未找到匹配标的：${query}`, source: result.source, status: result.status, updatedAt: result.updatedAt, data: null };
  }
  return { ok: true, source: result.source, status: result.status, updatedAt: result.updatedAt, data: enrichResearchFields(stock) };
}

async function searchEastmoney(keyword) {
  const url = `${eastmoneySearchApi}?input=${encodeURIComponent(keyword)}&type=14&token=`;
  const response = await fetchWithTimeout(url);
  const json = await response.json();
  const rows = json?.QuotationCodeTable?.Data ?? json?.data ?? [];
  const stocks = rows
    .map((item) => ({ code: String(item.Code ?? item.code ?? ""), name: item.Name ?? item.name, market: item.MktNum ?? item.market }))
    .filter((item) => /^\d{6}$/.test(item.code))
    .map((item) => ({ ...item, secid: toSecid(item.code, item.market) }));
  if (!stocks.length) throw new Error("未找到远程匹配标的");
  return stocks;
}

async function fetchStockQuote(stock) {
  const fields = "f12,f14,f2,f3,f4,f5,f6,f8,f20,f100,f162,f167";
  const url = `${eastmoneyQuoteApi}/ulist.np/get?fltt=2&fields=${fields}&secids=${stock.secid ?? toSecid(stock.code, stock.market)}`;
  const response = await fetchWithTimeout(url);
  const json = await response.json();
  const row = json?.data?.diff?.[0];
  if (!row) throw new Error("股票行情为空");
  const code = row.f12 || stock.code;
  return {
    code,
    name: row.f14 || stock.name,
    price: formatPrice(row.f2),
    changePercent: formatPercent(row.f3),
    changeAmount: formatPrice(row.f4),
    volume: formatVolume(row.f5),
    amount: formatAmount(row.f6),
    turnoverRate: formatPercent(row.f8),
    marketCap: formatAmount(row.f20),
    industry: row.f100 || stock.industry || (isEtfCode(code) ? "ETF" : "待补充"),
    market: inferMarket(code),
    assetType: isEtfCode(code) ? "ETF" : "股票",
    pe: formatMetric(row.f162),
    pb: formatMetric(row.f167),
    valuationStatus: buildValuationStatus(row.f162),
    quoteSource: "东方财富",
    dataSource: "东方财富",
    dataStatus: "真实数据",
    updatedAt: nowText(),
  };
}

function mergeStock(stock, fallback) {
  return enrichResearchFields({ ...(fallback ?? {}), ...stock });
}

function enrichResearchFields(stock) {
  const name = stock.name ?? stock.stockName ?? "";
  const code = stock.code ?? stock.stockCode;
  const industry = stock.industry ?? "待补充";
  const assetType = stock.assetType ?? (isEtfCode(code) ? "ETF" : "股票");
  return {
    ...stock,
    name,
    code,
    pinyin: stock.pinyin ?? "",
    aliases: stock.aliases ?? [],
    assetType,
    market: stock.market ?? inferMarket(code),
    companyName: stock.companyName ?? name,
    listingDate: stock.listingDate ?? "待补充",
    marketCap: stock.marketCap ?? "待补充",
    pe: stock.pe ?? "待补充",
    pb: stock.pb ?? "待补充",
    volume: stock.volume ?? "待补充",
    turnoverRate: stock.turnoverRate ?? "待补充",
    valuationStatus: stock.valuationStatus ?? "待观察",
    dataSource: stock.dataSource ?? stock.quoteSource ?? "模拟数据",
    quoteSource: stock.quoteSource ?? stock.dataSource ?? "模拟数据",
    dataStatus: stock.dataStatus ?? "模拟数据",
    updatedAt: stock.updatedAt ?? nowText(),
    profile: stock.profile ?? `${name}基础资料来自公开行情和模拟研究库，后续可接入公告、财报与行业数据库校验。`,
    mainBusiness: stock.mainBusiness ?? (assetType === "ETF" ? `${name}主要跟踪相关指数，适合观察行业或宽基方向。` : `${industry}相关业务，后续可接入年报和公告进一步校验。`),
    industryPosition: stock.industryPosition ?? `${industry}方向需结合景气度、估值和资金持续性观察。`,
    financials: stock.financials ?? { revenue: "待接财报", netProfit: "待接财报", grossMargin: "待接财报", roe: "待接财报" },
    valuationRange: stock.valuationRange ?? { pe: "历史PE待接入", pb: "历史PB待接入" },
    researchReport: stock.researchReport ?? buildResearchReport(stock, industry, assetType),
    riskTips: stock.riskTips ?? defaultRiskTips,
  };
}

function buildResearchReport(stock, industry, assetType = "股票") {
  const name = stock.name ?? "";
  const isEtf = assetType === "ETF";
  return {
    company: isEtf ? `${name}为ETF品种，研究重点是跟踪指数、行业景气度、成分股结构和流动性。` : `${name}基础资料已纳入研究视图，仍需结合公告和财报验证。`,
    industry: `${industry}方向需观察政策、景气度、估值位置和资金持续性。`,
    moat: isEtf ? "ETF没有公司护城河，核心观察跟踪指数质量、费率、流动性和主题景气度。" : "核心竞争力需从主营业务、客户结构、盈利能力和研发投入持续验证。",
    hotspotRelation: stock.hotspotRelation ?? `${industry}与当前市场热点存在一定关联，需观察持续性。`,
    upFactors: stock.upsideFactors ?? ["行业政策或景气度改善", "成交活跃度提升", "相关主题资金关注"],
    downsideRisks: stock.downsideRisks ?? ["短期涨幅过高", "估值波动", "行业景气或政策预期变化"],
    moveReason: "最近涨跌需要结合指数、行业板块、新闻事件和成交量综合判断。",
    newsImpact: "暂无确定重大新闻影响，后续接入公告和新闻服务后自动更新。",
    capitalFlow: `成交额 ${stock.amount ?? "待补充"}，成交量 ${stock.volume ?? "待补充"}，资金情况仅作观察。`,
    technicalTrend: `涨跌幅 ${stock.changePercent ?? "待补充"}，换手率 ${stock.turnoverRate ?? "待补充"}，短线需观察量价配合。`,
    risks: stock.riskTips ?? defaultRiskTips,
    aiScore: scoreStock(stock),
    summary: "当前定位为机会观察和风险跟踪，不输出明确买入、卖出或保证上涨结论。",
  };
}

function buildSearchResult(data, source, status, query, message = "") {
  return { ok: true, source, status, updatedAt: nowText(), message: data.length ? message : `未找到匹配标的：${query}`, data };
}

function matchFallbackStocks(keyword) {
  const upper = keyword.toUpperCase();
  return fallbackStocks.filter((stock) => matchesStock(stock, keyword, upper));
}

function matchesStock(stock, keyword, upper = keyword.toUpperCase()) {
  const aliases = (stock.aliases ?? []).map((item) => String(item).toUpperCase());
  return stock.code.includes(keyword)
    || String(stock.name ?? "").includes(keyword)
    || String(stock.shortName ?? "").includes(keyword)
    || String(stock.pinyin ?? "").toUpperCase().includes(upper)
    || aliases.some((alias) => alias.includes(upper) || alias.includes(keyword));
}

function buildFallbackStock(stock) {
  return enrichResearchFields({ ...stock, assetType: stock.assetType ?? "股票", dataSource: "模拟数据", quoteSource: "模拟数据", dataStatus: "模拟数据", updatedAt: nowText() });
}

function buildEtf(stock) {
  return buildFallbackStock({
    ...stock,
    assetType: "ETF",
    market: stock.market ?? inferMarket(stock.code),
    price: stock.price ?? "1.000",
    changePercent: stock.changePercent ?? "+0.00%",
    amount: stock.amount ?? "待接行情",
    volume: stock.volume ?? "待接行情",
    turnoverRate: stock.turnoverRate ?? "待接行情",
    marketCap: stock.marketCap ?? "待接行情",
    pe: "不适用",
    pb: "不适用",
    listingDate: stock.listingDate ?? "待补充",
    companyName: stock.name,
    profile: `${stock.name}为交易型开放式指数基金，主要跟踪${stock.trackingIndex ?? "相关指数"}。`,
    mainBusiness: `跟踪${stock.trackingIndex ?? "相关指数"}，用于观察${stock.industry ?? "相关主题"}表现。`,
    industryPosition: "ETF研究重点是指数成分、主题景气度、成交流动性和折溢价风险。",
    financials: { revenue: "不适用", netProfit: "不适用", grossMargin: "不适用", roe: "不适用" },
    valuationRange: { pe: "ETF不适用", pb: "ETF不适用" },
    valuationStatus: "观察跟踪指数估值",
    riskTips: ["ETF会跟随指数波动", "主题ETF波动通常高于宽基ETF", "跨境ETF还需关注汇率、溢价和海外市场波动"],
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

function toSecid(code, market) {
  const text = String(code ?? "");
  if (String(market) === "1" || text.startsWith("6") || text.startsWith("5")) return `1.${text}`;
  return `0.${text}`;
}

function inferMarket(code) {
  const text = String(code ?? "");
  if (isEtfCode(text)) return text.startsWith("5") ? "沪市ETF" : "深市ETF";
  if (text.startsWith("688") || text.startsWith("689")) return "科创板";
  if (text.startsWith("300") || text.startsWith("301")) return "创业板";
  if (text.startsWith("6")) return "沪市";
  if (text.startsWith("0") || text.startsWith("2") || text.startsWith("3")) return "深市";
  return "待补充";
}

function isEtfCode(code) {
  const text = String(code ?? "");
  return /^(51|52|56|58|15|16)\d{4}$/.test(text);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function scoreStock(stock) {
  let score = 60;
  if (stock.dataStatus === "真实数据") score += 10;
  if (stock.pe && !["待补充", "不适用"].includes(stock.pe)) score += 8;
  if (stock.pb && !["待补充", "不适用"].includes(stock.pb)) score += 6;
  if (String(stock.changePercent ?? "").startsWith("+")) score += 4;
  if (stock.assetType === "ETF") score += 3;
  return Math.min(90, score);
}

function buildValuationStatus(pe) {
  const number = normalizeNumber(pe);
  if (!number) return "待观察";
  if (number < 20) return "偏低";
  if (number < 45) return "中性";
  return "偏高";
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  const number = normalizeNumber(value);
  return number ? number.toFixed(2) : "暂无";
}

function formatPercent(value) {
  const number = normalizeNumber(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatMetric(value) {
  const number = normalizeNumber(value);
  return number ? number.toFixed(2) : "待补充";
}

function formatVolume(value) {
  const number = normalizeNumber(value);
  if (number >= 10000) return `${(number / 10000).toFixed(2)}万手`;
  return number ? `${Math.round(number)}手` : "暂无";
}

function formatAmount(value) {
  const number = normalizeNumber(value);
  if (number >= 1_0000_0000_0000) return `${(number / 1_0000_0000_0000).toFixed(2)}万亿`;
  if (number >= 1_0000_0000) return `${(number / 1_0000_0000).toFixed(2)}亿`;
  if (number >= 10000) return `${(number / 10000).toFixed(2)}万`;
  return number ? String(Math.round(number)) : "暂无";
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
