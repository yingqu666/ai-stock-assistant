import { DATA_MODE } from "../config/dataSources.js";
import { hotSectors, marketOverview, marketSentiment, sectors, strategy } from "../data.js";
import { cloudDataApi } from "./cloudService.js";

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
    console.warn("真实行情获取失败，首页改为数据不足状态：", error);
    return getUnavailableMarketSnapshot(error);
  }
}

function getMockMarketSnapshot() {
  return { strategy, marketOverview, marketSentiment, hotSectors, sectors, updatedAt: formatNow(), source: "本地备用数据", dataStatus: "暂无实时数据" };
}

function getUnavailableMarketSnapshot(error) {
  return {
    strategy: {
      ...strategy,
      state: "数据不足",
      score: null,
      risk: "未知",
      summary: `真实行情接口暂不可用：${error?.message ?? "未知错误"}。`,
      drivers: [],
    },
    marketOverview: [],
    marketSentiment: {
      heat: null,
      longShort: "数据不足",
      upCount: null,
      downCount: null,
      flatCount: null,
      limitUpCount: null,
      limitDownCount: null,
      totalCount: null,
      turnover: null,
      moneyEffect: "数据不足",
      riskLevel: "未知",
      summary: "真实行情接口未返回有效市场状态。",
      failureReason: error?.message ?? "真实行情获取失败",
    },
    hotSectors: [],
    sectors: [],
    updatedAt: formatNow(),
    source: "真实行情获取失败",
    dataStatus: "数据不足",
    failureReason: error?.message ?? "真实行情获取失败",
  };
}

async function getRealMarketSnapshot() {
  const cloudSnapshot = await getCloudMarketSnapshot().catch(() => null);
  if (cloudSnapshot) return cloudSnapshot;

  const indexData = await fetchEastmoneyIndexes();
  const breadthData = await fetchEastmoneyBreadth().catch(() => ({
    upCount: null,
    downCount: null,
    flatCount: null,
    limitUpCount: null,
    limitDownCount: null,
    totalCount: null,
    status: "市场广度接口未返回",
  }));
  const boardData = await fetchEastmoneyHotBoards().catch(() => []);

  if (!indexData.length) throw new Error("指数数据为空");

  const turnover = indexData.reduce((sum, item) => sum + normalizeNumber(item.f6), 0);
  const moneyEffect = calculateMoneyEffect(breadthData, boardData, turnover);
  const realMarketOverview = [
    ...indexData.map((item) => ({
      label: normalizeIndexName(item.f14),
      value: formatIndexValue(item.f2),
      change: formatPercent(item.f3),
    })),
    { label: "成交额", value: formatAmount(turnover), change: "实时" },
    { label: "上涨数量", value: formatCount(breadthData.upCount), change: breadthData.upCount >= breadthData.downCount ? "偏强" : "偏弱" },
    { label: "下跌数量", value: formatCount(breadthData.downCount), change: breadthData.downCount > breadthData.upCount ? "偏弱" : "可控" },
    { label: "平盘数量", value: formatCount(breadthData.flatCount), change: breadthData.status ?? "东方财富宽度" },
    { label: "涨停数量", value: formatCount(breadthData.limitUpCount), change: "涨停统计" },
    { label: "跌停数量", value: formatCount(breadthData.limitDownCount), change: "跌停统计" },
  ];

  const heat = Math.max(0, Math.min(100, Math.round((normalizeNumber(breadthData.upCount) / Math.max(1, normalizeNumber(breadthData.upCount) + normalizeNumber(breadthData.downCount))) * 100)));
  const realSentiment = {
    heat,
    longShort: normalizeNumber(breadthData.upCount) >= normalizeNumber(breadthData.downCount) ? "多方占优" : "空方占优",
    upCount: breadthData.upCount,
    downCount: breadthData.downCount,
    flatCount: breadthData.flatCount,
    limitUpCount: breadthData.limitUpCount,
    limitDownCount: breadthData.limitDownCount,
    totalCount: breadthData.totalCount,
    turnover: formatAmount(turnover),
    moneyEffect: moneyEffect.label,
    moneyEffectBasis: moneyEffect.basis,
    riskLevel: heat >= 65 ? "中低" : heat >= 45 ? "中等" : "偏高",
    summary: `真实行情显示上涨 ${formatCount(breadthData.upCount)} 家、下跌 ${formatCount(breadthData.downCount)} 家、平盘 ${formatCount(breadthData.flatCount)} 家，赚钱效应${moneyEffect.label}。`,
  };

  const realSectors = boardData.map((item) => ({
    name: item.f14,
    heat: Math.round(Math.max(0, normalizeNumber(item.f3))),
    heatRank: item.rank,
    heatBasis: item.heatBasis,
    changePercent: formatPercent(item.f3),
    turnover: formatAmount(item.f6),
    amount: formatAmount(item.f6),
    capitalFlow: formatAmount(item.f62),
    capitalFlowRatio: formatPercent(item.f184),
    flow: `${formatAmount(item.f62)}（${formatPercent(item.f184)}）`,
    view: `${item.f14}涨幅靠前，当前涨跌幅 ${formatPercent(item.f3)}，成交额 ${formatAmount(item.f6)}。`,
    dataSource: "东方财富板块行情",
  }));

  const realHotSectors = realSectors.slice(0, 12).map((item) => ({
    name: item.name,
    status: item.changePercent.startsWith("+") ? "强势活跃" : "震荡观察",
    changePercent: item.changePercent,
    turnover: item.turnover,
    amount: item.amount,
    capitalFlow: item.capitalFlow,
    capitalFlowRatio: item.capitalFlowRatio,
    flow: item.flow,
    heatRank: item.heatRank,
    heatBasis: item.heatBasis,
    reason: `东方财富板块行情TOP${item.heatRank}，依据涨跌幅、成交额和资金活跃度排序。`,
    aiReason: `板块涨跌幅 ${item.changePercent}，成交额 ${item.turnover}，资金表现 ${item.flow}，短线关注度较高。`,
    sustainability: buildSectorSustainability(item),
    risk: buildSectorRisk(item),
    dataSource: item.dataSource,
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
    hotSectors: realHotSectors,
    sectors: realSectors,
    updatedAt: formatNow(),
    source: realSectors.length ? "东方财富" : "东方财富指数，板块数据缺失",
    dataStatus: realSectors.length && breadthData.status !== "市场广度接口未返回" ? "真实数据" : "部分真实",
  };
}

async function getCloudMarketSnapshot() {
  const result = await cloudDataApi.getMarketSnapshot();
  const data = result.data ?? result;
  if (!data?.marketOverview?.length && !data?.hotSectors?.length) return null;
  const sentiment = data.marketSentiment ?? {};
  const avgState = normalizeMarketStateFromSentiment(sentiment);
  return {
    strategy: data.strategy ?? {
      ...strategy,
      state: avgState,
      risk: sentiment.riskLevel ?? "中",
      summary: sentiment.summary ?? "市场数据已通过后端行情服务返回。",
      drivers: (data.hotSectors ?? []).slice(0, 5).map((item) => item.name),
    },
    marketOverview: data.marketOverview ?? [],
    marketSentiment: sentiment,
    hotSectors: data.hotSectors ?? [],
    sectors: data.sectors ?? data.hotSectors ?? [],
    updatedAt: data.updatedAt ?? formatNow(),
    source: data.source ?? "后端东方财富行情",
    dataStatus: data.dataStatus ?? data.status ?? "真实数据",
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
      if (change === 0) acc.flatCount += 1;
      if (change >= 9.8) acc.limitUpCount += 1;
      if (change <= -9.8) acc.limitDownCount += 1;
      return acc;
    },
    { upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: rows.length, status: "东方财富宽度" },
  );
}

function fetchEastmoneyBreadthPage(page, pageSize) {
  const url = `${eastmoneyApi}/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(allAShareFs)}&fields=f3`;
  return fetchJson(url);
}

async function fetchEastmoneyHotBoards() {
  const url = `${eastmoneyApi}/clist/get?pn=1&pz=12&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(boardFs)}&fields=f14,f3,f6,f62,f184`;
  const json = await fetchJson(url);
  return (json?.data?.diff ?? []).map((item, index) => ({
    ...item,
    rank: index + 1,
    heatBasis: "按东方财富板块涨幅榜排序，并补充成交额与主力资金字段。",
  }));
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

function normalizeMarketStateFromSentiment(sentiment = {}) {
  const up = normalizeNumber(sentiment.upCount);
  const down = normalizeNumber(sentiment.downCount);
  if (up > down * 1.3) return "偏强";
  if (down > up * 1.3) return "偏弱";
  return "震荡";
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCount(value) {
  return value === null || value === undefined ? "数据缺失" : String(value);
}

function calculateMoneyEffect(breadth = {}, boards = [], turnover = 0) {
  const up = normalizeNumber(breadth.upCount);
  const down = normalizeNumber(breadth.downCount);
  const total = Math.max(1, up + down + normalizeNumber(breadth.flatCount));
  const upRatio = up / total;
  const activeBoards = boards.filter((item) => normalizeNumber(item.f3) > 1).length;
  const turnoverActive = turnover >= 800000000000;
  if (!up && !down) return { label: "数据不足", basis: "上涨比例、成交额和热点集中度暂未完整返回。" };
  if (upRatio >= 0.58 && turnoverActive && activeBoards >= 4) return { label: "偏强", basis: `上涨比例${Math.round(upRatio * 100)}%，成交活跃，热点板块较集中。` };
  if (upRatio <= 0.42 || activeBoards <= 1) return { label: "偏弱", basis: `上涨比例${Math.round(upRatio * 100)}%，热点扩散不足。` };
  return { label: "分化", basis: `上涨比例${Math.round(upRatio * 100)}%，热点数量${activeBoards}个，适合精选方向。` };
}

function buildSectorSustainability(item = {}) {
  const change = normalizeNumber(String(item.changePercent).replace("%", ""));
  const flow = normalizeNumber(String(item.capitalFlow).replace(/[^\d.-]/g, ""));
  if (change >= 2 && flow > 0) return "持续性偏强，但仍需观察成交额和资金流入是否延续。";
  if (change >= 1) return "持续性中等，短线热度存在但资金确认不足。";
  return "持续性待确认，当前更多是轮动观察。";
}

function buildSectorRisk(item = {}) {
  const change = normalizeNumber(String(item.changePercent).replace("%", ""));
  if (change >= 4) return "短线涨幅较高，容易出现追高和冲高回落风险。";
  return "若成交额缩小或主力资金转弱，板块持续性会下降。";
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
