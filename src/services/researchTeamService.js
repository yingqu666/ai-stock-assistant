import { cloudDataApi } from "./cloudService.js";
import { generateRuleBasedAnalysis } from "./aiService.js";
import { getMarketSnapshot } from "./marketService.js";
import { getNewsSnapshot } from "./newsService.js";
import { getInvestmentProfile } from "./investmentProfileService.js";
import { analyzeRisks } from "./riskService.js";
import { getWatchlistSnapshot } from "./stockService.js";

export const researchRoles = [
  { name: "\u5e02\u573a\u5206\u6790\u5e08", responsibility: "\u6307\u6570\u8d70\u52bf\u3001\u6210\u4ea4\u91cf\u3001\u5e02\u573a\u60c5\u7eea\u3001\u6da8\u8dcc\u5bb6\u6570" },
  { name: "\u884c\u4e1a\u5206\u6790\u5e08", responsibility: "\u70ed\u70b9\u884c\u4e1a\u3001\u653f\u7b56\u5f71\u54cd\u3001\u4ea7\u4e1a\u8d8b\u52bf" },
  { name: "\u516c\u53f8\u5206\u6790\u5e08", responsibility: "\u516c\u53f8\u57fa\u672c\u9762\u3001\u8d22\u52a1\u3001\u516c\u544a\u3001\u65b0\u95fb" },
  { name: "\u6280\u672f\u5206\u6790\u5e08", responsibility: "\u8d8b\u52bf\u3001\u6210\u4ea4\u3001\u6ce2\u52a8" },
  { name: "\u98ce\u9669\u5206\u6790\u5e08", responsibility: "\u4f30\u503c\u98ce\u9669\u3001\u884c\u4e1a\u98ce\u9669\u3001\u5e02\u573a\u98ce\u9669" },
  { name: "\u6295\u8d44\u7ecf\u7406AI", responsibility: "\u7efc\u5408\u6240\u6709\u5206\u6790\uff0c\u8f93\u51fa\u6700\u7ec8\u7814\u7a76\u62a5\u544a" },
];

export async function getResearchTeamWorkflow() {
  const input = await buildWorkflowInput();
  try {
    const result = await cloudDataApi.runResearchTeam(input);
    const cloudReport = result.data?.report;
    if (cloudReport) {
      const normalized = normalizeReport(cloudReport, input, normalizeAiSource(result.aiStatus ?? cloudReport.aiStatus ?? cloudReport));
      return { agents: buildLocalAgents(input, normalized), roles: researchRoles, report: normalized, source: normalized.source };
    }
  } catch {
    // fallback below keeps the page usable.
  }
  const report = normalizeReport(generateRuleBasedAnalysis(input), input, "\u672c\u5730\u89c4\u5219fallback");
  return { agents: buildLocalAgents(input, report), roles: researchRoles, report, source: report.source };
}

async function buildWorkflowInput() {
  const [marketData, newsSnapshot, watchlist, investmentProfile] = await Promise.all([
    getMarketSnapshot(),
    getNewsSnapshot(),
    getWatchlistSnapshot(),
    Promise.resolve(getInvestmentProfile()),
  ]);
  const risks = analyzeRisks({ watchlist, newsEvents: newsSnapshot.stockNews, marketData });
  return {
    marketData,
    newsData: newsSnapshot.stockNews,
    stockData: watchlist,
    riskData: risks,
    investmentProfile,
  };
}

function buildLocalAgents(input, report) {
  const market = input.marketData?.marketSentiment ?? {};
  const overview = input.marketData?.marketOverview ?? [];
  const hotSectors = input.marketData?.hotSectors ?? [];
  const stocks = input.stockData ?? [];
  const news = input.newsData ?? [];
  const firstStock = stocks[0] ?? {};
  const financials = firstStock.financials ?? {};
  const announcements = stocks.flatMap((item) => item.announcements ?? []).slice(0, 3);
  const risks = input.riskData ?? [];

  return [
    {
      ...researchRoles[0],
      output: `\u5e02\u573a\u72b6\u6001\uff1a${market.summary ?? report.marketEnvironment}\uff1b\u6da8\u8dcc\u5bb6\u6570\uff1a${market.upCount ?? "\u672a\u77e5"}/${market.downCount ?? "\u672a\u77e5"}\uff1b\u6838\u5fc3\u6307\u6807\uff1a${overview.slice(0, 3).map((item) => `${item.label}${item.change ?? ""}`).join("\u3001") || "\u6682\u65e0"}\u3002`,
    },
    {
      ...researchRoles[1],
      output: `\u70ed\u70b9\u884c\u4e1a\uff1a${hotSectors.map((item) => item.name).slice(0, 5).join("\u3001") || "\u6682\u65e0"}\u3002\u65b0\u95fb\u4f9d\u636e\uff1a${news.slice(0, 3).map((item) => `${item.title}(${item.source ?? "\u65b0\u95fb"})`).join("\uff1b") || "\u6682\u65e0"}\u3002`,
    },
    {
      ...researchRoles[2],
      output: `\u5173\u6ce8\u80a1\u7968\uff1a${stocks.map((item) => `${item.name}${item.changePercent ?? ""}`).slice(0, 4).join("\u3001") || "\u6682\u65e0"}\u3002\u8d22\u52a1\uff1a\u8425\u6536 ${financials.revenue ?? "\u6682\u65e0"}\uff0c\u51c0\u5229\u6da6 ${financials.netProfit ?? "\u6682\u65e0"}\u3002\u516c\u544a\uff1a${announcements.map((item) => item.title).join("\uff1b") || "\u6682\u65e0"}\u3002`,
    },
    {
      ...researchRoles[3],
      output: `\u6280\u672f\u89c2\u5bdf\uff1a\u5173\u6ce8\u6210\u4ea4\u989d\u3001\u6da8\u8dcc\u5e45\u548c\u6362\u624b\u7387\u7684\u5339\u914d\u3002${firstStock.name ? `${firstStock.name}\u6da8\u8dcc\u5e45 ${firstStock.changePercent ?? "\u6682\u65e0"}\uff0c\u6210\u4ea4\u989d ${firstStock.amount ?? "\u6682\u65e0"}\u3002` : ""}`,
    },
    {
      ...researchRoles[4],
      output: `\u98ce\u9669\u56e0\u7d20\uff1a${(report.riskFactors ?? report.risks ?? []).join("\uff1b") || risks.map((item) => item.message ?? item.title).join("\uff1b") || "\u6682\u65e0\u660e\u786e\u98ce\u9669\u4fe1\u53f7"}\u3002`,
    },
    {
      ...researchRoles[5],
      output: `\u7efc\u5408\u7ed3\u8bba\uff1a${report.observationAdvice}\u3002\u672c\u7ed3\u8bba\u53ea\u7528\u4e8e\u7814\u7a76\u89c2\u5bdf\uff0c\u4e0d\u4ee3\u8868\u786e\u5b9a\u4e70\u5356\u6216\u6536\u76ca\u627f\u8bfa\u3002`,
    },
  ];
}

function normalizeReport(report, input, source) {
  const opportunities = asArray(report.opportunities);
  const risks = asArray(report.risks);
  return {
    marketEnvironment: report.marketEnvironment ?? report.marketSummary ?? input.marketData?.marketSentiment?.summary ?? "\u5e02\u573a\u9700\u7ee7\u7eed\u89c2\u5bdf",
    coreOpportunities: report.coreOpportunities ?? report.industryAnalysis ?? opportunities.join("\u3001") ?? "\u5173\u6ce8\u4e3b\u7ebf\u6301\u7eed\u6027",
    keyFocus: report.keyFocus ?? report.stockAnalysis ?? "\u5173\u6ce8\u81ea\u9009\u80a1\u516c\u544a\u3001\u8d22\u52a1\u548c\u65b0\u95fb\u53d8\u5316",
    riskFactors: report.riskFactors ?? risks,
    observationAdvice: report.observationAdvice ?? asArray(report.tomorrowPlan).join("\uff1b") ?? "\u7b49\u5f85\u6570\u636e\u8fdb\u4e00\u6b65\u786e\u8ba4",
    evidence: report.evidence ?? report.conclusionBasis ?? {},
    source,
  };
}

function normalizeAiSource(status = {}) {
  const source = status.source ?? status.aiStatus?.source;
  if (source === "deepseek") return "deepseek";
  if (source === "openai" || source === "ai-api") return source;
  return "fallback";
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [String(value)];
}
