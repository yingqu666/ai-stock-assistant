import { DATA_MODE } from "../config/dataSources.js";
import { hotSectors, marketOverview, marketSentiment, sectors, strategy } from "../data.js";

const eastmoneyApi = "https://push2.eastmoney.com/api/qt";
const indexSecids = "1.000001,0.399001,0.399006";
const allAShareFs = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23";
const boardFs = "m:90+t:2";

export async function getMarketSnapshot() {
  if (DATA_MODE !== "real") {
    return getMockMarketSnapshot();
  }

  try {
    return await getRealMarketSnapshot();
  } catch (error) {
    console.warn("真实行情获取失败，已使用本地备用数据：", error);
    return getMockMarketSnapshot();
  }
}

function getMockMarketSnapshot() {
  return { strategy, marketOverview, marketSentiment, hotSectors, sectors, updatedAt: formatNow(), source: "本地备用数据", dataStatus: "暂无实时数据" };
}

async function getRealMarketSnapshot() {
  const indexData = await fetchEastmoneyIndexes();
  const breadthData = await fetchEastmoneyBreadth().catch(() => ({
    upCount: Number(marketOverview.find((item) => item.label === "上涨数量")?.value?.replace(",", "")) || 0,
    downCount: Number(marketOverview.find((item) => item.label === "下跌数量")?.value?.replace(",", "")) || 0,
  }));
  const boardData = await fetchEastmoneyHotBoards().catch(() => []);

  if (!indexData.length) throw new Error("指数数据为空");

  const turnover = indexData.reduce((sum, item) => sum + normalizeNumber(item.f6), 0);
  const realMarketOverview = [
    ...indexData.map((item) => ({
      label: normalizeIndexName(item.f14),
      value: formatIndexValue(item.f2),
      change: formatPercent(item.f3),
    })),
    { label: "成交额", value: formatAmount(turnover), change: "实时" },
    { label: "上涨数量", value: String(breadthData.upCount), change: breadthData.upCount >= breadthData.downCount ? "偏强" : "偏弱" },
    { label: "下跌数量", value: String(breadthData.downCount), change: breadthData.downCount > breadthData.upCount ? "偏弱" : "可控" },
  ];

  const heat = Math.max(0, Math.min(100, Math.round((breadthData.upCount / Math.max(1, breadthData.upCount + breadthData.downCount)) * 100)));
  const realSentiment = {
    heat,
    longShort: breadthData.upCount >= breadthData.downCount ? "多方占优" : "空方占优",
    upCount: breadthData.upCount,
    downCount: breadthData.downCount,
    riskLevel: heat >= 65 ? "中低" : heat >= 45 ? "中等" : "偏高",
    summary: `真实行情显示上涨 ${breadthData.upCount} 家、下跌 ${breadthData.downCount} 家，市场热度约 ${heat} 分。`,
  };

  const realSectors = boardData.map((item) => ({
    name: item.f14,
    heat: Math.round(Math.max(0, normalizeNumber(item.f3))),
    flow: formatPercent(item.f3),
    view: `${item.f14}涨幅靠前，当前涨跌幅 ${formatPercent(item.f3)}`,
  }));

  const realHotSectors = realSectors.slice(0, 3).map((item) => ({
    name: item.name,
    status: item.flow.startsWith("+") ? "强势活跃" : "震荡观察",
    reason: "东方财富板块涨幅榜靠前，短线资金关注度较高。",
    risk: "板块快速上涨后波动可能放大，需结合成交量和个股基本面观察。",
  }));

  const avgIndexChange = indexData.reduce((sum, item) => sum + normalizeNumber(item.f3), 0) / indexData.length;
  const realStrategy = {
    ...strategy,
    state: avgIndexChange >= 0.5 ? "偏强" : avgIndexChange >= 0 ? "震荡偏强" : "震荡偏弱",
    score: Math.round(Math.max(0, Math.min(100, 50 + avgIndexChange * 10 + (heat - 50) * 0.4))),
    risk: realSentiment.riskLevel,
    summary: `三大指数平均涨跌幅 ${formatPercent(avgIndexChange)}，${realSentiment.summary}`,
    drivers: realHotSectors.map((item) => item.name),
  };

  return {
    strategy: realStrategy,
    marketOverview: realMarketOverview,
    marketSentiment: realSentiment,
    hotSectors: realHotSectors.length ? realHotSectors : hotSectors,
    sectors: realSectors.length ? realSectors : sectors,
    updatedAt: formatNow(),
    source: realSectors.length ? "东方财富" : "东方财富指数 + 模拟板块回退",
    dataStatus: realSectors.length ? "真实数据" : "部分真实",
  };
}

async function fetchEastmoneyIndexes() {
  const url = `${eastmoneyApi}/ulist.np/get?fltt=2&fields=f12,f14,f2,f3,f4,f5,f6&secids=${indexSecids}`;
  const json = await fetchJson(url);
  return json?.data?.diff ?? [];
}

async function fetchEastmoneyBreadth() {
  const pageSize = 100;
  const firstPage = await fetchEastmoneyBreadthPage(1, pageSize);
  const total = normalizeNumber(firstPage?.data?.total);
  const totalPages = Math.min(Math.ceil(total / pageSize), 70);
  const remainingPages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2);
  const remaining = [];
  for (let index = 0; index < remainingPages.length; index += 5) {
    const chunk = remainingPages.slice(index, index + 5);
    const chunkResults = await Promise.all(chunk.map((page) => fetchEastmoneyBreadthPage(page, pageSize)));
    remaining.push(...chunkResults);
  }
  const rows = [firstPage, ...remaining].flatMap((page) => page?.data?.diff ?? []);

  return rows.reduce(
    (acc, item) => {
      const change = normalizeNumber(item.f3);
      if (change > 0) acc.upCount += 1;
      if (change < 0) acc.downCount += 1;
      return acc;
    },
    { upCount: 0, downCount: 0 },
  );
}

function fetchEastmoneyBreadthPage(page, pageSize) {
  const url = `${eastmoneyApi}/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(allAShareFs)}&fields=f3`;
  return fetchJson(url);
}

async function fetchEastmoneyHotBoards() {
  const url = `${eastmoneyApi}/clist/get?pn=1&pz=8&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(boardFs)}&fields=f14,f3`;
  const json = await fetchJson(url);
  return json?.data?.diff ?? [];
}

async function fetchJson(url) {
  const urls = [
    url,
    url.replace("https://push2.eastmoney.com", "https://push2his.eastmoney.com"),
    url.replace("https://push2.eastmoney.com", "http://push2.eastmoney.com"),
  ];

  let lastError;
  for (const target of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(target, { cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function normalizeIndexName(name) {
  if (name === "上证指数") return "上证指数";
  if (name === "深证成指") return "深证指数";
  if (name === "创业板指") return "创业板指数";
  return name;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatIndexValue(value) {
  return normalizeNumber(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
  const number = normalizeNumber(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatAmount(value) {
  const number = normalizeNumber(value);
  if (number >= 1000000000000) return `${(number / 1000000000000).toFixed(2)}万亿`;
  return `${Math.round(number / 100000000)}亿`;
}

function formatNow() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
