import { opportunities, reportHistory } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addLog } from "./logService.js";

const aiConfigKey = "ai-investment-ai-config";

export function getAiConfig() {
  try {
    return JSON.parse(window.localStorage.getItem(aiConfigKey) ?? "{}");
  } catch {
    return {};
  }
}

export async function getAiStatus() {
  try {
    const result = await cloudDataApi.getAiStatus();
    const data = result.data ?? {};
    return {
      ...data,
      connected: data.mode === "api" && data.hasApiKey,
      label: data.mode === "api" ? "API模式" : "Fallback模式",
      message: data.mode === "api" ? "服务端API配置已检测" : "当前使用规则fallback",
    };
  } catch (error) {
    return { mode: "fallback", provider: "local", connected: false, label: "Fallback模式", message: error.message };
  }
}

export function saveAiConfig(config) {
  const clean = {
    mode: config.mode ?? "fallback",
    provider: config.provider ?? "openai-compatible",
    endpoint: config.endpoint ?? "",
    model: config.model ?? "",
    hasApiKey: Boolean(config.apiKey),
  };
  try {
    const current = getAiConfig();
    window.localStorage.setItem(aiConfigKey, JSON.stringify({ ...current, ...clean, apiKey: config.apiKey || current.apiKey || "" }));
  } catch {
    // AI config is optional in the browser.
  }
  return clean;
}

export function buildAiResearchInput({ marketData, stockQuote, newsEvents, riskData = [], investmentProfile, historicalReports = [], portfolio = [], aiHistory = [] }) {
  return {
    marketData,
    stockData: stockQuote,
    newsData: newsEvents,
    riskData,
    portfolio,
    investmentProfile,
    historyReports: historicalReports,
    aiHistory,
    aiInputSummary: buildInputSummary({ marketData, stockQuote, newsEvents, riskData, investmentProfile, historicalReports, portfolio, aiHistory }),
  };
}

export function buildPrompt(input) {
  return JSON.stringify(
    {
      task: "生成A股投资研究报告",
      rules: ["不输出确定买卖建议", "每个结论必须附依据来源", "没有数据支持时明确说明数据不足", "输出结构化JSON"],
      template: ["市场环境判断", "当前主线", "热点行业分析", "我的股票影响", "风险因素", "明日观察"],
      input,
    },
    null,
    2,
  );
}

export async function generateAiAnalysis(input) {
  try {
    const result = await cloudDataApi.generateAiReport(input);
    return normalizeAiOutput(result.report ?? result.data?.content ?? {}, input, "云端AI");
  } catch (error) {
    addAiLog("AI报告云端生成失败", error);
    return generateRuleBasedAnalysis(input);
  }
}

export async function testAiConnection(config) {
  if (config.mode !== "api") return { ok: true, message: "当前为 fallback 模式，无需测试 API。" };
  if (!config.endpoint || !config.apiKey) return { ok: false, message: "请填写 API 地址和 Key。" };

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model || "gpt-4.1-mini",
        messages: [{ role: "user", content: "请回复：AI连接成功" }],
        temperature: 0,
      }),
    });
    if (!response.ok) return { ok: false, message: `AI连接失败：HTTP ${response.status}` };
    return { ok: true, message: "AI连接成功。" };
  } catch (error) {
    return { ok: false, message: `AI连接失败：${error.message}` };
  }
}

export async function answerInvestmentQuestion(question, context) {
  try {
    const result = await cloudDataApi.askAi({ question, context });
    return {
      question,
      answer: formatCloudAnswer(result.data),
      raw: result.data,
      source: result.data?.source === "ai-api" ? "真实AI接口" : "规则fallback",
      context,
    };
  } catch (error) {
    addAiLog("AI助手云端问答失败", error);
    return { question, answer: buildFallbackAnswer(question, context), source: "本地规则fallback", context };
  }
}

export async function saveAiAnswerFeedback(payload) {
  try {
    return await cloudDataApi.saveAiFeedback(payload);
  } catch (error) {
    addAiLog("AI反馈保存失败", error);
    return { ok: false, message: error.message };
  }
}

export function generateRuleBasedAnalysis(input) {
  const newsEvents = input.newsData ?? input.newsEvents ?? [];
  const positiveNews = newsEvents.filter((item) => item.impact === "利好");
  const negativeNews = newsEvents.filter((item) => item.impact === "利空");
  const stockName = input.stockData?.name ?? input.stockQuote?.name ?? "当前股票";
  const marketSummary = input.marketData?.marketSentiment?.summary ?? "市场数据暂未更新。";
  const preferred = input.investmentProfile?.industries ?? [];
  const newsTargets = positiveNews.map((item) => item.target).filter(Boolean);
  const opportunityList = [...new Set([...preferred, ...newsTargets])].slice(0, 5);
  const evidence = buildEvidence(input);

  return {
    marketSummary: `市场环境判断：${marketSummary}`,
    coreLogic: "当前主线：结合涨跌家数、成交变化和热点板块，先做结构化观察，不形成确定买卖结论。",
    industryAnalysis: `热点行业分析：${(opportunityList.length ? opportunityList : ["AI", "半导体", "新能源"]).join("、")}。`,
    stockAnalysis: `我的股票影响：${stockName} 需要结合价格、成交额、公告和行业新闻持续跟踪。`,
    risks: [
      negativeNews.length ? `负面新闻需跟踪：${negativeNews.map((item) => item.title).slice(0, 2).join("；")}` : "暂无明显利空新闻，但仍需关注成交缩量和高位回撤。",
      "结论只作为研究提示，不构成确定买卖建议。",
    ],
    opportunities: opportunityList.length ? opportunityList : opportunities.slice(0, 3).map((item) => item.name),
    tomorrowPlan: ["观察热点板块成交是否延续", "检查自选股公告和新闻变化", "复盘AI风险提醒是否有效"],
    evidence,
    conclusionBasis: {
      market: evidence.market,
      industry: evidence.industry,
      stock: evidence.stock,
    },
    summary: `${marketSummary} 结合新闻事件看，当前更适合结构化观察。`,
    stockAdvice: `${stockName}：继续关注公告、成交额和行业消息变化；不输出确定买入或卖出结论。`,
    source: "本地规则fallback",
  };
}

export function generateDailyReports({ marketData, newsEvents, watchlist, investmentProfile, riskAlerts = [] }) {
  const analysis = generateRuleBasedAnalysis({ marketData, newsData: newsEvents, investmentProfile, riskData: riskAlerts, historyReports: reportHistory });
  const hotNames = marketData.hotSectors.map((item) => item.name);
  const watchedNames = watchlist.map((item) => item.name).slice(0, 3);

  return {
    morning: {
      date: new Date().toLocaleDateString("zh-CN"),
      generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      score: marketData.strategy.score,
      marketState: marketData.strategy.state,
      overseas: "外围市场作为辅助变量，重点观察纳斯达克、标普500和科技板块对A股情绪的映射。",
      strategy: `昨日市场：${marketData.marketSentiment.summary} 今日关注：${analysis.opportunities.join("、")}。`,
      focus: analysis.opportunities,
      watchFocus: watchedNames,
      risks: analysis.risks,
      sources: ["marketService", "stockService", "newsService", "riskService", "investmentProfile"],
      basis: "基于市场情绪、热点板块、新闻事件、自选股变化和用户投资档案生成。",
      quality: scoreReportQuality({ marketData, newsEvents, riskAlerts }),
      evidence: analysis.evidence,
    },
    close: {
      generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      performance: analysis.marketSummary,
      breadth: `上涨 ${marketData.marketSentiment.upCount} 家，下跌 ${marketData.marketSentiment.downCount} 家。`,
      hotSectors: hotNames,
      events: newsEvents.slice(0, 4).map((item) => `${item.title}：${item.impact}，影响${item.target}`),
      summary: `今日行情总结：${analysis.marketSummary}`,
      nextFocus: [...hotNames, ...watchedNames, ...analysis.tomorrowPlan].slice(0, 6),
      sources: ["marketService", "stockService", "newsService", "aiService"],
      basis: "基于收盘行情、新闻变化、个股异动和风险信号生成。",
      quality: scoreReportQuality({ marketData, newsEvents, riskAlerts }),
      evidence: analysis.evidence,
    },
    history: reportHistory.map((item) => ({
      date: item.date,
      type: item.type,
      title: item.content.summary,
      score: marketData.strategy.score,
      marketSummary: item.content.summary,
      hotAnalysis: item.content.opportunities.join("、"),
      risks: item.content.risks,
      nextStrategy: item.content.stockAdvice,
    })),
  };
}

function normalizeAiOutput(output, input, source) {
  const fallback = generateRuleBasedAnalysis(input);
  return {
    marketSummary: output.marketSummary ?? fallback.marketSummary,
    coreLogic: output.coreLogic ?? fallback.coreLogic,
    industryAnalysis: output.industryAnalysis ?? fallback.industryAnalysis,
    opportunities: Array.isArray(output.opportunities) ? output.opportunities : fallback.opportunities,
    risks: Array.isArray(output.risks) ? output.risks : fallback.risks,
    stockAnalysis: output.stockAnalysis ?? fallback.stockAnalysis,
    tomorrowPlan: Array.isArray(output.tomorrowPlan) ? output.tomorrowPlan : fallback.tomorrowPlan,
    evidence: output.evidence ?? output.conclusionBasis ?? fallback.evidence,
    conclusionBasis: output.conclusionBasis ?? fallback.conclusionBasis,
    summary: output.marketSummary ?? fallback.summary,
    stockAdvice: output.stockAnalysis ?? fallback.stockAdvice,
    source,
  };
}

function buildEvidence(input) {
  const marketOverview = input.marketData?.marketOverview ?? [];
  const sentiment = input.marketData?.marketSentiment ?? {};
  const stock = input.stockData ?? input.stockQuote ?? {};
  return {
    market: [
      ...marketOverview.slice(0, 4).map((item) => `${item.label}：${item.value}（${item.change ?? "无变化信息"}）`),
      `涨跌家数：上涨${sentiment.upCount ?? "未知"}，下跌${sentiment.downCount ?? "未知"}`,
    ],
    industry: [
      ...((input.marketData?.hotSectors ?? []).slice(0, 4).map((item) => `${item.name}：${item.status ?? item.flow ?? "热点"}`)),
      ...((input.newsData ?? []).slice(0, 3).map((item) => `${item.title}（${item.impact ?? item.category ?? "待判断"}）`)),
    ],
    stock: stock.code ? [`${stock.name} ${stock.code}`, `价格 ${stock.price ?? "暂无"}`, `涨跌幅 ${stock.changePercent ?? "暂无"}`, `成交额 ${stock.amount ?? "暂无"}`, `行业 ${stock.industry ?? "待补充"}`] : ["未提供明确股票数据"],
  };
}

function buildInputSummary({ marketData, stockQuote, newsEvents, riskData, investmentProfile, historicalReports, portfolio, aiHistory }) {
  return {
    market: {
      indexes: marketData?.marketOverview ?? [],
      breadth: marketData?.marketSentiment ? { up: marketData.marketSentiment.upCount, down: marketData.marketSentiment.downCount } : {},
    },
    industry: { hotSectors: marketData?.hotSectors ?? [], news: newsEvents ?? [] },
    stock: stockQuote ?? {},
    user: { portfolio: portfolio ?? [], preference: investmentProfile, riskData },
    history: { reports: historicalReports ?? [], aiHistory: aiHistory ?? [] },
  };
}

function scoreReportQuality({ marketData, newsEvents, riskAlerts }) {
  let score = 50;
  if (marketData?.marketOverview?.length >= 6) score += 15;
  if (marketData?.source && !marketData.source.includes("模拟")) score += 10;
  if ((newsEvents?.length ?? 0) >= 3) score += 15;
  if ((riskAlerts?.length ?? 0) >= 1) score += 10;
  return { score: Math.min(100, score), dataCompleteness: marketData?.marketOverview?.length >= 6 ? "完整" : "部分", newsCount: newsEvents?.length ?? 0, basis: "行情、新闻、风险、自选股、投资档案" };
}

function formatCloudAnswer(data) {
  if (!data) return "AI暂未返回结果。";
  return [data.answer, data.evidence?.length ? `\n依据：${data.evidence.join("、")}` : "", data.risks?.length ? `\n风险：${data.risks.join("、")}` : "", data.followUp?.length ? `\n后续观察：${data.followUp.join("、")}` : ""].filter(Boolean).join("\n");
}

function buildFallbackAnswer(question, context) {
  const market = context.market?.marketSentiment?.summary ?? "市场数据暂未更新";
  const stock = context.stockData;
  const focus = context.profile?.industries?.join("、") ?? "自选方向";
  const stockLine = stock?.code ? `相关股票：${stock.name}（${stock.code}），现价 ${stock.price ?? "暂无"}，涨跌幅 ${stock.changePercent ?? "暂无"}，成交额 ${stock.amount ?? "暂无"}。` : "未识别到明确股票。";
  return `问题：${question}\n\n市场背景：${market}\n\n${stockLine}\n\n关注方向：${focus}\n\n结论：当前只能作为研究观察。请结合行情强弱、新闻事件、公告变化和风险信号继续验证，不给出确定买卖结论。`;
}

function addAiLog(message, error) {
  addLog({ module: "ai", status: "failed", mode: "cloud-first", source: "aiService", message, error: error.message });
}
