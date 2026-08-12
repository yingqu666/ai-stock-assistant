const eastmoneyApi = "https://push2.eastmoney.com/api/qt";
const indexSecids = "1.000001,0.399001,0.399006";
const boardFs = "m:90+t:2";
const allAShareFs = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23";
const fastNewsApi = "https://np-listapi.eastmoney.com/comm/web/getFastNews";
const requestTimeoutMs = 5000;
import { getStockDetail } from "./stockService.js";

export async function collectReportSourceData({
  type,
  watchlist = [],
  portfolio = [],
  investmentProfile = {},
  historyReports = [],
  aiHistory = [],
  knowledge = [],
  journal = [],
} = {}) {
  const [marketData, newsData, stockData] = await Promise.all([
    collectMarketData().catch((error) => fallbackMarketData(error)),
    collectNewsData().catch(() => []),
    collectTrackedStockData([...watchlist, ...portfolio]).catch(() => []),
  ]);

  return {
    type,
    generatedBy: "server-scheduler",
    generatedAt: new Date().toISOString(),
    marketData,
    newsData,
    stockData,
    watchlist,
    portfolio,
    investmentProfile,
    historyReports,
    aiHistory,
    knowledge,
    investmentJournal: journal,
    userProfileSignals: buildUserProfileSignals({ investmentProfile, journal, aiHistory }),
  };
}

export async function collectMarketData() {
  const [indexes, boards, breadth] = await Promise.all([
    fetchIndexes().catch(() => []),
    fetchHotBoards().catch(() => []),
    fetchMarketBreadth().catch(() => ({ upCount: 0, downCount: 0, status: "宽度接口回退" })),
  ]);
  if (!indexes.length && !boards.length) throw new Error("东方财富指数和板块接口均未返回数据");
  const upCount = breadth.upCount;
  const downCount = breadth.downCount;
  const averageChange = indexes.length ? indexes.reduce((sum, item) => sum + item.changePercent, 0) / indexes.length : 0;
  const turnover = indexes.reduce((sum, item) => sum + item.turnover, 0);

  return {
    source: indexes.length && boards.length ? "东方财富" : "东方财富部分接口",
    status: indexes.length && boards.length && (upCount || downCount) ? "真实" : "部分真实",
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    marketOverview: [
      ...indexes.map((item) => ({ label: item.name, value: formatNumber(item.price), change: formatPercent(item.changePercent) })),
      { label: "成交额", value: formatAmount(turnover), change: "指数合计" },
      { label: "上涨家数", value: String(upCount), change: upCount || downCount ? "东方财富宽度" : "暂未返回" },
      { label: "下跌家数", value: String(downCount), change: upCount || downCount ? "东方财富宽度" : "暂未返回" },
    ],
    marketSentiment: {
      summary: `三大指数平均涨跌幅 ${formatPercent(averageChange)}，成交额约 ${formatAmount(turnover)}。`,
      upCount,
      downCount,
      riskLevel: averageChange >= 0 ? "中" : "偏高",
    },
    hotSectors: boards.slice(0, 6).map((item) => ({
      name: item.name,
      status: item.changePercent >= 0 ? "活跃" : "调整",
      flow: formatPercent(item.changePercent),
      reason: "东方财富板块涨幅靠前",
      risk: "热点轮动较快，需要结合成交延续性观察。",
    })),
  };
}

async function collectNewsData() {
  const rows = await fetchFastNews();
  return rows.slice(0, 10).map((item) => ({
    title: item.title ?? "财经新闻",
    source: item.mediaName ?? "东方财富快讯",
    category: classifyMarketNews(item.title ?? ""),
    impact: analyzeImpact(item.title ?? ""),
    time: item.showTime ?? new Date().toISOString(),
    link: item.url ?? item.shareUrl ?? "",
    dataStatus: "真实数据",
  }));
}

async function fetchIndexes() {
  const url = `${eastmoneyApi}/ulist.np/get?fltt=2&fields=f12,f14,f2,f3,f6&secids=${indexSecids}`;
  const rows = await fetchRows(url);
  return rows.map((row) => ({ code: row.f12, name: row.f14, price: toNumber(row.f2), changePercent: toNumber(row.f3), turnover: toNumber(row.f6) }));
}

async function fetchHotBoards() {
  const url = `${eastmoneyApi}/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(boardFs)}&fields=f14,f3`;
  const rows = await fetchRows(url);
  return rows.map((row) => ({ name: row.f14, changePercent: toNumber(row.f3) }));
}

async function fetchMarketBreadth() {
  const pageSize = 100;
  const firstPage = await fetchBreadthPage(1, pageSize);
  const total = toNumber(firstPage?.data?.total);
  const totalPages = Math.min(Math.ceil(total / pageSize), 70);
  const rows = [...(firstPage?.data?.diff ?? [])];
  for (let page = 2; page <= totalPages; page += 1) {
    const pageData = await fetchBreadthPage(page, pageSize);
    rows.push(...(pageData?.data?.diff ?? []));
  }
  return rows.reduce((acc, item) => {
    const change = toNumber(item.f3);
    if (change > 0) acc.upCount += 1;
    if (change < 0) acc.downCount += 1;
    return acc;
  }, { upCount: 0, downCount: 0, status: "真实" });
}

function fetchBreadthPage(page, pageSize) {
  const url = `${eastmoneyApi}/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(allAShareFs)}&fields=f3`;
  return fetchJson(url);
}

async function fetchFastNews() {
  const url = `${fastNewsApi}?client=web&biz=web_724&fastColumn=102&sortEnd=0&pageSize=10&req_trace=${Date.now()}`;
  const json = await fetchJson(url);
  return Array.isArray(json?.data) ? json.data : [];
}

async function collectTrackedStockData(items) {
  const codes = [...new Set(items.map((item) => item.code ?? item.stockCode).filter(Boolean))];
  const results = await Promise.all(codes.slice(0, 20).map((code) => getStockDetail(code).catch(() => null)));
  return results.filter((result) => result?.data).map((result) => result.data);
}

async function fetchRows(url) {
  const json = await fetchJson(url);
  return json?.data?.diff ?? [];
}

async function fetchJson(url) {
  const targets = buildEastmoneyUrls(url);
  let lastError;
  for (const target of targets) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
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
  if (url.includes("https://np-listapi.eastmoney.com")) {
    urls.push(url.replace("https://np-listapi.eastmoney.com", "http://np-listapi.eastmoney.com"));
  }
  return [...new Set(urls)];
}

function classifyMarketNews(title) {
  if (/政策|国务院|证监会|发改委|工信部/.test(title)) return "政策新闻";
  if (/行业|产业|需求|订单|服务器|芯片|算力|半导体|储能|电力/.test(title)) return "行业新闻";
  return "市场热点";
}

function analyzeImpact(title) {
  if (/增长|回购|增持|中标|突破|需求|上调|利好/.test(title)) return "利好";
  if (/减持|亏损|下滑|处罚|风险|终止|诉讼|下降/.test(title)) return "利空";
  return "中性";
}

function fallbackMarketData(error) {
  return {
    source: "fallback",
    status: "回退",
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    marketOverview: [],
    marketSentiment: {
      summary: `真实行情采集失败：${error.message}`,
      upCount: 0,
      downCount: 0,
      riskLevel: "未知",
    },
    hotSectors: [],
  };
}

function buildUserProfileSignals({ investmentProfile, journal, aiHistory }) {
  return {
    riskLevel: investmentProfile?.riskLevel ?? "中",
    focusIndustries: investmentProfile?.industries ?? [],
    journalCount: journal.length,
    aiHistoryCount: aiHistory.length,
    recentReasons: journal.slice(0, 5).map((item) => item.reason).filter(Boolean),
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return toNumber(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
  const number = toNumber(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatAmount(value) {
  const number = toNumber(value);
  if (number >= 1_0000_0000_0000) return `${(number / 1_0000_0000_0000).toFixed(2)}万亿`;
  if (number >= 1_0000_0000) return `${(number / 1_0000_0000).toFixed(2)}亿`;
  return `${Math.round(number / 10000)}万`;
}
