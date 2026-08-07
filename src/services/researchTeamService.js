import { aiTeam } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { generateRuleBasedAnalysis } from "./aiService.js";
import { getMarketSnapshot } from "./marketService.js";
import { getNewsSnapshot } from "./newsService.js";
import { analyzeRisks } from "./riskService.js";
import { getWatchlistSnapshot } from "./stockService.js";

export async function getResearchTeamWorkflow() {
  const input = await buildWorkflowInput();

  try {
    const result = await cloudDataApi.runResearchTeam(input);
    return {
      ...result.data,
      roles: aiTeam,
      source: result.data?.report?.source === "ai-api" ? "真实AI接口" : "云端fallback",
    };
  } catch {
    const report = generateRuleBasedAnalysis(input);
    return {
      agents: buildLocalAgents(input, report),
      roles: aiTeam,
      report,
      source: "本地规则fallback",
    };
  }
}

async function buildWorkflowInput() {
  const [marketData, newsSnapshot, watchlist] = await Promise.all([
    getMarketSnapshot(),
    getNewsSnapshot(),
    getWatchlistSnapshot(),
  ]);

  const risks = analyzeRisks({
    watchlist,
    newsEvents: newsSnapshot.stockNews,
    marketData,
  });

  return {
    marketData,
    newsData: newsSnapshot.stockNews,
    stockData: watchlist,
    riskData: risks,
    investmentProfile: {
      industries: ["AI算力", "半导体", "新能源"],
      riskLevel: "中",
    },
  };
}

function buildLocalAgents(input, report) {
  return [
    { name: "市场分析师", responsibility: "指数、成交量、市场情绪", output: input.marketData.marketSentiment.summary },
    { name: "行业分析师", responsibility: "热点行业、产业链、政策影响", output: report.industryAnalysis },
    { name: "公司分析师", responsibility: "公告、财报、业务变化", output: report.stockAnalysis },
    { name: "技术分析师", responsibility: "趋势、成交、波动", output: "观察指数位置、成交额变化和热点延续性；不输出交易指令。" },
    { name: "风险分析师", responsibility: "风险因素", output: report.risks.join("；") },
    { name: "投资经理AI", responsibility: "综合所有分析", output: report.coreLogic },
  ];
}
