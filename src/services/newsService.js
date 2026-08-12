import { DATA_MODE } from "../config/dataSources.js";
import { news, riskAlerts, stockNews } from "../data.js";
import { addLog } from "./logService.js";

const noticeApi = "https://np-anotice-stock.eastmoney.com/api/security/ann";
const fastNewsApi = "https://np-listapi.eastmoney.com/comm/web/getFastNews";
const trackedStocks = ["600176", "600519", "300750", "301396", "688981", "512760", "515050", "515980"];

export const newsProviders = [
  { key: "eastmoney_notice", name: "东方财富公告", enabled: true, type: "公告" },
  { key: "eastmoney_fast", name: "东方财富快讯", enabled: true, type: "财经新闻" },
  { key: "cninfo", name: "巨潮资讯", enabled: false, type: "公告/财报接口预留" },
  { key: "cls", name: "财联社", enabled: false, type: "市场新闻接口预留" },
  { key: "chinanews", name: "中国新闻网", enabled: false, type: "政策新闻接口预留" },
];

export async function getNewsSnapshot() {
  if (DATA_MODE !== "real") return buildFallbackSnapshot("本地备用新闻");

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
    if (!realNews.length) return buildFallbackSnapshot("新闻接口未返回，使用本地备用新闻");

    return {
      news: realNews.slice(0, 8),
      riskAlerts,
      stockNews: realNews,
      updatedAt: formatNow(),
      source: "东方财富公告/快讯",
      dataStatus: announcements.length && fastNews.length ? "真实数据" : "部分真实",
      providers: newsProviders,
    };
  } catch (error) {
    logNewsFailure("snapshot", error);
    return buildFallbackSnapshot("新闻接口异常，使用本地备用新闻");
  }
}

export async function getStockNews(code) {
  const snapshot = await getNewsSnapshot();
  const keyword = String(code ?? "");
  const related = snapshot.stockNews.filter((item) => item.relatedStock === keyword
    || item.relatedStock === "A股"
    || item.relatedStock === "市场"
    || (item.relatedStocks ?? []).includes(keyword));
  return related.length ? related : snapshot.stockNews.slice(0, 5);
}

export function analyzeNewsImpact(title) {
  const text = String(title ?? "");
  const positiveWords = ["增长", "中标", "回购", "增持", "盈利", "突破", "利好", "需求", "上调", "扩产"];
  const negativeWords = ["减持", "亏损", "下滑", "处罚", "风险", "终止", "诉讼", "退市", "下降"];
  const target = inferImpactTarget(text);

  if (positiveWords.some((word) => text.includes(word))) return { direction: "利好", target, credibility: "中" };
  if (negativeWords.some((word) => text.includes(word))) return { direction: "利空", target, credibility: "中" };
  return { direction: "中性", target, credibility: "中" };
}

async function fetchAnnouncements(codes) {
  const url = `${noticeApi}?sr=-1&page_size=12&page_index=1&ann_type=A&client_source=web&stock_list=${codes.join(",")}`;
  const json = await fetchJson(url);
  const rows = json?.data?.list ?? [];
  return rows.map(normalizeAnnouncement);
}

async function fetchFastNews() {
  const url = `${fastNewsApi}?client=web&biz=web_724&fastColumn=102&sortEnd=0&pageSize=12&req_trace=${Date.now()}`;
  const json = await fetchJson(url);
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(normalizeFastNews);
}

function normalizeAnnouncement(item) {
  const firstCode = item.codes?.[0];
  const title = item.title ?? "公司公告";
  const analysis = analyzeNewsImpact(title);
  const relatedStock = firstCode?.stock_code ?? "A股";
  return {
    title,
    source: "东方财富公告",
    time: item.notice_date?.slice(0, 16) ?? formatNow(),
    link: item.art_code ? `https://data.eastmoney.com/notices/detail/${relatedStock}/${item.art_code}.html` : "",
    relatedStock,
    relatedStocks: (item.codes ?? []).map((code) => code.stock_code).filter(Boolean),
    relatedIndustry: analysis.target,
    relatedIndustries: inferRelatedIndustries(title, analysis.target),
    category: classifyAnnouncement(title),
    impact: analysis.direction,
    target: "个股",
    credibility: { level: analysis.credibility, reason: "公告标题规则分类，需结合正文复核" },
  };
}

function normalizeFastNews(item) {
  const title = item.title ?? "财经新闻";
  const analysis = analyzeNewsImpact(title);
  return {
    title,
    source: item.mediaName ?? "东方财富快讯",
    time: item.showTime ?? formatNow(),
    link: item.url ?? item.shareUrl ?? "",
    relatedStock: "市场",
    relatedStocks: [],
    relatedIndustry: analysis.target,
    relatedIndustries: inferRelatedIndustries(title, analysis.target),
    category: classifyMarketNews(title),
    impact: analysis.direction,
    target: analysis.target === "市场" ? "市场" : "行业",
    credibility: { level: "中", reason: "快讯来源，需等待公告或权威报道验证" },
  };
}

function classifyAnnouncement(title) {
  if (/财报|年度报告|季度报告|半年报|业绩|预告/.test(title)) return "财报";
  if (/股东|减持|增持/.test(title)) return "股东变化";
  if (/回购/.test(title)) return "回购";
  if (/重大|停牌|收购|重组|合同|中标/.test(title)) return "重大事项";
  return "公司公告";
}

function classifyMarketNews(title) {
  if (/政策|国务院|证监会|发改委|工信部/.test(title)) return "政策新闻";
  if (/行业|产业|需求|订单|服务器|芯片|算力|半导体|光模块|储能|电力/.test(title)) return "行业新闻";
  return "市场热点";
}

function inferImpactTarget(title) {
  if (/AI|人工智能|算力|服务器/.test(title)) return "算力板块";
  if (/光模块|光通信/.test(title)) return "光模块";
  if (/半导体|芯片/.test(title)) return "半导体行业";
  if (/新能源|光伏|储能|电力|电网/.test(title)) return "新能源/电力行业";
  if (/消费|白酒/.test(title)) return "消费行业";
  return "市场";
}

function inferRelatedIndustries(title, target) {
  const related = [target].filter(Boolean);
  if (/AI|人工智能|算力|芯片|服务器/.test(title)) related.push("半导体", "光模块", "算力", "电力");
  if (/半导体|芯片/.test(title)) related.push("半导体", "芯片ETF");
  if (/光模块|通信|5G/.test(title)) related.push("光模块", "通信");
  if (/电力|储能|电网/.test(title)) related.push("电力", "储能");
  return [...new Set(related)];
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
    dataStatus: "备用数据",
    providers: newsProviders,
  };
}

function logNewsFailure(module, error) {
  addLog({
    module: "news",
    status: "failed",
    mode: "local-backup",
    source: module,
    message: "真实新闻获取失败，保留本地备用新闻",
    error: error.message,
  });
}

function formatNow() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
