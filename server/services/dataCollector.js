const eastmoneyApi = "https://push2.eastmoney.com/api/qt";
const indexSecids = "1.000001,0.399001,0.399006";
const boardFs = "m:90+t:2";
const allAShareFs = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23";
const fastNewsApi = "https://np-listapi.eastmoney.com/comm/web/getFastNews";
const sinaQuoteApi = "https://hq.sinajs.cn/list=";
const tencentQuoteApi = "https://qt.gtimg.cn/q=";
const sinaMarketCenterApi = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php";
const sinaIndustryApi = "https://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php";
const requestTimeoutMs = 6500;
const marketDataVersion = "2026-08-16-market-fallback-diagnostics";
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
  const diagnostics = [];
  const [indexes, boards, breadth] = await Promise.all([
    fetchIndexes(diagnostics).catch((error) => {
      recordMarketFailure(diagnostics, "指数聚合", error);
      return [];
    }),
    fetchHotBoards(diagnostics).catch((error) => {
      recordMarketFailure(diagnostics, "热点板块", error);
      return [];
    }),
    fetchMarketBreadth(diagnostics).catch((error) => {
      recordMarketFailure(diagnostics, "市场宽度", error);
      return { upCount: null, downCount: null, flatCount: null, limitUpCount: null, limitDownCount: null, totalCount: null, status: "宽度接口未返回" };
    }),
  ]);
  if (!indexes.length && !boards.length) {
    const message = diagnostics.map((item) => `${item.source}:${item.status}`).join("；") || "全部免费行情源均未返回";
    const error = new Error(`指数和板块接口均未返回数据：${message}`);
    error.diagnostics = diagnostics;
    throw error;
  }
  const upCount = breadth.upCount;
  const downCount = breadth.downCount;
  const averageChange = indexes.length ? indexes.reduce((sum, item) => sum + item.changePercent, 0) / indexes.length : 0;
  const turnover = indexes.reduce((sum, item) => sum + item.turnover, 0);
  const moneyEffect = calculateMoneyEffect(breadth, boards, turnover);
  const indexSource = sourceSummary(indexes, "指数");
  const boardSource = boards.length ? sourceSummary(boards, "板块行情") : "板块数据缺失";
  const breadthSource = upCount || downCount ? (breadth.source ?? "东方财富宽度") : "宽度数据缺失";

  return {
    source: [indexSource, boardSource, breadthSource].filter(Boolean).join(" + "),
    status: indexes.length && boards.length && (upCount || downCount) ? "真实数据" : "部分真实",
    dataStatus: indexes.length && boards.length && (upCount || downCount) ? "真实数据" : "部分真实",
    version: marketDataVersion,
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    diagnostics,
    marketOverview: [
      ...indexes.map((item) => ({ label: item.name, value: formatNumber(item.price), change: formatPercent(item.changePercent) })),
      { label: "成交额", value: indexes.length ? formatAmount(turnover) : "数据缺失", change: indexes.length ? indexSource : "暂未返回" },
      { label: "上涨数量", value: formatCount(upCount), change: upCount || downCount ? breadthSource : "暂未返回" },
      { label: "下跌数量", value: formatCount(downCount), change: upCount || downCount ? breadthSource : "暂未返回" },
      { label: "平盘数量", value: formatCount(breadth.flatCount), change: breadth.status ?? "东方财富宽度" },
      { label: "涨停数量", value: formatCount(breadth.limitUpCount), change: "涨停统计" },
      { label: "跌停数量", value: formatCount(breadth.limitDownCount), change: "跌停统计" },
    ],
    marketSentiment: {
      summary: `三大指数平均涨跌幅 ${formatPercent(averageChange)}，成交额约 ${formatAmount(turnover)}。`,
      upCount,
      downCount,
      flatCount: breadth.flatCount,
      limitUpCount: breadth.limitUpCount,
      limitDownCount: breadth.limitDownCount,
      totalCount: breadth.totalCount,
      turnover: formatAmount(turnover),
      moneyEffect: moneyEffect.label,
      moneyEffectBasis: moneyEffect.basis,
      riskLevel: averageChange >= 0 ? "中" : "偏高",
      diagnostics,
    },
    hotSectors: boards.slice(0, 12).map((item) => ({
      name: item.name,
      status: item.changePercent >= 0 ? "活跃" : "调整",
      changePercent: formatPercent(item.changePercent),
      change: formatPercent(item.changePercent),
      turnover: formatAmount(item.turnover),
      amount: formatAmount(item.turnover),
      leaderSymbol: item.leaderSymbol,
      leaderName: item.leaderName,
      leaderChangePercent: formatPercent(item.leaderChangePercent),
      capitalFlow: item.capitalFlow === null || item.capitalFlow === undefined ? "资金字段未返回" : formatAmount(item.capitalFlow),
      capitalFlowRatio: item.capitalFlowRatio === null || item.capitalFlowRatio === undefined ? "资金占比缺失" : formatPercent(item.capitalFlowRatio),
      flow: item.capitalFlow === null || item.capitalFlow === undefined ? `成交额${formatAmount(item.turnover)}` : `${formatAmount(item.capitalFlow)}（${formatPercent(item.capitalFlowRatio)}）`,
      heatRank: item.rank,
      heatBasis: buildSectorHeatBasis(item),
      rankingReason: buildSectorHeatBasis(item),
      reason: `${item.source ?? "板块行情"}TOP${item.rank}，依据涨跌幅、成交额和资金活跃度排序。`,
      aiReason: `板块涨跌幅 ${formatPercent(item.changePercent)}，成交额 ${formatAmount(item.turnover)}，资金表现 ${item.capitalFlow === null || item.capitalFlow === undefined ? "字段未返回" : formatAmount(item.capitalFlow)}。`,
      sustainability: buildSectorSustainability(item),
      risk: buildSectorRisk(item),
      dataSource: item.source ?? "板块行情",
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

async function fetchIndexes(diagnostics = []) {
  const sources = [
    ["东方财富指数", () => fetchEastmoneyIndexes(diagnostics)],
    ["新浪财经指数", () => fetchSinaIndexes(diagnostics)],
    ["腾讯财经指数", () => fetchTencentIndexes(diagnostics)],
  ];
  for (const [source, loader] of sources) {
    recordMarketAttempt(diagnostics, source, "指数");
    try {
      const rows = await loader();
      if (rows.length) {
        recordMarketSuccess(diagnostics, source, rows.length);
        return rows;
      }
      recordMarketEmpty(diagnostics, source, "接口返回为空");
    } catch (error) {
      recordMarketFailure(diagnostics, source, error);
    }
  }
  return [];
}

async function fetchEastmoneyIndexes(diagnostics = []) {
  const url = `${eastmoneyApi}/ulist.np/get?fltt=2&fields=f12,f14,f2,f3,f6&secids=${indexSecids}`;
  const rows = await fetchRows(url, diagnostics, "东方财富指数");
  return rows.map((row) => ({ code: row.f12, name: row.f14, price: toNumber(row.f2), changePercent: toNumber(row.f3), turnover: toNumber(row.f6), source: "东方财富指数" }));
}

async function fetchSinaIndexes() {
  const symbols = "s_sh000001,s_sz399001,s_sz399006";
  const text = await fetchText(`${sinaQuoteApi}${symbols}`, "新浪财经指数", { Referer: "https://finance.sina.com.cn/" });
  const rows = [...text.matchAll(/var hq_str_(s_[^=]+)="([^"]*)";/g)].map((match) => {
    const values = match[2].split(",");
    return {
      code: match[1],
      name: indexNameBySymbol(match[1], values[0]),
      price: toNumber(values[1]),
      changePercent: toNumber(values[3]),
      turnover: toNumber(values[5]) * 10000,
      source: "新浪财经指数",
    };
  });
  return rows.filter((item) => item.name && item.price);
}

async function fetchTencentIndexes() {
  const symbols = "sh000001,sz399001,sz399006";
  const text = await fetchText(`${tencentQuoteApi}${symbols}`, "腾讯财经指数", { Referer: "https://gu.qq.com/" });
  const rows = [...text.matchAll(/v_([^=]+)="([^"]*)";/g)].map((match) => {
    const values = match[2].split("~");
    const price = firstFinite(values[3], values[4]);
    const changePercent = firstFinite(values[32], values[31], values[30]);
    const turnover = firstFinite(values[37], values[36], values[35]) * 10000;
    return {
      code: match[1],
      name: indexNameBySymbol(match[1], values[1]),
      price,
      changePercent,
      turnover,
      source: "腾讯财经指数",
    };
  });
  return rows.filter((item) => item.name && item.price);
}

async function fetchHotBoards(diagnostics = []) {
  const adapters = [
    ["东方财富板块", () => fetchEastmoneyHotBoards(diagnostics)],
    ["新浪行业板块", () => fetchSinaHotBoards(diagnostics)],
    ["腾讯行业板块", () => fetchTencentHotBoards(diagnostics)],
    ["网易行业板块", () => fetchNeteaseHotBoards(diagnostics)],
  ];
  for (const [source, loader] of adapters) {
    recordMarketAttempt(diagnostics, source, "热点板块");
    try {
      const rows = await loader();
      if (rows.length) {
        recordMarketSuccess(diagnostics, source, rows.length);
        return rows;
      }
      recordMarketEmpty(diagnostics, source, "板块接口返回为空");
    } catch (error) {
      recordMarketFailure(diagnostics, source, error);
    }
  }
  return [];
}

async function fetchEastmoneyHotBoards(diagnostics = []) {
  const url = `${eastmoneyApi}/clist/get?pn=1&pz=12&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(boardFs)}&fields=f14,f3,f6,f62,f184`;
  const rows = await fetchRows(url, diagnostics, "东方财富板块");
  if (!rows.length) throw withMarketSource(new Error("empty response"), "东方财富板块", "empty");
  return rows.map((row, index) => ({
    name: row.f14,
    changePercent: toNumber(row.f3),
    turnover: toNumber(row.f6),
    capitalFlow: toNumber(row.f62),
    capitalFlowRatio: toNumber(row.f184),
    rank: index + 1,
    source: "东方财富板块行情",
  }));
}

async function fetchMarketBreadth(diagnostics = []) {
  const adapters = [
    ["东方财富宽度", () => fetchEastmoneyMarketBreadth(diagnostics)],
    ["新浪财经宽度", () => fetchSinaMarketBreadth(diagnostics)],
    ["腾讯财经宽度", () => fetchTencentMarketBreadth(diagnostics)],
    ["网易财经宽度", () => fetchNeteaseMarketBreadth(diagnostics)],
  ];
  for (const [source, loader] of adapters) {
    recordMarketAttempt(diagnostics, source, "市场宽度");
    try {
      const breadth = await loader();
      if (breadth.totalCount) {
        recordMarketSuccess(diagnostics, source, breadth.totalCount, {
          upCount: breadth.upCount,
          downCount: breadth.downCount,
          flatCount: breadth.flatCount,
          limitUpCount: breadth.limitUpCount,
          limitDownCount: breadth.limitDownCount,
        });
        return breadth;
      }
      recordMarketEmpty(diagnostics, source, "市场宽度返回为空");
    } catch (error) {
      recordMarketFailure(diagnostics, source, error);
    }
  }
  return { upCount: null, downCount: null, flatCount: null, limitUpCount: null, limitDownCount: null, totalCount: null, status: "宽度接口未返回", source: "宽度数据缺失" };
}

async function fetchEastmoneyMarketBreadth(diagnostics = []) {
  const pageSize = 100;
  const firstPage = await fetchBreadthPage(1, pageSize, diagnostics);
  const total = toNumber(firstPage?.data?.total);
  const totalPages = Math.min(Math.ceil(total / pageSize), 70);
  const rows = [...(firstPage?.data?.diff ?? [])];
  for (let page = 2; page <= totalPages; page += 5) {
    const chunk = Array.from({ length: Math.min(5, totalPages - page + 1) }, (_, index) => page + index);
    const pages = await Promise.all(chunk.map((pageNumber) => fetchBreadthPage(pageNumber, pageSize, diagnostics).catch((error) => {
      recordMarketFailure(diagnostics, `东方财富宽度第${pageNumber}页`, error);
      return null;
    })));
    rows.push(...pages.flatMap((pageData) => pageData?.data?.diff ?? []));
  }
  return rows.reduce((acc, item) => {
    const change = toNumber(item.f3);
    if (change > 0) acc.upCount += 1;
    if (change < 0) acc.downCount += 1;
    if (change === 0) acc.flatCount += 1;
    if (change >= 9.8) acc.limitUpCount += 1;
    if (change <= -9.8) acc.limitDownCount += 1;
    return acc;
  }, { upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: rows.length, status: "东方财富宽度", source: "东方财富宽度" });
}

async function fetchSinaMarketBreadth(diagnostics = []) {
  const totalRaw = await fetchText(`${sinaMarketCenterApi}/Market_Center.getHQNodeStockCount?node=hs_a`, "新浪财经宽度", { Referer: "https://finance.sina.com.cn/" });
  const total = toNumber(totalRaw.replace(/[^\d.]/g, ""));
  if (!total) throw withMarketSource(new Error("empty stock count"), "新浪财经宽度", "empty");
  const pageSize = 100;
  const totalPages = Math.min(Math.ceil(total / pageSize), 70);
  const pages = [];
  for (let page = 1; page <= totalPages; page += 20) {
    const chunk = Array.from({ length: Math.min(20, totalPages - page + 1) }, (_, index) => page + index);
    const data = await Promise.all(chunk.map((pageNumber) => fetchSinaBreadthPage(pageNumber, pageSize).catch((error) => {
      recordMarketFailure(diagnostics, `新浪财经宽度第${pageNumber}页`, error);
      return [];
    })));
    pages.push(...data.flat());
  }
  if (!pages.length) throw withMarketSource(new Error("empty breadth rows"), "新浪财经宽度", "empty");
  const coverageRatio = pages.length / total;
  if (coverageRatio < 0.85) {
    throw withMarketSource(new Error(`partial breadth rows ${pages.length}/${total}`), "新浪财经宽度", "partial");
  }
  const result = pages.reduce((acc, item) => {
    const change = toNumber(item.changepercent);
    if (change > 0) acc.upCount += 1;
    if (change < 0) acc.downCount += 1;
    if (change === 0) acc.flatCount += 1;
    if (change >= limitThreshold(item.symbol, "up")) acc.limitUpCount += 1;
    if (change <= -limitThreshold(item.symbol, "down")) acc.limitDownCount += 1;
    return acc;
  }, { upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: pages.length, status: "新浪财经宽度", source: "新浪财经宽度" });
  return result;
}

async function fetchSinaBreadthPage(page, pageSize) {
  const url = `${sinaMarketCenterApi}/Market_Center.getHQNodeData?page=${page}&num=${pageSize}&sort=changepercent&asc=0&node=hs_a&symbol=&_s_r_a=init`;
  const text = await fetchText(url, `新浪财经宽度第${page}页`, { Referer: "https://finance.sina.com.cn/" });
  try {
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    throw withMarketSource(error, `新浪财经宽度第${page}页`, "parse-error");
  }
}

async function fetchSinaHotBoards(diagnostics = []) {
  const text = await fetchText(sinaIndustryApi, "新浪行业板块", { Referer: "https://finance.sina.com.cn/" }, "gbk");
  const match = text.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!match) throw withMarketSource(new Error("industry payload not found"), "新浪行业板块", "empty");
  let payload;
  try {
    payload = JSON.parse(match[1]);
  } catch (error) {
    throw withMarketSource(error, "新浪行业板块", "parse-error");
  }
  const rows = Object.values(payload).map((line) => {
    const values = String(line).split(",");
    const turnover = toNumber(values[7]);
    const changePercent = toNumber(values[5]);
    return {
      code: values[0],
      name: values[1],
      stockCount: toNumber(values[2]),
      changePercent,
      turnover,
      capitalFlow: null,
      capitalFlowRatio: null,
      leaderSymbol: values[8],
      leaderChangePercent: toNumber(values[9]),
      leaderName: values[12],
      source: "新浪行业板块",
      composite: changePercent * 2 + Math.min(30, turnover / 1_0000_0000) + Math.min(10, toNumber(values[2]) / 20),
    };
  }).filter((item) => item.name && Number.isFinite(item.changePercent));
  const sorted = rows.sort((a, b) => b.composite - a.composite).slice(0, 12).map((item, index) => ({ ...item, rank: index + 1 }));
  return sorted;
}

async function fetchTencentMarketBreadth() {
  const text = await fetchText("https://stock.gtimg.cn/data/index.php?appn=rank&t=rankash/chr&p=1&o=0&l=6000&v=list_data", "腾讯财经宽度", { Referer: "https://gu.qq.com/" }, "gbk");
  const rows = parseTencentRankRows(text);
  if (!rows.length) throw withMarketSource(new Error("empty rank data"), "腾讯财经宽度", "empty");
  return rows.reduce((acc, item) => {
    const change = toNumber(item.changePercent);
    if (change > 0) acc.upCount += 1;
    if (change < 0) acc.downCount += 1;
    if (change === 0) acc.flatCount += 1;
    if (change >= limitThreshold(item.symbol, "up")) acc.limitUpCount += 1;
    if (change <= -limitThreshold(item.symbol, "down")) acc.limitDownCount += 1;
    return acc;
  }, { upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: rows.length, status: "腾讯财经宽度", source: "腾讯财经宽度" });
}

async function fetchNeteaseMarketBreadth() {
  const text = await fetchText("https://quotes.money.163.com/hs/service/diyrank.php?page=0&query=STYPE:EQA&fields=NO,SYMBOL,NAME,PRICE,PERCENT,UPDOWN,VOLUME,TURNOVER&sort=PERCENT&order=desc&count=6000&type=query", "网易财经宽度", { Referer: "https://quotes.money.163.com/" });
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw withMarketSource(error, "网易财经宽度", "parse-error");
  }
  const rows = Array.isArray(payload?.list) ? payload.list : [];
  if (!rows.length) throw withMarketSource(new Error("empty rank data"), "网易财经宽度", "empty");
  return rows.reduce((acc, item) => {
    const change = toNumber(item.PERCENT);
    if (change > 0) acc.upCount += 1;
    if (change < 0) acc.downCount += 1;
    if (change === 0) acc.flatCount += 1;
    if (change >= limitThreshold(item.SYMBOL, "up")) acc.limitUpCount += 1;
    if (change <= -limitThreshold(item.SYMBOL, "down")) acc.limitDownCount += 1;
    return acc;
  }, { upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: rows.length, status: "网易财经宽度", source: "网易财经宽度" });
}

async function fetchTencentHotBoards() {
  const text = await fetchText("https://stock.gtimg.cn/data/index.php?appn=rank&t=pt012/chr&p=1&o=0&l=80&v=list_data", "腾讯行业板块", { Referer: "https://gu.qq.com/" }, "gbk");
  const rows = parseTencentRankRows(text);
  if (!rows.length) throw withMarketSource(new Error("empty board data"), "腾讯行业板块", "empty");
  return rows.slice(0, 12).map((item, index) => ({
    name: item.name,
    changePercent: item.changePercent,
    turnover: item.turnover,
    capitalFlow: null,
    capitalFlowRatio: null,
    rank: index + 1,
    source: "腾讯行业板块",
  }));
}

async function fetchNeteaseHotBoards() {
  const text = await fetchText("https://quotes.money.163.com/hs/service/diyrank.php?page=0&query=TYPE:HY&fields=NO,SYMBOL,NAME,PRICE,PERCENT,UPDOWN,VOLUME,TURNOVER&sort=PERCENT&order=desc&count=80&type=query", "网易行业板块", { Referer: "https://quotes.money.163.com/" });
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw withMarketSource(error, "网易行业板块", "parse-error");
  }
  const rows = Array.isArray(payload?.list) ? payload.list : [];
  if (!rows.length) throw withMarketSource(new Error("empty board data"), "网易行业板块", "empty");
  return rows.slice(0, 12).map((item, index) => ({
    name: item.NAME,
    changePercent: toNumber(item.PERCENT),
    turnover: toNumber(item.TURNOVER),
    capitalFlow: null,
    capitalFlowRatio: null,
    rank: index + 1,
    source: "网易行业板块",
  })).filter((item) => item.name);
}

function parseTencentRankRows(text = "") {
  const dataMatch = text.match(/data:'([^']*)'/) ?? text.match(/data:"([^"]*)"/);
  const data = dataMatch?.[1] ?? "";
  if (!data.trim()) return [];
  return data.split("^").map((row) => {
    const values = row.split("~");
    return {
      symbol: values[0] ?? values[1] ?? "",
      code: values[1] ?? values[0] ?? "",
      name: values[2] ?? values[1] ?? "",
      price: toNumber(values[3]),
      changePercent: firstFinite(values[5], values[6], values[4]),
      turnover: firstFinite(values[9], values[10], values[11]) * 10000,
    };
  }).filter((item) => item.name);
}

function fetchBreadthPage(page, pageSize, diagnostics = []) {
  const url = `${eastmoneyApi}/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(allAShareFs)}&fields=f3`;
  return fetchJson(url, diagnostics, `东方财富宽度第${page}页`);
}

async function fetchFastNews() {
  const url = `${fastNewsApi}?client=web&biz=web_724&fastColumn=102&sortEnd=0&pageSize=10&req_trace=${Date.now()}`;
  const json = await fetchJson(url, [], "东方财富快讯");
  return Array.isArray(json?.data) ? json.data : [];
}

async function collectTrackedStockData(items) {
  const codes = [...new Set(items.map((item) => item.code ?? item.stockCode).filter(Boolean))];
  const results = await Promise.all(codes.slice(0, 20).map((code) => getStockDetail(code).catch(() => null)));
  return results.filter((result) => result?.data).map((result) => result.data);
}

async function fetchRows(url, diagnostics = [], source = "东方财富") {
  const json = await fetchJson(url, diagnostics, source);
  return json?.data?.diff ?? [];
}

async function fetchJson(url, diagnostics = [], source = "东方财富") {
  const targets = buildEastmoneyUrls(url);
  let lastError;
  for (const target of targets) {
    try {
      const json = await fetchJsonTarget(target, source);
      if (!json?.data) recordMarketEmpty(diagnostics, source, "JSON data为空", target);
      return json;
    } catch (error) {
      lastError = error;
      recordMarketFailure(diagnostics, source, error, target);
    }
  }
  throw lastError;
}

async function fetchJsonTarget(target, source) {
  const text = await fetchText(target, source, { Referer: "https://quote.eastmoney.com/" });
  try {
    return JSON.parse(text);
  } catch (error) {
    throw withMarketSource(error, source, "parse-error");
  }
}

async function fetchText(url, source, headers = {}, encoding = "utf-8") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        ...headers,
      },
    });
    if (!response.ok) throw withMarketSource(new Error(`HTTP ${response.status}`), source, `http-${response.status}`);
    const text = encoding === "utf-8"
      ? await response.text()
      : new TextDecoder(encoding).decode(await response.arrayBuffer());
    if (!text.trim()) throw withMarketSource(new Error("empty response"), source, "empty");
    return text;
  } catch (error) {
    if (error.name === "AbortError") throw withMarketSource(new Error(`timeout ${requestTimeoutMs}ms`), source, "timeout");
    throw withMarketSource(error, source, error.statusType ?? "network-error");
  } finally {
    clearTimeout(timeout);
  }
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

function recordMarketFailure(diagnostics = [], source, error, target = "") {
  const entry = {
    source,
    status: error?.statusType ?? classifyError(error),
    rows: 0,
    parseSuccess: false,
    message: error?.message ?? String(error),
    error: error?.message ?? String(error),
    target: target ? safeUrl(target) : undefined,
  };
  diagnostics.push(entry);
  console.warn(`[market-data] ${entry.source} failed: ${entry.status} ${entry.message}${entry.target ? ` ${entry.target}` : ""}`);
}

function recordMarketSuccess(diagnostics = [], source, rows = 0, extra = {}) {
  const entry = {
    source,
    status: "success",
    rows,
    parseSuccess: true,
    error: "",
    ...extra,
  };
  diagnostics.push(entry);
  console.info(`[market-data] source=${source} status=success rows=${rows} parseSuccess=true`);
}

function recordMarketEmpty(diagnostics = [], source, message = "接口返回为空", target = "") {
  const entry = {
    source,
    status: "empty",
    rows: 0,
    parseSuccess: false,
    message,
    error: message,
    target: target ? safeUrl(target) : undefined,
  };
  diagnostics.push(entry);
  console.warn(`[market-data] source=${source} status=empty rows=0 parseSuccess=false error=${message}${entry.target ? ` target=${entry.target}` : ""}`);
}

function recordMarketAttempt(diagnostics = [], source, stage = "") {
  const entry = {
    source,
    stage,
    status: "attempt",
    rows: 0,
    parseSuccess: false,
    error: "",
  };
  diagnostics.push(entry);
  console.info(`[market-data] source=${source} status=attempt rows=0 parseSuccess=false${stage ? ` stage=${stage}` : ""}`);
}

function withMarketSource(error, source, statusType) {
  error.source = source;
  error.statusType = statusType;
  return error;
}

function classifyError(error = {}) {
  const message = String(error.message ?? error);
  if (/timeout|abort/i.test(message)) return "timeout";
  if (/HTTP 403/.test(message)) return "http-403";
  if (/HTTP 502/.test(message)) return "http-502";
  if (/HTTP \d+/.test(message)) return message.match(/HTTP \d+/)?.[0]?.toLowerCase().replace(" ", "-") ?? "http-error";
  if (/empty/i.test(message)) return "empty";
  return "network-error";
}

function safeUrl(url = "") {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "";
  }
}

function sourceSummary(items = [], fallback = "数据源") {
  const sources = [...new Set(items.map((item) => item.source).filter(Boolean))];
  return sources.length ? sources.join("/") : fallback;
}

function normalizeIndexName(name = "") {
  if (name === "上证指数") return "上证指数";
  if (name === "深证成指") return "深证指数";
  if (name === "创业板指") return "创业板指数";
  return name;
}

function indexNameBySymbol(symbol = "", fallback = "") {
  if (/000001/.test(symbol)) return "上证指数";
  if (/399001/.test(symbol)) return "深证指数";
  if (/399006/.test(symbol)) return "创业板指数";
  return normalizeIndexName(fallback);
}

function firstFinite(...values) {
  for (const value of values) {
    const number = toNumber(value);
    if (number) return number;
  }
  return 0;
}

function limitThreshold(symbol = "", direction = "up") {
  const text = String(symbol);
  if (/^bj/.test(text)) return 29.8;
  if (/^sz30|^sh68/.test(text)) return 19.8;
  return 9.8;
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

function formatCount(value) {
  return value === null || value === undefined ? "数据缺失" : String(value);
}

function calculateMoneyEffect(breadth = {}, boards = [], turnover = 0) {
  const up = toNumber(breadth.upCount);
  const down = toNumber(breadth.downCount);
  const flat = toNumber(breadth.flatCount);
  const total = Math.max(1, up + down + flat);
  const upRatio = up / total;
  const activeBoards = boards.filter((item) => toNumber(item.changePercent) > 1).length;
  const turnoverActive = turnover >= 800000000000;
  if (!up && !down) return { label: "数据不足", basis: "上涨比例、成交额和热点集中度暂未完整返回。" };
  if (upRatio >= 0.58 && turnoverActive && activeBoards >= 4) return { label: "偏强", basis: `上涨比例${Math.round(upRatio * 100)}%，成交活跃，热点板块较集中。` };
  if (upRatio <= 0.42 || activeBoards <= 1) return { label: "偏弱", basis: `上涨比例${Math.round(upRatio * 100)}%，热点扩散不足。` };
  return { label: "分化", basis: `上涨比例${Math.round(upRatio * 100)}%，热点数量${activeBoards}个，适合精选方向。` };
}

function buildSectorSustainability(item = {}) {
  if (toNumber(item.changePercent) >= 2 && toNumber(item.capitalFlow) > 0) return "持续性偏强，但仍需观察成交额和资金流入是否延续。";
  if (toNumber(item.changePercent) >= 1) return "持续性中等，短线热度存在但资金确认不足。";
  return "持续性待确认，当前更多是轮动观察。";
}

function buildSectorRisk(item = {}) {
  if (toNumber(item.changePercent) >= 4) return "短线涨幅较高，容易出现追高和冲高回落风险。";
  return "若成交额缩小或主力资金转弱，板块持续性会下降。";
}

function buildSectorHeatBasis(item = {}) {
  if (item.source === "新浪行业板块") return "新浪行业板块备用源，按涨跌幅、成交额和成分股数量综合排序。";
  if (item.source === "腾讯行业板块") return "腾讯行业板块备用源，按涨跌幅和成交额排序。";
  if (item.source === "网易行业板块") return "网易行业板块备用源，按涨跌幅和成交额排序。";
  return "按东方财富板块涨幅榜排序，并补充成交额与主力资金字段。";
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
