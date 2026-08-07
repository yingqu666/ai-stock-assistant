import { getMarketSnapshot } from "./marketService.js";
import { getNewsSnapshot } from "./newsService.js";
import { getPortfolioSummary } from "./portfolioService.js";
import { analyzeRisks } from "./riskService.js";
import { getWatchlistSnapshot } from "./stockService.js";

export async function getRiskDashboardData() {
  const [marketData, newsSnapshot, watchlist, portfolio] = await Promise.all([
    getMarketSnapshot(),
    getNewsSnapshot(),
    getWatchlistSnapshot(),
    getPortfolioSummary(),
  ]);
  const signals = analyzeRisks({ watchlist, newsEvents: newsSnapshot.stockNews, marketData });
  const score = Math.min(100, 35 + signals.length * 12 + (portfolio.returnRate < 0 ? 15 : 0));

  return {
    score,
    currentRisks: {
      market: marketData.marketSentiment.riskLevel,
      industry: signals.find((item) => item.type.includes("新闻"))?.message ?? "行业风险中等，关注政策和成交变化。",
      stock: signals.find((item) => item.type.includes("股票"))?.message ?? "个股暂无极端风险信号。",
      portfolio: portfolio.returnRate < 0 ? "组合浮亏，需要检查仓位集中度。" : "组合风险可控，继续跟踪集中度。",
    },
    signals,
    trend: [42, 48, 51, 45, score],
  };
}
