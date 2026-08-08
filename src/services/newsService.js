import { DATA_MODE } from "../config/dataSources.js";
import { news, riskAlerts, stockNews } from "../data.js";
import { addLog } from "./logService.js";

const noticeApi = "https://np-anotice-stock.eastmoney.com/api/security/ann";
const fastNewsApi = "https://np-listapi.eastmoney.com/comm/web/getFastNews";
const trackedStocks = ["600176", "600519", "300750", "301396", "688981", "512760"];

export const newsProviders = [
  { key: "eastmoney_notice", name: "\u4e1c\u65b9\u8d22\u5bcc\u516c\u544a", enabled: true, type: "\u516c\u544a" },
  { key: "eastmoney_fast", name: "\u4e1c\u65b9\u8d22\u5bcc\u5feb\u8baf", enabled: true, type: "\u8d22\u7ecf\u65b0\u95fb" },
  { key: "cninfo", name: "\u5de8\u6f6e\u8d44\u8baf", enabled: false, type: "\u516c\u544a/\u8d22\u62a5\u9884\u7559" },
  { key: "cls", name: "\u8d22\u8054\u793e", enabled: false, type: "\u5e02\u573a\u65b0\u95fb\u9884\u7559" },
  { key: "chinanews", name: "\u4e2d\u56fd\u65b0\u95fb\u7f51", enabled: false, type: "\u653f\u7b56\u65b0\u95fb\u9884\u7559" },
];

export async function getNewsSnapshot() {
  if (DATA_MODE !== "real") {
    return buildFallbackSnapshot("\u6a21\u62df\u65b0\u95fb");
  }

  try {
    const [announcements, fastNews] = await Promise.all([
      fetchAnnouncements(trackedStocks).catch((error) => {
        logNewsFailure("announcement", error);
        return [];
      }),
      fetchFastNews().catch((error) => {
        logNewsFailure("fastNews", error);
        return [];
      }),
    ]);
    const realNews = [...announcements, ...fastNews];
    if (!realNews.length) return buildFallbackSnapshot("\u6a21\u62df\u65b0\u95fb\u56de\u9000");

    return {
      news: realNews.slice(0, 6),
      riskAlerts,
      stockNews: realNews,
      updatedAt: formatNow(),
      source: "\u4e1c\u65b9\u8d22\u5bcc\u516c\u544a/\u5feb\u8baf",
      dataStatus: announcements.length && fastNews.length ? "\u771f\u5b9e\u6570\u636e" : "\u90e8\u5206\u771f\u5b9e",
      providers: newsProviders,
    };
  } catch (error) {
    logNewsFailure("snapshot", error);
    return buildFallbackSnapshot("\u6a21\u62df\u65b0\u95fb\u56de\u9000");
  }
}

export async function getStockNews(code) {
  const snapshot = await getNewsSnapshot();
  const keyword = String(code ?? "");
  const related = snapshot.stockNews.filter((item) => item.relatedStock === keyword
    || item.relatedStock === "A\u80a1"
    || item.relatedStock === "\u5e02\u573a"
    || (item.relatedStocks ?? []).includes(keyword));
  return related.length ? related : snapshot.stockNews.slice(0, 5);
}

export function analyzeNewsImpact(title) {
  const text = String(title ?? "");
  const positiveWords = ["\u589e\u957f", "\u4e2d\u6807", "\u56de\u8d2d", "\u589e\u6301", "\u76c8\u5229", "\u7a81\u7834", "\u5229\u597d", "\u9700\u6c42", "\u4e0a\u8c03", "\u6269\u4ea7"];
  const negativeWords = ["\u51cf\u6301", "\u4e8f\u635f", "\u4e0b\u6ed1", "\u5904\u7f5a", "\u98ce\u9669", "\u7ec8\u6b62", "\u8bc9\u8bbc", "\u9000\u5e02", "\u4e0b\u964d"];
  const target = inferImpactTarget(text);

  if (positiveWords.some((word) => text.includes(word))) return { direction: "\u5229\u597d", target, credibility: "\u4e2d" };
  if (negativeWords.some((word) => text.includes(word))) return { direction: "\u5229\u7a7a", target, credibility: "\u4e2d" };
  return { direction: "\u4e2d\u6027", target, credibility: "\u4e2d" };
}

async function fetchAnnouncements(codes) {
  const url = `${noticeApi}?sr=-1&page_size=12&page_index=1&ann_type=A&client_source=web&stock_list=${codes.join(",")}`;
  const json = await fetchJson(url);
  const rows = json?.data?.list ?? [];
  return rows.map(normalizeAnnouncement);
}

async function fetchFastNews() {
  const url = `${fastNewsApi}?client=web&biz=web_724&fastColumn=102&sortEnd=0&pageSize=8&req_trace=${Date.now()}`;
  const json = await fetchJson(url);
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(normalizeFastNews);
}

function normalizeAnnouncement(item) {
  const firstCode = item.codes?.[0];
  const title = item.title ?? "\u516c\u53f8\u516c\u544a";
  const analysis = analyzeNewsImpact(title);
  const relatedStock = firstCode?.stock_code ?? "A\u80a1";
  return {
    title,
    source: "\u4e1c\u65b9\u8d22\u5bcc\u516c\u544a",
    time: item.notice_date?.slice(0, 16) ?? "\u672a\u77e5\u65f6\u95f4",
    link: item.art_code ? `https://data.eastmoney.com/notices/detail/${relatedStock}/${item.art_code}.html` : "",
    relatedStock,
    relatedStocks: (item.codes ?? []).map((code) => code.stock_code).filter(Boolean),
    relatedIndustry: analysis.target,
    category: classifyAnnouncement(title),
    impact: analysis.direction,
    target: "\u4e2a\u80a1",
    credibility: { level: analysis.credibility, reason: "\u516c\u544a\u6807\u9898\u89c4\u5219\u5206\u7c7b\uff0c\u9700\u7ed3\u5408\u6b63\u6587\u590d\u6838" },
  };
}

function normalizeFastNews(item) {
  const title = item.title ?? "\u8d22\u7ecf\u65b0\u95fb";
  const analysis = analyzeNewsImpact(title);
  return {
    title,
    source: item.mediaName ?? "\u4e1c\u65b9\u8d22\u5bcc\u5feb\u8baf",
    time: item.showTime ?? "\u672a\u77e5\u65f6\u95f4",
    link: item.url ?? item.shareUrl ?? "",
    relatedStock: "\u5e02\u573a",
    relatedStocks: [],
    relatedIndustry: analysis.target,
    category: classifyMarketNews(title),
    impact: analysis.direction,
    target: analysis.target === "\u5e02\u573a" ? "\u5e02\u573a" : "\u884c\u4e1a",
    credibility: { level: "\u4e2d", reason: "\u5feb\u8baf\u6765\u6e90\uff0c\u9700\u7b49\u5f85\u516c\u544a\u6216\u6743\u5a01\u62a5\u9053\u9a8c\u8bc1" },
  };
}

function classifyAnnouncement(title) {
  if (/财报|年度报告|季度报告|半年报|业绩|预告/.test(title)) return "\u8d22\u62a5";
  if (/股东|减持|增持/.test(title)) return "\u80a1\u4e1c\u53d8\u5316";
  if (/回购/.test(title)) return "\u56de\u8d2d";
  if (/重大|停牌|收购|重组|合同|中标/.test(title)) return "\u91cd\u5927\u4e8b\u9879";
  return "\u516c\u53f8\u516c\u544a";
}

function classifyMarketNews(title) {
  if (/政策|国务院|证监会|发改委|工信部/.test(title)) return "\u653f\u7b56\u65b0\u95fb";
  if (/行业|产业|需求|订单|服务器|芯片|算力|半导体/.test(title)) return "\u884c\u4e1a\u65b0\u95fb";
  return "\u5e02\u573a\u70ed\u70b9";
}

function inferImpactTarget(title) {
  if (/AI|算力|服务器|光模块/.test(title)) return "\u7b97\u529b\u677f\u5757";
  if (/半导体|芯片/.test(title)) return "\u534a\u5bfc\u4f53\u884c\u4e1a";
  if (/新能源|光伏|储能|电力/.test(title)) return "\u65b0\u80fd\u6e90/\u7535\u529b\u884c\u4e1a";
  if (/消费|白酒/.test(title)) return "\u6d88\u8d39\u884c\u4e1a";
  return "\u5e02\u573a";
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildFallbackSnapshot(source) {
  return {
    news,
    riskAlerts,
    stockNews,
    updatedAt: formatNow(),
    source,
    dataStatus: "\u6a21\u62df\u6570\u636e",
    providers: newsProviders,
  };
}

function logNewsFailure(module, error) {
  addLog({
    module: "news",
    status: "failed",
    mode: "real-fallback",
    source: module,
    message: "\u771f\u5b9e\u65b0\u95fb\u83b7\u53d6\u5931\u8d25\uff0c\u5df2\u4fdd\u7559fallback",
    error: error.message,
  });
}

function formatNow() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
