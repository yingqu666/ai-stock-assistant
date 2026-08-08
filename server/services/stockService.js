const eastmoneyQuoteApi = "https://push2.eastmoney.com/api/qt";
const eastmoneySearchApi = "https://searchapi.eastmoney.com/api/suggest/get";

export const fallbackStocks = [
  buildFallbackStock({ code: "600519", name: "贵州茅台", pinyin: "GZMT", industry: "白酒", price: "1688.50", changePercent: "+0.82%", amount: "82.40亿", marketCap: "2.12万亿", pe: "28.6", pb: "9.8", listingDate: "2001-08-27" }),
  buildFallbackStock({ code: "300750", name: "宁德时代", pinyin: "NDSD", industry: "电池", price: "214.20", changePercent: "+1.36%", amount: "96.10亿", marketCap: "9420亿", pe: "22.4", pb: "4.7", listingDate: "2018-06-11" }),
  buildFallbackStock({ code: "301396", name: "宏景科技", pinyin: "HJKJ", industry: "软件服务", price: "28.64", changePercent: "-0.74%", amount: "3.20亿", marketCap: "31.2亿", pe: "68.5", pb: "3.6", listingDate: "2022-11-11" }),
  buildFallbackStock({ code: "688981", name: "中芯国际", pinyin: "ZXGJ", industry: "半导体", price: "58.73", changePercent: "+2.18%", amount: "67.80亿", marketCap: "4680亿", pe: "86.2", pb: "3.1", listingDate: "2020-07-16" }),
];

export async function searchStockCandidates(query) {
  const keyword = normalizeQuery(query);
  if (!keyword) return { data: fallbackStocks, source: "模拟数据", status: "模拟数据", message: "" };

  const fallbackMatches = matchFallbackStocks(keyword);
  if (/^\d{6}$/.test(keyword)) {
    const stock = await fetchStockQuote({ code: keyword, name: fallbackMatches[0]?.name ?? keyword, secid: toSecid(keyword) }).catch(() => null);
    return buildSearchResult(stock ? [mergeStock(stock, fallbackMatches[0])] : fallbackMatches, stock ? "东方财富" : "模拟数据", stock ? "真实数据" : "模拟数据", keyword);
  }

  try {
    const remote = await searchEastmoney(keyword);
    const limited = remote.slice(0, 8);
    const quoted = await Promise.all(limited.map((stock) => fetchStockQuote(stock).catch(() => stock)));
    return buildSearchResult(quoted.map((stock) => mergeStock(stock, fallbackStocks.find((item) => item.code === stock.code))), "东方财富", "部分真实", keyword);
  } catch (error) {
    return buildSearchResult(fallbackMatches, "模拟数据", "模拟数据", keyword, error.message);
  }
}

export async function getStockDetail(query) {
  const result = await searchStockCandidates(query);
  const stock = result.data[0];
  if (!stock) {
    return { ok: false, message: `未找到匹配股票：${query}`, source: result.source, status: result.status, updatedAt: result.updatedAt, data: null };
  }
  return { ok: true, source: result.source, status: result.status, updatedAt: result.updatedAt, data: enrichResearchFields(stock, result) };
}

async function searchEastmoney(keyword) {
  const url = `${eastmoneySearchApi}?input=${encodeURIComponent(keyword)}&type=14&token=`;
  const response = await fetchWithTimeout(url);
  const json = await response.json();
  const rows = json?.QuotationCodeTable?.Data ?? json?.data ?? [];
  const stocks = rows
    .map((item) => ({ code: item.Code ?? item.code, name: item.Name ?? item.name, market: item.MktNum ?? item.market }))
    .filter((item) => /^\d{6}$/.test(String(item.code ?? "")))
    .map((item) => ({ ...item, secid: toSecid(item.code, item.market) }));
  if (!stocks.length) throw new Error("未找到远程匹配股票");
  return stocks;
}

async function fetchStockQuote(stock) {
  const fields = "f12,f14,f2,f3,f4,f6,f20,f100,f162,f167";
  const url = `${eastmoneyQuoteApi}/ulist.np/get?fltt=2&fields=${fields}&secids=${stock.secid ?? toSecid(stock.code, stock.market)}`;
  const response = await fetchWithTimeout(url);
  const json = await response.json();
  const row = json?.data?.diff?.[0];
  if (!row) throw new Error("股票行情为空");
  return {
    code: row.f12 || stock.code,
    name: row.f14 || stock.name,
    price: formatPrice(row.f2),
    changePercent: formatPercent(row.f3),
    changeAmount: formatPrice(row.f4),
    amount: formatAmount(row.f6),
    marketCap: formatAmount(row.f20),
    industry: row.f100 || stock.industry || "待补充",
    pe: formatMetric(row.f162),
    pb: formatMetric(row.f167),
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
  const industry = stock.industry ?? "待补充";
  return {
    ...stock,
    name,
    code: stock.code ?? stock.stockCode,
    pinyin: stock.pinyin ?? "",
    companyName: stock.companyName ?? name,
    listingDate: stock.listingDate ?? "待补充",
    marketCap: stock.marketCap ?? "待补充",
    pe: stock.pe ?? "待补充",
    pb: stock.pb ?? "待补充",
    dataSource: stock.dataSource ?? stock.quoteSource ?? "模拟数据",
    quoteSource: stock.quoteSource ?? stock.dataSource ?? "模拟数据",
    dataStatus: stock.dataStatus ?? "模拟数据",
    updatedAt: stock.updatedAt ?? nowText(),
    profile: stock.profile ?? `${name}为A股上市公司，当前公司资料以公开行情和模拟研究库补充展示。`,
    mainBusiness: stock.mainBusiness ?? `${industry}相关业务，后续可接入年报和公告进一步校验。`,
    industryPosition: stock.industryPosition ?? `${industry}行业内需结合营收规模、盈利能力和市场份额持续观察。`,
    financials: stock.financials ?? { revenue: "待接财报", netProfit: "待接财报", grossMargin: "待接财报", roe: "待接财报" },
    valuationRange: stock.valuationRange ?? { pe: "历史PE待接入", pb: "历史PB待接入" },
    researchReport: stock.researchReport ?? buildResearchReport(stock, industry),
    riskTips: stock.riskTips ?? ["行情和估值数据可能延迟", "研究结论不构成确定买入或卖出建议"],
  };
}

function buildResearchReport(stock, industry) {
  const name = stock.name ?? "";
  return {
    company: `${name}基础资料已纳入研究视图，仍需结合公告和财报验证。`,
    industry: `${industry}方向需观察政策、景气度和资金持续性。`,
    moat: "核心竞争力需从主营业务、客户结构、盈利能力和研发投入继续验证。",
    moveReason: "最近涨跌需要结合指数、行业板块、新闻事件和成交量综合判断。",
    newsImpact: "暂无确定重大新闻影响，后续接入公告和新闻服务后自动更新。",
    capitalFlow: `成交额 ${stock.amount ?? "待补充"}，资金情况仅作观察。`,
    technicalTrend: `涨跌幅 ${stock.changePercent ?? "待补充"}，短线需观察量价配合。`,
    risks: ["估值波动", "行业景气变化", "公告或财报不及预期"],
    aiScore: scoreStock(stock),
    summary: "当前定位为机会观察和风险跟踪，不输出明确买入、卖出或保证上涨结论。",
  };
}

function buildSearchResult(data, source, status, query, message = "") {
  return { ok: true, source, status, updatedAt: nowText(), message: data.length ? message : `未找到匹配股票：${query}`, data };
}

function matchFallbackStocks(keyword) {
  const upper = keyword.toUpperCase();
  return fallbackStocks.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword) || stock.pinyin.includes(upper));
}

function buildFallbackStock(stock) {
  return enrichResearchFields({ ...stock, dataSource: "模拟数据", quoteSource: "模拟数据", dataStatus: "模拟数据", updatedAt: nowText() });
}

function normalizeQuery(query) {
  return String(query ?? "").trim();
}

function toSecid(code, market) {
  if (String(market) === "1" || String(code).startsWith("6")) return `1.${code}`;
  return `0.${code}`;
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
  if (stock.pe && stock.pe !== "待补充") score += 8;
  if (stock.pb && stock.pb !== "待补充") score += 6;
  if (String(stock.changePercent ?? "").startsWith("+")) score += 4;
  return Math.min(90, score);
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

function formatAmount(value) {
  const number = normalizeNumber(value);
  if (number >= 1_0000_0000_0000) return `${(number / 1_0000_0000_0000).toFixed(2)}万亿`;
  if (number >= 1_0000_0000) return `${(number / 1_0000_0000).toFixed(2)}亿`;
  if (number >= 10000) return `${(number / 10000).toFixed(2)}万`;
  return String(Math.round(number));
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
