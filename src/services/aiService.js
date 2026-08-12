import { reportHistory } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addLog } from "./logService.js";

const aiConfigKey = "ai-investment-ai-config";
const missing = "数据源未返回";

export function getAiConfig() {
  try {
    return JSON.parse(window.localStorage.getItem(aiConfigKey) ?? "{}");
  } catch {
    return {};
  }
}

export async function getAiStatus() {
  try {
    const result = await cloudDataApi.getAiProviderStatus();
    const data = result.data ?? result ?? {};
    const keyConfigured = data.keyConfigured ?? data.hasApiKey;
    const realAi = Boolean(data.enabled ?? (keyConfigured && ["api", "\u771f\u5b9eAI"].includes(data.mode)));
    return {
      ...data,
      hasApiKey: Boolean(keyConfigured),
      keyStatus: keyConfigured ? "\u5df2\u914d\u7f6e" : "\u672a\u914d\u7f6e",
      connected: data.enabled ?? realAi,
      label: (data.enabled ?? realAi) ? `\u771f\u5b9eAI\u6a21\u578b\uff1a${data.provider ?? "API"}` : "Fallback\u6a21\u5f0f",
      message: realAi ? `\u670d\u52a1\u7aef\u5df2\u542f\u7528 ${data.model ?? "AI\u6a21\u578b"}` : "\u5f53\u524d\u4f7f\u7528\u89c4\u5219fallback",
    };
  } catch (error) {
    return { mode: "fallback", provider: "local", connected: false, keyStatus: "\u672a\u914d\u7f6e", aiMode: "fallback", label: "Fallback\u6a21\u5f0f", message: error.message };
  }
}

export function saveAiConfig(config) {
  const clean = {
    mode: config.mode ?? "fallback",
    provider: config.provider ?? "openai-compatible",
    endpoint: config.endpoint ?? "",
    model: config.model ?? "",
    apiKeyStatus: config.apiKey ? "已填写，仅保存Key状态，不把密钥写入代码" : "未填写",
    updatedAt: nowText(),
  };
  window.localStorage.setItem(aiConfigKey, JSON.stringify(clean));
  return clean;
}

export function buildAiResearchInput({
  marketData,
  stockQuote,
  newsEvents,
  riskData = [],
  investmentProfile,
  historicalReports = [],
  portfolio = [],
  aiHistory = [],
}) {
  return {
    marketData,
    stockData: stockQuote,
    stockQuote,
    newsData: newsEvents,
    newsEvents,
    riskData,
    investmentProfile,
    portfolio,
    historyReports: historicalReports,
    aiHistory,
    aiInputSummary: buildInputSummary({ marketData, stockQuote, newsEvents, riskData, investmentProfile, historicalReports, portfolio, aiHistory }),
  };
}

export function buildPrompt(input) {
  return JSON.stringify({
    task: "生成A股投资研究报告",
    rules: [
      "不输出确定买入或卖出建议",
      "每个结论必须附数据依据",
      "没有数据支持时明确说明数据不足",
      "输出结构化JSON",
    ],
    outputTemplate: ["公司/标的分析", "近期变化", "投资逻辑", "风险分析", "AI投资判断", "数据依据"],
    input,
  }, null, 2);
}

export async function generateAiAnalysis(input) {
  try {
    const stock = input.stockData ?? input.stockQuote ?? {};
    console.info("[stock-ai-report] 股票数据:", {
      code: stock.code,
      name: stock.name,
      price: stock.price,
      changePercent: stock.changePercent,
      amount: stock.amount,
      industry: stock.industry,
      dataStatus: stock.dataStatus,
    });
    console.info("[stock-ai-report] AI请求:", Boolean(stock.code || stock.name));
    const result = stock.code || stock.name
      ? await cloudDataApi.generateStockAiReport(input)
      : await cloudDataApi.generateAiReport(input);
    const output = result.report ?? result.data?.content ?? result.data?.report ?? result.data;
    if (output?.investmentDecision || output?.marketSummary || output?.companyAnalysis) {
      console.info("[stock-ai-report] AI返回:", {
        success: true,
        provider: output.source ?? result.data?.source ?? "unknown",
        rating: output.investmentDecision?.rating,
        score: output.investmentDecision?.score,
      });
      return normalizeAiOutput(output, input, aiSourceLabel(output.source ?? result.data?.source));
    }
  } catch (error) {
    console.info("[stock-ai-report] AI返回:", { success: false, error: error.message });
    try {
      const result = await cloudDataApi.generateAiReport(input);
      const output = result.report ?? result.data?.content ?? result.data?.report ?? result.data;
      if (output?.investmentDecision || output?.marketSummary || output?.companyAnalysis) {
        console.info("[stock-ai-report] AI备用接口返回:", {
          success: true,
          provider: output.source ?? result.data?.source ?? "unknown",
        });
        return normalizeAiOutput(output, input, aiSourceLabel(output.source ?? result.data?.source));
      }
    } catch (reportError) {
      console.info("[stock-ai-report] AI备用接口返回:", { success: false, error: reportError.message });
    }
    addAiLog("AI报告生成失败，已使用本地规则fallback", error);
  }
  return generateRuleBasedAnalysis(input);
}

function aiSourceLabel(source) {
  if (source === "deepseek") return "DeepSeek";
  if (source === "openai" || source === "ai-api") return "OpenAI";
  return source ?? "云端AI";
}

export async function testAiConnection(config) {
  if (config.mode !== "api") return { ok: true, message: "当前为fallback模式，无需测试API。" };
  if (!config.endpoint || !config.apiKey) return { ok: false, message: "请填写API地址和Key。" };
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
      source: ["ai-api", "deepseek"].includes(result.data?.source) ? "真实AI模型" : "规则fallback",
      context,
    };
  } catch (error) {
    addAiLog("AI助手云端问答失败", error);
    return { question, answer: buildProfessionalFallbackAnswer(question, context), source: "本地规则fallback", context };
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

export function normalizeInvestmentDecision(decision = {}, input = {}) {
  const fallback = buildRuleInvestmentDecision(input);
  const source = decision && typeof decision === "object" ? decision : {};
  const score = clampScore(source.score ?? fallback.score);
  return {
    marketTrend: source.marketTrend ?? fallback.marketTrend,
    rating: normalizeRating(source.rating ?? fallback.rating),
    score,
    shortTerm: source.shortTerm ?? fallback.shortTerm,
    midTerm: source.midTerm ?? fallback.midTerm,
    action: normalizeAction(source.action ?? fallback.action),
    positionAdvice: source.positionAdvice ?? fallback.positionAdvice,
    probability: normalizeProbability(source.probability ?? fallback.probability, score),
    reasons: asList(source.reasons ?? fallback.reasons).slice(0, 6),
    risks: asList(source.risks ?? fallback.risks).slice(0, 6),
    watchPoints: asList(source.watchPoints ?? fallback.watchPoints).slice(0, 6),
  };
}

export function generateRuleBasedAnalysis(input) {
  const newsEvents = input.newsData ?? input.newsEvents ?? [];
  const stock = input.stockData ?? input.stockQuote ?? {};
  const stockName = stock.name ?? "当前标的";
  const marketSummary = input.marketData?.marketSentiment?.summary ?? "市场数据正在更新";
  const hotDirections = buildHotDirections(input.marketData, newsEvents);
  const opportunities = hotDirections.map((item) => item.name).slice(0, 5);
  const evidence = buildEvidence(input);
  const credibility = scoreCredibility({ marketData: input.marketData, stock, newsEvents, riskData: input.riskData });
  const investmentDecision = buildRuleInvestmentDecision(input);

  return {
    companyAnalysis: {
      profile: stock.profile ?? (stock.assetType === "ETF" ? `${stockName}为ETF标的，重点看跟踪指数、规模、流动性和成分方向。` : "公司简介由公告和年报继续补充。"),
      industry: stock.industry ?? missing,
      coreBusiness: stock.mainBusiness ?? stock.trackingIndex ?? "核心业务由公告和年报继续补充",
      industryPosition: stock.industryPosition ?? "行业地位需要结合行业数据继续观察",
    },
    recentChanges: {
      priceMoveReason: `${stockName} 当前涨跌幅 ${stock.changePercent ?? missing}，成交额 ${stock.amount ?? missing}。`,
      newsImpact: newsEvents.slice(0, 3).map((item) => `${item.title}：${item.impact ?? item.category ?? "中性"}`).join("；") || "新闻接口未返回强相关记录。",
      announcementImpact: (stock.announcements ?? []).slice(0, 3).map((item) => `${item.title}：${item.analysis?.direction ?? item.impact ?? "中性"}`).join("；") || "公告接口未返回强相关记录。",
    },
    investmentLogic: {
      positiveFactors: investmentDecision.reasons.slice(0, 3),
      growthFactors: hotDirections.slice(0, 3).map((item) => `${item.name}：${item.sustainability}`),
      watchPoints: investmentDecision.watchPoints,
    },
    riskAnalysis: {
      industryRisks: ["热点持续性不足", "行业估值波动", "政策和需求预期变化"],
      companyRisks: investmentDecision.risks.slice(0, 3),
      marketRisks: ["市场成交不足", "指数回撤", "高位题材波动放大"],
    },
    investmentDecision,
    marketSummary: `今日市场：${marketSummary}。`,
    coreLogic: "核心逻辑：结合指数涨跌、成交额、涨跌家数、热点板块、新闻公告和用户关注标的进行结构化观察。",
    industryAnalysis: formatHotDirections(hotDirections),
    hotDirections,
    stockAnalysis: `${stockName}：当前评级 ${investmentDecision.rating}，评分 ${investmentDecision.score}/100，需要继续跟踪行情、新闻、公告和财务变化。`,
    opportunities,
    risks: buildRiskList(input, newsEvents),
    tomorrowPlan: ["观察热点板块成交是否延续", "检查自选股公告和新闻变化", "复盘AI风险提醒是否有效"],
    evidence,
    conclusionBasis: evidence,
    credibility,
    summary: `${marketSummary}。当前更适合结构化观察。`,
    stockAdvice: `${stockName}：继续关注公告、财务、成交额和行业消息变化；不输出确定买入或卖出结论。`,
    source: "本地规则fallback",
  };
}

export function generateDailyReports({ marketData, newsEvents = [], watchlist = [], investmentProfile, riskAlerts = [] }) {
  const analysis = generateRuleBasedAnalysis({ marketData, newsData: newsEvents, investmentProfile, riskData: riskAlerts, historyReports: reportHistory, portfolio: watchlist });
  const hotDirections = analysis.hotDirections ?? [];
  const hotNames = hotDirections.map((item) => item.name);
  const watchedNames = watchlist.map((item) => item.name).filter(Boolean).slice(0, 4);
  const sentiment = marketData.marketSentiment ?? {};
  const strategy = marketData.strategy ?? {};
  const generatedAt = nowText();
  const quality = scoreReportQuality({ marketData, newsEvents, riskAlerts, watchlist });

  return {
    morning: {
      date: new Date().toLocaleDateString("zh-CN"),
      investmentDecision: analysis.investmentDecision,
      generatedAt,
      score: strategy.score ?? analysis.investmentDecision.score ?? 70,
      marketState: strategy.state ?? sentiment.summary ?? "震荡观察",
      marketSummary: analysis.marketSummary,
      riseReason: hotDirections.slice(0, 3).map((item) => `${item.name}：${item.reason}`).join("；") || "市场主线仍需观察成交确认。",
      downsideRisk: analysis.risks.join("；"),
      strategy: `今日重点观察：${hotNames.join("、") || "市场结构性机会"}。继续研究观察，不追高。`,
      focus: hotNames,
      hotDirections,
      watchFocus: watchedNames,
      risks: analysis.risks,
      tomorrowPlan: analysis.tomorrowPlan,
      positionAdvice: strategy.position ?? analysis.investmentDecision.positionAdvice ?? "保持观察仓位",
      sources: ["东方财富行情", "东方财富公告/快讯", "stockService自选股", "riskService", analysis.source],
      basis: "基于市场情绪、热点板块、新闻事件、公告、财务、自选股和用户投资档案生成。",
      evidence: analysis.evidence,
      credibility: analysis.credibility,
      quality,
    },
    close: {
      date: new Date().toLocaleDateString("zh-CN"),
      investmentDecision: analysis.investmentDecision,
      generatedAt,
      performance: analysis.marketSummary,
      marketSummary: analysis.marketSummary,
      breadth: `上涨 ${sentiment.upCount ?? missing} 家，下跌 ${sentiment.downCount ?? missing} 家。`,
      hotSectors: hotNames,
      hotAnalysis: formatHotDirections(hotDirections),
      events: newsEvents.slice(0, 4).map((item) => `${item.title}：${item.source ?? "新闻"}，${item.impact ?? item.category ?? "中性"}`),
      summary: `今日市场总结：${analysis.marketSummary}`,
      aiReview: "本报告复盘当日逻辑，后续需结合次日走势验证判断有效性。",
      nextFocus: [...hotNames, ...watchedNames, ...analysis.tomorrowPlan].slice(0, 6),
      positionAdvice: strategy.position ?? analysis.investmentDecision.positionAdvice ?? "控制仓位，关注风险收益比",
      sources: ["东方财富行情", "东方财富公告/快讯", "stockService", analysis.source],
      basis: "基于收盘行情、新闻变化、公告、财务、个股异动和风险信号生成。",
      evidence: analysis.evidence,
      credibility: analysis.credibility,
      quality,
    },
    history: reportHistory.map((item) => ({
      date: item.date,
      type: item.type,
      title: item.content.summary,
      score: strategy.score ?? 70,
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
    ...fallback,
    ...output,
    investmentDecision: normalizeInvestmentDecision(output.investmentDecision ?? fallback.investmentDecision, input),
    companyAnalysis: output.companyAnalysis ?? fallback.companyAnalysis,
    recentChanges: output.recentChanges ?? fallback.recentChanges,
    investmentLogic: output.investmentLogic ?? fallback.investmentLogic,
    riskAnalysis: output.riskAnalysis ?? fallback.riskAnalysis,
    marketSummary: output.marketSummary ?? output.summary ?? fallback.marketSummary,
    hotDirections: Array.isArray(output.hotDirections) ? output.hotDirections : fallback.hotDirections,
    industryAnalysis: output.industryAnalysis ?? fallback.industryAnalysis,
    opportunities: Array.isArray(output.opportunities) ? output.opportunities : fallback.opportunities,
    risks: Array.isArray(output.risks) ? output.risks : fallback.risks,
    stockAnalysis: output.stockAnalysis ?? fallback.stockAnalysis,
    tomorrowPlan: Array.isArray(output.tomorrowPlan) ? output.tomorrowPlan : fallback.tomorrowPlan,
    evidence: output.evidence ?? output.conclusionBasis ?? fallback.evidence,
    conclusionBasis: output.conclusionBasis ?? fallback.conclusionBasis,
    credibility: output.credibility ?? fallback.credibility,
    summary: output.summary ?? output.marketSummary ?? fallback.summary,
    stockAdvice: output.stockAdvice ?? output.stockAnalysis ?? fallback.stockAdvice,
    source,
  };
}

function formatCloudAnswer(data) {
  if (!data) return "AI暂未返回结果。";
  if (data.answer) return data.answer;
  const decision = data.investmentDecision ?? {};
  return [
    "【AI投资判断】",
    `评级：${decision.rating ?? "中性观察"}`,
    `评分：${decision.score ?? 60}/100`,
    `趋势：${decision.marketTrend ?? "震荡"}`,
    `短期：${decision.shortTerm ?? "1-5天观察"}`,
    `中期：${decision.midTerm ?? "1-4周观察"}`,
    `策略：${decision.action ?? "等待"}，${decision.positionAdvice ?? "保持当前仓位"}`,
    "",
    "【依据】",
    ...asList(data.basis ?? data.evidence ?? ["行情、新闻、公告、财务、用户画像"]),
    "",
    "【风险】",
    ...asList(data.risks ?? data.riskAnalysis ?? ["成交不足、估值波动、新闻落空或政策变化"]),
    "",
    "【观察建议】",
    ...asList(data.observationAdvice ?? data.tomorrowPlan ?? data.opportunities ?? ["关注主线持续性", "等待成交确认", "控制组合集中度"]),
  ].join("\n");
}

function buildProfessionalFallbackAnswer(question, context) {
  const analysis = generateRuleBasedAnalysis({
    marketData: context.market ?? context.marketData,
    stockQuote: context.stockData,
    newsEvents: context.news ?? context.newsData,
    riskData: context.risks ?? context.riskData,
    investmentProfile: context.profile ?? context.investmentProfile,
    portfolio: context.watchlist ?? context.portfolio,
  });
  return formatCloudAnswer({ ...analysis, conclusion: `针对“${question}”，当前为规则fallback分析。` });
}

function buildEvidence(input) {
  const marketOverview = input.marketData?.marketOverview ?? [];
  const sentiment = input.marketData?.marketSentiment ?? {};
  const stock = input.stockData ?? input.stockQuote ?? {};
  const newsData = input.newsData ?? input.newsEvents ?? [];
  const announcements = stock.announcements ?? [];
  const financials = stock.financials ?? {};
  return {
    market: [
      ...marketOverview.slice(0, 4).map((item) => `${item.label}：${item.value}，${item.change ?? "无变化信息"}`),
      `涨跌家数：上涨${sentiment.upCount ?? missing}，下跌${sentiment.downCount ?? missing}`,
    ],
    industry: [
      ...((input.marketData?.hotSectors ?? []).slice(0, 5).map((item) => `${item.name}：${item.status ?? item.flow ?? "热点"}`)),
      ...newsData.slice(0, 3).map((item) => `${item.title}：${item.source ?? "新闻"}，${item.impact ?? item.category ?? "中性"}`),
    ],
    stock: stock.code ? [
      `${stock.name} ${stock.code}`,
      `价格 ${stock.price ?? missing}`,
      `涨跌幅 ${stock.changePercent ?? missing}`,
      `成交额 ${stock.amount ?? missing}`,
      `行业 ${stock.industry ?? missing}`,
    ] : ["未提供明确股票数据"],
    announcements: announcements.length ? announcements.slice(0, 3).map((item) => `${item.title}：${item.analysis?.direction ?? item.impact ?? "中性"}`) : ["公告接口未返回强相关记录"],
    financials: [
      `营收 ${financials.revenue ?? missing}`,
      `营收同比 ${financials.revenueYoY ?? missing}`,
      `净利润 ${financials.netProfit ?? missing}`,
      `ROE ${financials.roe ?? missing}`,
      `来源 ${financials.source ?? missing}`,
    ],
  };
}

function buildInputSummary({ marketData, stockQuote, newsEvents, riskData, investmentProfile, historicalReports, portfolio, aiHistory }) {
  return {
    market: { indexes: marketData?.marketOverview ?? [], breadth: marketData?.marketSentiment ? { up: marketData.marketSentiment.upCount, down: marketData.marketSentiment.downCount } : {} },
    industry: { hotSectors: marketData?.hotSectors ?? [], news: newsEvents ?? [] },
    stock: stockQuote ?? {},
    company: { announcements: stockQuote?.announcements ?? [], financials: stockQuote?.financials ?? {} },
    user: { portfolio: portfolio ?? [], preference: investmentProfile, riskData },
    history: { reports: historicalReports ?? [], aiHistory: aiHistory ?? [] },
  };
}

function buildHotDirections(marketData = {}, newsEvents = []) {
  const sectors = (marketData?.hotSectors ?? []).slice(0, 8);
  const ranked = sectors.length ? sectors : inferSectorsFromNews(newsEvents);
  return ranked.slice(0, 5).map((item) => {
    const name = item.name ?? item;
    const relatedNews = newsEvents.find((event) => `${event.title ?? ""}${event.relatedIndustry ?? ""}${(event.relatedIndustries ?? []).join("")}`.includes(name));
    return {
      name,
      reason: item.status ?? item.flow ?? item.changePercent ?? "板块活跃度靠前",
      catalyst: relatedNews ? `${relatedNews.title}（${relatedNews.source ?? "新闻"}）` : "暂未匹配到强新闻催化，主要依据行情热度",
      sustainability: item.status?.includes("流入") || item.flow?.includes("流入") ? "持续性偏强，继续看成交延续" : "持续性需观察成交和新闻后续",
      risk: "若成交缩量或高位分歧放大，板块持续性会下降",
    };
  });
}

function inferSectorsFromNews(news = []) {
  const text = JSON.stringify(news);
  const names = [];
  if (/AI|人工智能|算力|服务器/.test(text)) names.push({ name: "AI算力" });
  if (/芯片|半导体/.test(text)) names.push({ name: "半导体" });
  if (/光模块|通信|5G/.test(text)) names.push({ name: "光模块/通信" });
  if (/电力|储能|电网/.test(text)) names.push({ name: "电力储能" });
  if (/消费|白酒/.test(text)) names.push({ name: "消费" });
  return names.length ? names : [{ name: "市场结构性机会" }];
}

function formatHotDirections(items = []) {
  return items.map((item) => `${item.name}：${item.reason}；催化：${item.catalyst}；持续性：${item.sustainability}；风险：${item.risk}`).join("\n");
}

function buildRiskList(input, newsEvents) {
  const risks = [];
  if ((input.riskData ?? []).length) risks.push(...input.riskData.map((item) => typeof item === "string" ? item : item.message ?? item.title));
  if (newsEvents.some((item) => item.impact === "利空" || item.impact === "偏利空")) risks.push("新闻或公告存在利空影响，需要继续跟踪。");
  risks.push("热点轮动过快可能导致短线波动。", "成交额不足会降低上涨持续性。");
  return [...new Set(risks.filter(Boolean))].slice(0, 6);
}

function scoreReportQuality({ marketData, newsEvents, riskAlerts, watchlist = [] }) {
  let score = 50;
  if (marketData?.marketOverview?.length >= 3) score += 15;
  if (marketData?.source && !String(marketData.source).includes("模拟")) score += 10;
  if ((newsEvents?.length ?? 0) >= 3) score += 10;
  if ((riskAlerts?.length ?? 0) >= 1) score += 10;
  if (watchlist.some((item) => item.financials?.status === "真实数据")) score += 5;
  return { score: Math.min(100, score), dataCompleteness: score >= 80 ? "较完整" : "部分完整", newsCount: newsEvents?.length ?? 0, basis: "行情、新闻、公告、财务、风险、自选股、投资档案" };
}

function scoreCredibility({ marketData, stock, newsEvents, riskData }) {
  let score = 30;
  const reasons = [];
  if (marketData?.marketOverview?.length) { score += 20; reasons.push("已有行情数据"); }
  if (stock?.dataStatus === "真实数据") { score += 15; reasons.push("已有个股行情"); }
  if ((stock?.announcements ?? []).length) { score += 15; reasons.push("已有公告依据"); }
  if (stock?.financials?.status === "真实数据") { score += 15; reasons.push("已有财务数据"); }
  if ((newsEvents ?? []).length) { score += 10; reasons.push("已有新闻依据"); }
  if ((riskData ?? []).length) { score += 5; reasons.push("已有风险信号"); }
  const level = score >= 80 ? "高" : score >= 55 ? "中" : "低";
  return { score: Math.min(100, score), level, reason: reasons.join("；") || "数据不足，仅作规则观察" };
}

function buildRuleInvestmentDecision(input = {}) {
  const stock = input.stockData ?? input.stockQuote ?? {};
  const market = input.marketData ?? {};
  const technical = scoreTechnical(stock);
  const capital = scoreCapital(stock, market);
  const fundamental = scoreFundamental(stock);
  const news = scoreNews(input.newsData ?? input.newsEvents ?? [], stock.announcements ?? []);
  const environment = scoreMarket(market);
  const score = clampScore(technical + capital + fundamental + news + environment);
  return {
    marketTrend: scoreToTrend(score),
    rating: scoreToRating(score),
    score,
    shortTerm: score >= 70 ? "1-5天偏强观察" : score >= 55 ? "1-5天震荡观察" : "1-5天偏弱观察",
    midTerm: score >= 70 ? "1-4周关注趋势延续" : score >= 55 ? "1-4周等待方向确认" : "1-4周降低关注",
    action: scoreToAction(score),
    positionAdvice: scoreToPosition(score),
    probability: normalizeProbability(null, score),
    reasons: [
      `技术面${technical}/20：参考涨跌幅和趋势。`,
      `资金面${capital}/20：参考成交额和热点活跃度。`,
      `基本面${fundamental}/20：参考财务、估值和行业地位。`,
      `消息面${news}/20：参考新闻和公告方向。`,
      `市场环境${environment}/20：参考指数、涨跌家数和热点板块。`,
    ],
    risks: [
      ...asList(input.riskData ?? input.risks).slice(0, 3),
      "市场成交不足会降低判断有效性。",
      "公告和财务数据需要结合原文复核。",
      "热点轮动过快可能带来短线回撤。",
    ].slice(0, 6),
    watchPoints: [
      stock.code ? `${stock.name ?? stock.code}成交额和涨跌幅是否延续` : "指数和涨跌家数变化",
      "热点主线是否明确",
      "新闻、公告和财报是否出现反向变化",
    ],
  };
}

function scoreMarket(market = {}) {
  const sentiment = market.marketSentiment ?? {};
  const heat = Number(sentiment.heat ?? 50);
  const up = Number(sentiment.upCount ?? 0);
  const down = Number(sentiment.downCount ?? 0);
  let score = 8;
  if (heat >= 70) score += 5;
  else if (heat >= 55) score += 3;
  if (up > down) score += 4;
  if ((market.hotSectors ?? []).length >= 3) score += 3;
  return Math.min(20, score);
}

function scoreTechnical(stock = {}) {
  const change = parseFloat(String(stock.changePercent ?? "0").replace("%", ""));
  if (change >= 3) return 18;
  if (change >= 1) return 15;
  if (change >= 0) return 12;
  if (change > -2) return 9;
  return 5;
}

function scoreCapital(stock = {}, market = {}) {
  let score = 8;
  if (/亿|万/.test(String(stock.amount ?? ""))) score += 5;
  if ((market.hotSectors ?? []).some((item) => String(stock.industry ?? "").includes(item.name) || String(item.name).includes(stock.industry))) score += 5;
  if (String(stock.dataStatus ?? "").includes("真实")) score += 2;
  return Math.min(20, score);
}

function scoreFundamental(stock = {}) {
  if (stock.assetType === "ETF") return 12;
  let score = 8;
  if (stock.financials?.revenue && !String(stock.financials.revenue).includes("数据源未返回")) score += 4;
  if (stock.financials?.netProfit && !String(stock.financials.netProfit).includes("数据源未返回")) score += 4;
  const pe = parseFloat(String(stock.pe ?? "").replace(",", ""));
  if (Number.isFinite(pe) && pe > 0 && pe < 40) score += 4;
  return Math.min(20, score);
}

function scoreNews(news = [], announcements = []) {
  let score = 10;
  const text = JSON.stringify([...news, ...announcements]);
  if (/利好|增长|回购|增持|中标|订单/.test(text)) score += 6;
  if (/利空|减持|亏损|处罚|下滑/.test(text)) score -= 6;
  if (news.length || announcements.length) score += 2;
  return Math.max(0, Math.min(20, score));
}

function scoreToTrend(score) {
  if (score >= 80) return "上涨";
  if (score >= 70) return "震荡偏强";
  if (score >= 50) return "震荡";
  return "偏弱";
}

function scoreToRating(score) {
  if (score >= 85) return "强烈关注";
  if (score >= 70) return "积极关注";
  if (score >= 55) return "中性观察";
  if (score >= 40) return "等待机会";
  return "风险较高";
}

function scoreToAction(score) {
  if (score >= 75) return "关注";
  if (score >= 60) return "持有";
  if (score >= 45) return "等待";
  if (score >= 30) return "降低仓位";
  return "回避";
}

function scoreToPosition(score) {
  if (score >= 80) return "半仓";
  if (score >= 65) return "低仓位";
  if (score >= 50) return "保持当前仓位";
  return "降低仓位";
}

function normalizeRating(value) {
  return ["强烈关注", "积极关注", "中性观察", "等待机会", "风险较高"].includes(value) ? value : "中性观察";
}

function normalizeAction(value) {
  return ["关注", "持有", "等待", "降低仓位", "回避"].includes(value) ? value : "等待";
}

function normalizeProbability(value, score) {
  if (value && typeof value === "object") return value;
  const up = Math.max(10, Math.min(75, Math.round(score * 0.7)));
  const down = Math.max(10, Math.min(60, Math.round((100 - score) * 0.45)));
  return { up: `${up}%`, flat: `${Math.max(10, 100 - up - down)}%`, down: `${down}%` };
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 60;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : item?.message ?? item?.title ?? JSON.stringify(item)).filter(Boolean);
  if (typeof value === "object" && value) return Object.values(value).flatMap(asList);
  if (!value) return [];
  return [String(value)];
}

function addAiLog(message, error) {
  addLog({ module: "ai", status: "failed", mode: "cloud-first", source: "aiService", message, error: error.message });
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
