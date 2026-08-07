import { DATA_MODE } from "../config/dataSources.js";
import { news, riskAlerts, stockNews } from "../data.js";

const noticeApi = "https://np-anotice-stock.eastmoney.com/api/security/ann";
const fastNewsApi = "https://np-listapi.eastmoney.com/comm/web/getFastNews";
const trackedStocks = ["600519", "300750", "301396", "688981"];

export async function getNewsSnapshot() {
  if (DATA_MODE !== "real") {
    return { news, riskAlerts, stockNews, updatedAt: formatNow(), source: "模拟新闻" };
  }

  try {
    const [announcements, fastNews] = await Promise.all([
      fetchAnnouncements(trackedStocks),
      fetchFastNews(),
    ]);
    const realNews = [...announcements, ...fastNews];
    return {
      news,
      riskAlerts,
      stockNews: realNews.length ? realNews : stockNews,
      updatedAt: formatNow(),
      source: realNews.length ? "东方财富公告/快讯" : "模拟新闻",
    };
  } catch (error) {
    console.warn("真实新闻获取失败，已回退模拟新闻：", error);
    return { news, riskAlerts, stockNews, updatedAt: formatNow(), source: "模拟新闻回退" };
  }
}

export async function getStockNews(code) {
  const snapshot = await getNewsSnapshot();
  return snapshot.stockNews.filter((item) => item.relatedStock === code || item.relatedStock === "A股" || item.relatedStock === "市场");
}

async function fetchAnnouncements(codes) {
  const url = `${noticeApi}?sr=-1&page_size=12&page_index=1&ann_type=A&client_source=web&stock_list=${codes.join(",")}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`公告 HTTP ${response.status}`);
  const json = await response.json();
  const rows = json?.data?.list ?? [];
  return rows.map(normalizeAnnouncement);
}

async function fetchFastNews() {
  const url = `${fastNewsApi}?client=web&biz=web_724&fastColumn=102&sortEnd=0&pageSize=8&req_trace=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`快讯 HTTP ${response.status}`);
  const json = await response.json();
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(normalizeFastNews);
}

function normalizeAnnouncement(item) {
  const firstCode = item.codes?.[0];
  const title = item.title ?? "公司公告";
  const analysis = analyzeNewsImpact(title);
  return {
    title,
    source: "东方财富公告",
    time: item.notice_date?.slice(0, 16) ?? "未知时间",
    relatedStock: firstCode?.stock_code ?? "A股",
    category: classifyAnnouncement(title),
    impact: analysis.direction,
    target: analysis.target,
  };
}

function normalizeFastNews(item) {
  const title = item.title ?? "财经新闻";
  const analysis = analyzeNewsImpact(title);
  return {
    title,
    source: item.mediaName ?? "东方财富快讯",
    time: item.showTime ?? "未知时间",
    relatedStock: "市场",
    category: classifyMarketNews(title),
    impact: analysis.direction,
    target: analysis.target,
  };
}

function classifyAnnouncement(title) {
  if (title.includes("财报") || title.includes("年度报告") || title.includes("季度报告")) return "财报";
  if (title.includes("股东") || title.includes("减持") || title.includes("增持")) return "股东变化";
  if (title.includes("重大") || title.includes("停牌") || title.includes("收购")) return "重大事项";
  return "公司公告";
}

function classifyMarketNews(title) {
  if (title.includes("政策") || title.includes("国务院") || title.includes("证监会")) return "政策新闻";
  if (title.includes("行业") || title.includes("产业") || title.includes("需求")) return "行业新闻";
  return "市场热点";
}

export function analyzeNewsImpact(title) {
  const positiveWords = ["增长", "中标", "回购", "增持", "盈利", "突破", "利好", "需求", "上调", "扩产"];
  const negativeWords = ["减持", "亏损", "下滑", "处罚", "风险", "终止", "诉讼", "退市", "下降"];
  const target = inferImpactTarget(title);

  if (positiveWords.some((word) => title.includes(word))) return { direction: "利好", target };
  if (negativeWords.some((word) => title.includes(word))) return { direction: "利空", target };
  return { direction: "中性", target };
}

function inferImpactTarget(title) {
  if (title.includes("AI") || title.includes("算力") || title.includes("服务器")) return "算力板块";
  if (title.includes("半导体") || title.includes("芯片")) return "半导体行业";
  if (title.includes("新能源") || title.includes("光伏") || title.includes("储能")) return "新能源行业";
  if (title.includes("消费") || title.includes("白酒")) return "消费行业";
  return "市场";
}

function formatNow() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
