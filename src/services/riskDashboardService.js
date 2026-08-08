import { getIndustryResearchData } from "./industryService.js";
import { getMarketSnapshot } from "./marketService.js";
import { getNewsSnapshot } from "./newsService.js";
import { getPortfolioSummary } from "./portfolioService.js";
import { analyzeRisks } from "./riskService.js";
import { queryStock, getWatchlistSnapshot } from "./stockService.js";

export async function getRiskDashboardData({ targetType = "行业", target = "半导体" } = {}) {
  const [marketData, newsSnapshot, watchlist, portfolio] = await Promise.all([
    getMarketSnapshot(),
    getNewsSnapshot(),
    getWatchlistSnapshot(),
    getPortfolioSummary(),
  ]);
  const signals = analyzeRisks({ watchlist, newsEvents: newsSnapshot.stockNews, marketData });

  if (targetType === "市场") return buildMarketRisk({ marketData, signals, portfolio });
  if (targetType === "个股") return buildStockRisk({ target, marketData, signals, portfolio });
  return buildIndustryRisk({ target, marketData, signals, portfolio });
}

function buildMarketRisk({ marketData, signals, portfolio }) {
  const sentiment = marketData.marketSentiment ?? {};
  const score = clamp(40 + signals.length * 8 + (portfolio.concentrationRisk?.score ?? 0) * 0.2);
  return {
    targetType: "市场",
    target: "A股市场",
    trend: sentiment.summary ?? "震荡",
    score,
    scoreLevel: score > 70 ? "偏高" : score > 45 ? "中等" : "可控",
    drivers: ["指数涨跌", "成交额变化", "涨跌家数", "热点持续性"],
    risks: ["成交不足", "热点轮动过快", "外部市场扰动"],
    signals,
    trendData: [42, 48, 51, 46, 55, score],
    credibility: { level: "中", reason: "行情数据可用，部分新闻或公告可能回退。", sources: ["东方财富行情", "新闻接口", "riskService"] },
  };
}

function buildIndustryRisk({ target, signals, portfolio }) {
  const industry = getIndustryResearchData(target);
  const score = clamp(45 + industry.risks.length * 6 + (target === "半导体" ? 8 : 0));
  return {
    targetType: "行业",
    target: industry.industry,
    trend: industry.trend,
    score,
    scoreLevel: score > 70 ? "偏高" : score > 45 ? "中等" : "可控",
    drivers: industry.chain.slice(0, 3).flatMap((item) => item.catalysts).slice(0, 4),
    risks: industry.chain[0]?.risks ?? industry.news.map((item) => item.risk),
    signals,
    trendData: [44, 49, 57, 62, 58, score],
    credibility: industry.credibility,
    portfolioExposure: portfolio.industryAllocation.find((item) => item.industry.includes(target))?.weight ?? 0,
  };
}

async function buildStockRisk({ target, marketData, signals }) {
  const stock = await queryStock(target || "600176");
  const change = Number(String(stock.changePercent ?? "").replace("%", "").replace("+", "")) || 0;
  const score = clamp(42 + Math.abs(change) * 4 + (stock.assetType === "ETF" ? 5 : 12));
  return {
    targetType: "个股",
    target: `${stock.name} ${stock.code}`,
    trend: change > 1 ? "上涨" : change < -1 ? "下降" : "震荡",
    score,
    scoreLevel: score > 70 ? "偏高" : score > 45 ? "中等" : "可控",
    drivers: [`涨跌幅 ${stock.changePercent ?? "暂无"}`, `成交额 ${stock.amount ?? "暂无"}`, `所属行业 ${stock.industry ?? "待补充"}`],
    risks: stock.riskTips ?? ["短期波动", "行业变化", "事件风险"],
    signals,
    trendData: [38, 45, 48, 53, 50, score],
    credibility: { level: stock.dataStatus === "真实数据" ? "高" : "中", reason: `行情来源 ${stock.dataSource ?? "stockService"}，状态 ${stock.dataStatus ?? "部分真实"}`, sources: ["东方财富行情", "公司公告", "AI分析"] },
    marketState: marketData.marketSentiment?.summary ?? "市场待观察",
  };
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
