import { DATA_MODE } from "../config/dataSources.js";
import { news, riskAlerts, stockNews } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addLog } from "./logService.js";

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
    const result = await cloudDataApi.getNewsSnapshot();
    const snapshot = result.data ?? result;
    const realNews = [...(snapshot.stockNews ?? []), ...(snapshot.news ?? [])];
    if (!realNews.length) return buildFallbackSnapshot(snapshot.source ?? "新闻接口未返回");
    return {
      news: snapshot.news ?? realNews.slice(0, 8),
      riskAlerts: snapshot.riskAlerts ?? riskAlerts,
      stockNews: snapshot.stockNews ?? realNews,
      updatedAt: snapshot.updatedAt ?? formatNow(),
      source: snapshot.source ?? "后端新闻聚合",
      dataStatus: snapshot.dataStatus ?? "部分真实",
      providers: snapshot.providers ?? newsProviders,
      diagnostics: snapshot.diagnostics ?? [],
    };
  } catch (error) {
    logNewsFailure("snapshot", error);
    return buildFallbackSnapshot(`后端新闻接口异常：${error.message}`);
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

function inferImpactTarget(title) {
  if (/AI|人工智能|算力|服务器/.test(title)) return "算力板块";
  if (/光模块|光通信/.test(title)) return "光模块";
  if (/半导体|芯片/.test(title)) return "半导体行业";
  if (/新能源|光伏|储能|电力|电网/.test(title)) return "新能源/电力行业";
  if (/消费|白酒/.test(title)) return "消费行业";
  return "市场";
}

function buildFallbackSnapshot(source) {
  const useLocalFallback = DATA_MODE !== "real";
  return {
    news: useLocalFallback ? news : [],
    riskAlerts,
    stockNews: useLocalFallback ? stockNews : [],
    updatedAt: formatNow(),
    source,
    dataStatus: useLocalFallback ? "备用数据" : "数据不足",
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
