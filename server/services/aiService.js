const deepseekEndpoint = "https://api.deepseek.com/chat/completions";
const openAiEndpoint = "https://api.openai.com/v1/chat/completions";
const defaultDeepseekModel = "deepseek-chat";
const defaultGenericModel = "gpt-4.1-mini";
const aiTimeoutMs = normalizeTimeout(process.env.AI_TIMEOUT_MS, 10000);
let aiQueue = Promise.resolve();

const reportSchema = {
  companyAnalysis: {
    profile: "公司/标的简介",
    industry: "所属行业",
    coreBusiness: "核心业务或ETF跟踪方向",
    industryPosition: "行业地位",
  },
  recentChanges: {
    priceMoveReason: "最近上涨/下跌原因",
    newsImpact: "新闻影响",
    announcementImpact: "公告影响",
  },
  investmentLogic: {
    positiveFactors: ["利好因素"],
    growthFactors: ["成长因素"],
    watchPoints: ["当前关注点"],
  },
  riskAnalysis: {
    industryRisks: ["行业风险"],
    companyRisks: ["公司/标的风险"],
    marketRisks: ["市场风险"],
  },
  investmentDecision: {
    score: "0-100",
    rating: "强烈关注/积极关注/中性观察/等待机会/风险较高",
    marketTrend: "上涨/震荡偏强/震荡/偏弱/下跌",
    shortTerm: "1-5天趋势判断",
    midTerm: "1-4周趋势判断",
    action: "关注/等待/持有/降低仓位/回避",
    positionAdvice: "低仓位/半仓/保持当前仓位/降低仓位",
    probability: { up: "上涨概率", flat: "震荡概率", down: "下跌概率" },
    reasons: ["判断依据"],
    risks: ["风险条件"],
    watchPoints: ["关注条件"],
  },
  marketSummary: "今日A股市场分析",
  hotDirections: [
    { name: "行业名称", reason: "上涨原因", catalyst: "新闻催化", sustainability: "持续性判断", risk: "风险" },
  ],
  tomorrowPlan: ["明日市场观察"],
  conclusion: "一句话结论",
  basis: ["行情、新闻、公告、财务、用户数据等依据"],
  evidence: {
    market: ["市场依据"],
    industry: ["行业依据"],
    stock: ["股票/ETF依据"],
    news: ["新闻依据"],
    announcement: ["公告依据"],
    financial: ["财务依据"],
    risk: ["风险依据"],
  },
};

const aiCallLogs = [];
let lastAiStatus = {
  lastCallAt: null,
  lastSuccessAt: null,
  lastFailureReason: "",
  lastDurationMs: null,
  lastModel: resolveAiConfig().model,
};

export function getAiRuntimeStatus() {
  const config = resolveAiConfig();
  const hasApiKey = Boolean(config.apiKey);
  return {
    mode: config.mode,
    provider: config.provider,
    endpointConfigured: Boolean(config.endpoint),
    model: config.model,
    hasApiKey,
    keyStatus: hasApiKey ? "\u5df2\u914d\u7f6e" : "\u672a\u914d\u7f6e",
    aiMode: config.mode === "api" ? "\u771f\u5b9eAI" : "fallback",
    label: config.mode === "api" ? "\u771f\u5b9eAI\u6a21\u578b" : "\u89c4\u5219fallback",
    env: {
      providerConfigured: Boolean(process.env.AI_PROVIDER),
      deepseekKeyConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
      genericKeyConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.AI_API_KEY),
    },
    fallbackProviders: resolveAiConfigs().slice(1).map((item) => item.provider),
    ...lastAiStatus,
  };
}

export function getAiCallLogs() {
  return aiCallLogs.slice(0, 100);
}

export async function generateResearchReport(input) {
  return runAiJsonTask({
    task: "生成A股投资研究报告",
    input: normalizeAiInput(input),
    outputSchema: reportSchema,
    fallback: () => fallbackReport(input),
  });
}

export function generateFallbackResearchReport(input, error = "") {
  const report = {
    ...normalizeOutput({}, fallbackReport(input)),
    source: "fallback",
  };
  if (error) report.error = error;
  return report;
}

export async function answerInvestmentQuestion(question, input) {
  const result = await runAiJsonTask({
    task: "回答用户关于A股市场、行业、个股、ETF或组合的问题",
    input: normalizeAiInput({ question, ...input }),
    outputSchema: {
      answer: "完整回答，必须包含【AI投资判断】【依据】【风险】【观察建议】",
      investmentDecision: reportSchema.investmentDecision,
      conclusion: "一句话结论",
      basis: ["依据来源"],
      risks: ["风险提示"],
      observationAdvice: ["观察建议"],
      evidence: reportSchema.evidence,
    },
    fallback: () => fallbackAnswer(question, input),
  });

  return {
    answer: result.answer ?? formatStructuredAnswer(result),
    investmentDecision: result.investmentDecision,
    conclusion: result.conclusion ?? result.marketSummary,
    evidence: result.evidence ?? {},
    basis: result.basis ?? flattenEvidence(result.evidence),
    risks: result.risks ?? result.riskAnalysis?.marketRisks ?? [],
    observationAdvice: result.observationAdvice ?? result.tomorrowPlan ?? [],
    followUp: result.followUp ?? result.observationAdvice ?? result.tomorrowPlan ?? [],
    quality: scoreAiQuality(result, input),
    source: result.source ?? "fallback",
  };
}

export async function runResearchTeam(input) {
  const report = await generateResearchReport(input);
  return {
    agents: [
      { name: "市场分析师", responsibility: "指数、成交量、市场情绪、涨跌家数", output: report.marketSummary },
      { name: "行业分析师", responsibility: "热点行业、政策影响、产业趋势", output: formatHotDirections(report.hotDirections) || report.industryAnalysis },
      { name: "公司分析师", responsibility: "公司基本面、公告、财务、新闻", output: report.companyAnalysis ?? report.stockAnalysis },
      { name: "技术分析师", responsibility: "趋势、成交、波动", output: buildTechnicalView(input) },
      { name: "风险分析师", responsibility: "估值风险、行业风险、市场风险", output: flattenRiskAnalysis(report).join("；") },
      { name: "投资经理AI", responsibility: "综合分析并输出最终研究判断", output: report.conclusion },
    ],
    report,
  };
}

export function buildReportTemplate(report) {
  return {
    title: "AI投资研究报告",
    sections: [
      { title: "公司/标的分析", content: report.companyAnalysis, evidence: report.evidence?.stock ?? [] },
      { title: "近期变化", content: report.recentChanges, evidence: [...(report.evidence?.news ?? []), ...(report.evidence?.announcement ?? [])] },
      { title: "投资逻辑", content: report.investmentLogic, evidence: report.basis ?? [] },
      { title: "风险分析", content: report.riskAnalysis ?? report.risks, evidence: report.evidence?.risk ?? [] },
      { title: "AI投资判断", content: report.investmentDecision, evidence: report.investmentDecision?.reasons ?? [] },
      { title: "明日市场观察", content: report.tomorrowPlan, evidence: report.evidence?.market ?? [] },
    ],
    disclaimer: "本报告只用于投资研究观察，不构成确定买入、卖出、满仓、清仓或收益保证。",
  };
}

async function runAiJsonTask({ task, input, outputSchema, fallback }) {
  const startedAt = Date.now();
  const configs = resolveAiConfigs();
  const config = configs[0] ?? resolveAiConfig();
  console.info("[ai-config]", {
    provider: config.provider,
    mode: config.mode,
    keyConfigured: Boolean(config.apiKey),
    model: config.model,
  });
  if (config.mode !== "api") {
    recordAiCall({ task, model: config.model, startedAt, success: true, source: "fallback", tokenUsage: null });
    return { ...normalizeOutput({}, fallback()), source: "fallback" };
  }

  return enqueueAiTask(() => runAiApiTaskSequence({ task, input: compactAiInput(input), outputSchema, fallback, startedAt, configs }));
}

async function runAiApiTaskSequence({ task, input, outputSchema, fallback, startedAt, configs }) {
  const failures = [];
  for (const config of configs) {
    try {
      return await runAiApiTask({ task, input, outputSchema, fallback, startedAt, config, timeoutMs: Math.min(aiTimeoutMs, configs.length > 1 ? 5000 : aiTimeoutMs) });
    } catch (error) {
      failures.push(`${config.provider}: ${error.message}`);
    }
  }
  const message = failures.join("；") || "未配置可用AI接口";
  console.warn("AI providers failed, fallback used:", message);
  return { ...normalizeOutput({}, fallback()), source: "fallback", error: message };
}

async function runAiApiTask({ task, input, outputSchema, fallback, startedAt, config, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: [
              "你是个人A股投资研究助手，定位接近投资经理，但不是自动交易系统。",
              "你必须基于输入中的实时行情、新闻、公告、财务、行业和用户数据分析。",
              "没有数据支持时必须明确说明数据不足，不允许编造价格、公告、新闻或财务。",
              "可以给出明确的研究判断和评级，但禁止输出保证收益、确定买入、确定卖出等结论。",
              "回答必须是结构化JSON。",
            ].join("\n"),
          },
          { role: "user", content: buildPrompt({ task, input, outputSchema }) },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      const responseMessage = await readAiErrorResponse(response);
      throw new Error(formatAiHttpError(response.status, responseMessage));
    }
    let json;
    try {
      json = await response.json();
    } catch (error) {
      throw new Error(`AI响应JSON解析失败：${error.message}`);
    }
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI返回为空");
    const source = config.provider === "deepseek" ? "deepseek" : "openai";
    recordAiCall({ task, model: config.model, startedAt, success: true, source, tokenUsage: json.usage ?? null });
    return { ...normalizeOutput(parseJsonContent(content), fallback()), source, tokenUsage: json.usage ?? null };
  } catch (error) {
    const message = describeAiError(error, timeoutMs);
    console.warn("AI provider failed:", config.provider, message);
    recordAiCall({ task, model: config.model, startedAt, success: false, source: config.provider, error: message, tokenUsage: null });
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}

function enqueueAiTask(taskRunner) {
  const run = aiQueue.then(taskRunner, taskRunner);
  aiQueue = run.catch(() => {});
  return run;
}

function resolveAiConfig() {
  return resolveAiConfigs()[0] ?? {
    provider: "fallback",
    mode: "fallback",
    endpoint: "",
    apiKey: "",
    model: String(process.env.AI_MODEL ?? defaultGenericModel).trim(),
  };
}

function resolveAiConfigs() {
  const requestedProvider = String(process.env.AI_PROVIDER ?? (process.env.DEEPSEEK_API_KEY ? "deepseek" : "openai-compatible")).trim().toLowerCase();
  const deepseekKey = String(process.env.DEEPSEEK_API_KEY ?? (requestedProvider === "deepseek" && !process.env.OPENAI_API_KEY ? process.env.AI_API_KEY : "") ?? "").trim();
  const openAiKey = requestedProvider === "deepseek"
    ? ""
    : String(process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY ?? "").trim();
  const configs = [];
  if (deepseekKey) {
    configs.push({
      provider: "deepseek",
      mode: "api",
      endpoint: String(process.env.DEEPSEEK_API_ENDPOINT ?? (String(process.env.AI_API_ENDPOINT ?? "").includes("deepseek") ? process.env.AI_API_ENDPOINT : deepseekEndpoint)).trim(),
      apiKey: deepseekKey,
      model: String(process.env.DEEPSEEK_MODEL ?? defaultDeepseekModel).trim(),
    });
  }
  if (openAiKey) {
    configs.push({
      provider: requestedProvider === "deepseek" ? "openai" : requestedProvider,
      mode: "api",
      endpoint: String(process.env.OPENAI_API_ENDPOINT ?? (requestedProvider !== "deepseek" ? process.env.AI_API_ENDPOINT : "") ?? openAiEndpoint).trim() || openAiEndpoint,
      apiKey: openAiKey,
      model: String(process.env.OPENAI_MODEL ?? (requestedProvider !== "deepseek" ? process.env.AI_MODEL : "") ?? defaultGenericModel).trim(),
    });
  }
  return configs;
}

function normalizeAiInput(input = {}) {
  const stockData = input.stockData ?? input.stockQuote ?? {};
  const newsData = asArray(input.newsData ?? input.newsEvents ?? input.news);
  const announcementData = asArray(input.announcementData ?? input.announcements ?? stockData.announcements);
  return {
    question: input.question,
    marketData: input.marketData ?? input.market ?? {},
    stockData,
    newsData,
    announcementData,
    investmentProfile: input.investmentProfile ?? input.profile ?? input.settings ?? {},
    riskData: asArray(input.riskData ?? input.risks),
    portfolio: asArray(input.portfolio ?? input.watchlist),
    historyReports: asArray(input.historyReports ?? input.reports),
    aiHistory: asArray(input.aiHistory ?? input.history),
    historicalReflection: input.historicalReflection ?? "",
    aiInputSummary: input.aiInputSummary ?? buildCompactInputSummary(input),
  };
}

function compactAiInput(input = {}) {
  const normalized = normalizeAiInput(input);
  return {
    question: trimText(normalized.question, 300),
    marketData: compactMarketData(normalized.marketData),
    stockData: compactStockData(normalized.stockData),
    newsData: (normalized.newsData ?? []).slice(0, 3).map(compactEvent),
    announcementData: (normalized.announcementData ?? []).slice(0, 3).map(compactEvent),
    investmentProfile: compactPlainObject(normalized.investmentProfile, 8, 200),
    riskData: asArray(normalized.riskData).slice(0, 5).map((item) => typeof item === "string" ? trimText(item, 200) : compactPlainObject(item, 6, 180)),
    portfolio: asArray(normalized.portfolio).slice(0, 8).map((item) => compactPlainObject(item, 8, 160)),
    historyReports: asArray(normalized.historyReports).slice(0, 3).map((item) => compactPlainObject(item, 6, 200)),
    aiHistory: asArray(normalized.aiHistory).slice(0, 5).map((item) => compactPlainObject(item, 6, 200)),
    historicalReflection: trimText(normalized.historicalReflection, 500),
    aiInputSummary: compactPlainObject(normalized.aiInputSummary, 10, 180),
  };
}

function compactMarketData(marketData = {}) {
  return {
    marketOverview: asArray(marketData.marketOverview ?? marketData.indexes).slice(0, 6).map((item) => compactPlainObject(item, 8, 160)),
    hotSectors: asArray(marketData.hotSectors).slice(0, 5).map((item) => compactPlainObject(item, 8, 160)),
    marketSentiment: compactPlainObject(marketData.marketSentiment ?? {}, 8, 160),
    strategy: compactPlainObject(marketData.strategy ?? {}, 6, 160),
  };
}

function compactStockData(stock = {}) {
  return {
    code: stock.code,
    name: stock.name,
    assetType: stock.assetType,
    market: stock.market,
    industry: stock.industry,
    price: stock.price,
    changePercent: stock.changePercent,
    changeAmount: stock.changeAmount,
    amount: stock.amount,
    volume: stock.volume,
    turnoverRate: stock.turnoverRate,
    marketCap: stock.marketCap,
    pe: stock.pe,
    pb: stock.pb,
    dataSource: stock.dataSource,
    dataStatus: stock.dataStatus,
    updatedAt: stock.updatedAt,
    profile: trimText(stock.profile, 500),
    mainBusiness: trimText(stock.mainBusiness, 300),
    industryPosition: trimText(stock.industryPosition, 300),
    financials: compactPlainObject(stock.financials ?? {}, 10, 160),
    announcements: (stock.announcements ?? []).slice(0, 3).map(compactEvent),
  };
}

function compactEvent(event = {}) {
  return {
    title: trimText(event.title, 180),
    source: trimText(event.source, 80),
    time: event.time ?? event.date,
    category: trimText(event.category ?? event.type, 80),
    impact: trimText(event.impact ?? event.analysis?.impact, 300),
    direction: trimText(event.analysis?.direction, 80),
    link: event.link,
  };
}

function compactPlainObject(value = {}, maxKeys = 8, maxText = 160) {
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).slice(0, maxKeys).map(([key, item]) => [
    key,
    typeof item === "string" ? trimText(item, maxText) : Array.isArray(item) ? item.slice(0, 5).map((entry) => typeof entry === "string" ? trimText(entry, maxText) : compactPlainObject(entry, 5, maxText)) : item,
  ]));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function normalizeTimeout(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 10000);
}

async function readAiErrorResponse(response) {
  try {
    const text = trimText(await response.text(), 500);
    if (!text) return "";
    try {
      const json = JSON.parse(text);
      return trimText(json?.error?.message ?? json?.message ?? text, 300);
    } catch {
      return text;
    }
  } catch {
    return "";
  }
}

function formatAiHttpError(status, detail = "") {
  const labels = {
    400: "请求参数错误",
    401: "API Key无效或鉴权失败",
    402: "账户余额不足或付费状态异常",
    403: "API访问被拒绝",
    408: "DeepSeek请求超时",
    429: "DeepSeek请求过于频繁或额度受限",
  };
  const label = labels[status] ?? (status >= 500 ? "DeepSeek服务器错误" : "DeepSeek API错误");
  return `AI HTTP ${status}：${label}${detail ? `；${detail}` : ""}`;
}

function describeAiError(error, timeoutMs) {
  if (error?.name === "AbortError") return `AI调用超时 ${timeoutMs}ms`;
  const message = String(error?.message ?? "未知AI错误");
  if (/AI HTTP|JSON解析失败|AI返回为空/.test(message)) return message;
  const cause = String(error?.cause?.code ?? error?.cause?.message ?? "");
  if (/fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|socket|network/i.test(`${message} ${cause}`)) {
    return `AI网络连接失败${cause ? `：${trimText(cause, 200)}` : `：${message}`}`;
  }
  return `AI本地处理异常：${message}`;
}

function trimText(value, maxLength = 500) {
  if (value === undefined || value === null) return value;
  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function buildPrompt({ task, input, outputSchema }) {
  return JSON.stringify({
    task,
    rules: [
      "股票研究报告固定包含【公司/标的分析】【近期变化】【投资逻辑】【风险分析】【AI投资判断】。",
      "每日市场报告固定包含【今日A股市场分析】【今日热点方向】【明日市场观察】。",
      "今日热点方向必须根据输入的hotSectors、行业新闻和市场变化选TOP5，不要固定只看AI、半导体、电力。",
      "AI投资判断必须包含综合评分、评级、短期趋势、中期趋势、关注条件、风险条件。",
      "评级只能使用：强烈关注、积极关注、中性观察、等待机会、风险较高。",
      "action只能使用：关注、等待、持有、降低仓位、回避。",
      "每个结论必须引用依据来源，例如东方财富行情、东方财富快讯、东方财富公告、财务接口、用户自选股。",
      "没有实时数据时，不要生成虚假分析，必须说明数据源未返回和更新时间。",
      "禁止输出确定买卖、保证上涨、保证赚钱。",
    ],
    requiredInputFields: ["marketData", "stockData", "newsData", "announcementData", "investmentProfile", "riskData"],
    input,
    outputSchema,
  }, null, 2);
}

function fallbackReport(input) {
  const normalized = normalizeAiInput(input);
  const stock = normalized.stockData ?? {};
  const market = normalized.marketData ?? {};
  const news = normalized.newsData ?? [];
  const announcements = normalized.announcementData ?? [];
  const evidence = buildEvidence(normalized);
  const investmentDecision = buildInvestmentDecision(normalized);
  const hotDirections = buildHotDirections(market, news);
  const companyAnalysis = {
    profile: stock.company?.profile ?? stock.profile ?? (stock.assetType === "ETF" ? `${stock.name ?? stock.code}为ETF标的，重点看跟踪指数、成分方向、规模和流动性。` : "公司简介由公告和年报继续补充。"),
    industry: stock.industry ?? stock.company?.industry ?? "行业由数据源补充",
    coreBusiness: stock.company?.mainBusiness ?? stock.mainBusiness ?? stock.etf?.trackingIndex ?? "核心业务由公告和年报继续补充",
    industryPosition: stock.company?.industryPosition ?? stock.industryPosition ?? "行业地位需要结合行业数据继续观察",
  };
  const recentChanges = {
    priceMoveReason: buildPriceMoveReason(stock, market),
    newsImpact: news.slice(0, 3).map((item) => `${item.title}：${item.impact ?? item.category ?? "中性"}`).join("；") || "新闻接口本次未返回强相关记录。",
    announcementImpact: announcements.slice(0, 3).map((item) => `${item.title}：${item.analysis?.direction ?? item.impact ?? "中性"}`).join("；") || "公告接口本次未返回强相关记录。",
  };
  const investmentLogic = {
    positiveFactors: investmentDecision.reasons.slice(0, 3),
    growthFactors: hotDirections.slice(0, 3).map((item) => `${item.name}：${item.sustainability}`),
    watchPoints: investmentDecision.watchPoints,
  };
  const riskAnalysis = {
    industryRisks: ["热点持续性不足", "行业估值波动", "政策和需求预期变化"],
    companyRisks: investmentDecision.risks.slice(0, 3),
    marketRisks: ["市场成交不足", "指数回撤", "高位题材波动放大"],
  };
  return {
    companyAnalysis,
    recentChanges,
    investmentLogic,
    riskAnalysis,
    investmentDecision,
    marketSummary: buildMarketSummary(market),
    coreLogic: "结合指数表现、成交额、涨跌家数、热点行业、新闻公告和用户关注标的进行结构化研究。",
    industryAnalysis: formatHotDirections(hotDirections),
    stockAnalysis: `${stock.name ?? stock.code ?? "当前标的"}：当前评级 ${investmentDecision.rating}，评分 ${investmentDecision.score}/100，需继续跟踪行情、新闻、公告和财务变化。`,
    hotDirections,
    opportunities: hotDirections.map((item) => item.name).slice(0, 5),
    risks: flattenRiskAnalysis({ riskAnalysis, investmentDecision }).slice(0, 8),
    tomorrowPlan: [
      "观察指数和成交额是否延续",
      ...hotDirections.slice(0, 3).map((item) => `跟踪${item.name}持续性`),
      stock.code ? `复核${stock.name ?? stock.code}公告、新闻和成交变化` : "检查自选股公告和新闻变化",
    ].slice(0, 6),
    conclusion: `当前AI判断：${investmentDecision.rating}，评分${investmentDecision.score}/100，策略为${investmentDecision.action}。`,
    basis: flattenEvidence(evidence),
    evidence,
  };
}

function fallbackAnswer(question, input) {
  const report = fallbackReport(input);
  return {
    ...report,
    answer: formatStructuredAnswer({ ...report, question }),
    observationAdvice: report.tomorrowPlan,
    source: "fallback",
  };
}

function normalizeOutput(output, fallback) {
  const investmentDecision = normalizeInvestmentDecision(output.investmentDecision ?? fallback.investmentDecision, fallback);
  const evidence = output.evidence ?? output.conclusionBasis ?? fallback.evidence ?? {};
  const basis = Array.isArray(output.basis) ? output.basis : flattenEvidence(evidence);
  const riskAnalysis = output.riskAnalysis ?? fallback.riskAnalysis;
  return {
    ...fallback,
    ...output,
    investmentDecision,
    companyAnalysis: output.companyAnalysis ?? fallback.companyAnalysis,
    recentChanges: output.recentChanges ?? fallback.recentChanges,
    investmentLogic: output.investmentLogic ?? fallback.investmentLogic,
    riskAnalysis,
    marketSummary: output.marketSummary ?? fallback.marketSummary,
    hotDirections: Array.isArray(output.hotDirections) ? output.hotDirections : fallback.hotDirections,
    industryAnalysis: output.industryAnalysis ?? fallback.industryAnalysis,
    stockAnalysis: output.stockAnalysis ?? fallback.stockAnalysis,
    conclusion: output.conclusion ?? fallback.conclusion ?? output.summary ?? output.marketSummary ?? fallback.marketSummary,
    basis,
    evidence,
    risks: Array.isArray(output.risks) ? output.risks : flattenRiskAnalysis({ riskAnalysis, investmentDecision }),
    observationAdvice: output.observationAdvice ?? output.followUp ?? fallback.observationAdvice ?? fallback.tomorrowPlan,
    opportunities: Array.isArray(output.opportunities) ? output.opportunities : fallback.opportunities,
    tomorrowPlan: Array.isArray(output.tomorrowPlan) ? output.tomorrowPlan : fallback.tomorrowPlan,
  };
}

function normalizeInvestmentDecision(decision = {}, fallback = {}) {
  const source = decision && typeof decision === "object" ? decision : {};
  const fallbackDecision = fallback.investmentDecision ?? {};
  const score = clampScore(source.score ?? fallbackDecision.score ?? 60);
  return {
    marketTrend: source.marketTrend ?? fallbackDecision.marketTrend ?? scoreToTrend(score),
    rating: normalizeRating(source.rating ?? fallbackDecision.rating ?? scoreToRating(score)),
    score,
    shortTerm: source.shortTerm ?? fallbackDecision.shortTerm ?? "1-5天震荡观察",
    midTerm: source.midTerm ?? fallbackDecision.midTerm ?? "1-4周关注趋势延续",
    action: normalizeAction(source.action ?? fallbackDecision.action),
    positionAdvice: source.positionAdvice ?? fallbackDecision.positionAdvice ?? scoreToPosition(score),
    probability: normalizeProbability(source.probability ?? fallbackDecision.probability, score),
    reasons: asStringList(source.reasons ?? fallbackDecision.reasons).slice(0, 6),
    risks: asStringList(source.risks ?? fallbackDecision.risks).slice(0, 6),
    watchPoints: asStringList(source.watchPoints ?? fallbackDecision.watchPoints).slice(0, 6),
  };
}

function buildInvestmentDecision(input) {
  const marketScore = scoreMarket(input.marketData);
  const technicalScore = scoreTechnical(input.stockData);
  const capitalScore = scoreCapital(input.stockData, input.marketData);
  const fundamentalScore = scoreFundamental(input.stockData);
  const newsScore = scoreNews(input.newsData, input.announcementData);
  const score = clampScore(technicalScore + capitalScore + fundamentalScore + newsScore + marketScore);
  const stock = input.stockData ?? {};
  const reasons = [
    `技术面${technicalScore}/20：参考涨跌幅、短期趋势和波动状态。`,
    `资金面${capitalScore}/20：参考成交额、成交量和热点活跃度。`,
    `基本面${fundamentalScore}/20：参考财务、估值、行业位置或ETF跟踪方向。`,
    `消息面${newsScore}/20：参考新闻和公告方向。`,
    `市场环境${marketScore}/20：参考指数、涨跌家数和热点板块。`,
  ];
  const risks = [
    ...asStringList(input.riskData).map((item) => typeof item === "string" ? item : item.message ?? item.title),
    "市场成交不足会削弱判断有效性。",
    "公告、新闻和财务数据需要结合原文复核。",
    "热点轮动过快时短线波动会放大。",
  ].filter(Boolean);
  return {
    marketTrend: scoreToTrend(score),
    rating: scoreToRating(score),
    score,
    shortTerm: score >= 70 ? "1-5天偏强观察" : score >= 55 ? "1-5天震荡观察" : "1-5天偏弱观察",
    midTerm: score >= 70 ? "1-4周关注趋势延续" : score >= 55 ? "1-4周等待方向确认" : "1-4周降低关注",
    action: scoreToAction(score),
    positionAdvice: scoreToPosition(score),
    probability: normalizeProbability(null, score),
    reasons,
    risks: risks.slice(0, 6),
    watchPoints: [
      stock.code ? `${stock.name ?? stock.code}成交额和涨跌幅是否延续` : "主要指数和涨跌家数变化",
      "热点行业是否保持成交和新闻催化",
      "新闻、公告和财报是否出现反向变化",
    ],
  };
}

function buildMarketSummary(marketData = {}) {
  const sentiment = marketData.marketSentiment ?? {};
  const overview = marketData.marketOverview ?? [];
  const indexes = overview.slice(0, 3).map((item) => `${item.label ?? item.name} ${item.value ?? item.price ?? ""} ${item.change ?? item.changePercent ?? ""}`.trim()).join("；");
  const breadth = `上涨${sentiment.upCount ?? "数据源未返回"}家，下跌${sentiment.downCount ?? "数据源未返回"}家`;
  return `今日A股市场：${sentiment.summary ?? "结构性观察"}。${indexes ? `主要指数：${indexes}。` : ""}${breadth}。`;
}

function buildHotDirections(marketData = {}, news = []) {
  const sectors = (marketData.hotSectors ?? []).slice(0, 8);
  const ranked = sectors.length ? sectors : inferSectorsFromNews(news);
  return ranked.slice(0, 5).map((item) => {
    const name = item.name ?? item;
    const relatedNews = news.find((event) => `${event.title ?? ""}${event.relatedIndustry ?? ""}${(event.relatedIndustries ?? []).join("")}`.includes(name));
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
  const names = [];
  const text = JSON.stringify(news);
  if (/AI|人工智能|算力|服务器/.test(text)) names.push({ name: "AI算力" });
  if (/芯片|半导体/.test(text)) names.push({ name: "半导体" });
  if (/光模块|通信|5G/.test(text)) names.push({ name: "光模块/通信" });
  if (/电力|储能|电网/.test(text)) names.push({ name: "电力储能" });
  if (/消费|白酒/.test(text)) names.push({ name: "消费" });
  return names.length ? names : [{ name: "市场结构性机会" }];
}

function buildPriceMoveReason(stock = {}, marketData = {}) {
  const change = stock.changePercent ?? "数据源未返回";
  const amount = stock.amount ?? "数据源未返回";
  const sector = (marketData.hotSectors ?? []).find((item) => String(stock.industry ?? "").includes(item.name) || String(item.name).includes(stock.industry));
  return `近期涨跌幅 ${change}，成交额 ${amount}。${sector ? `所属方向与热点板块${sector.name}相关。` : "需结合所属行业和市场情绪继续观察。"}`;
}

function buildEvidence(input) {
  const marketOverview = input.marketData?.marketOverview ?? input.aiInputSummary?.market?.indexes ?? [];
  const sentiment = input.marketData?.marketSentiment ?? {};
  const hotSectors = input.marketData?.hotSectors ?? input.aiInputSummary?.industry?.hotSectors ?? [];
  const news = input.newsData ?? [];
  const announcements = input.announcementData ?? input.stockData?.announcements ?? [];
  const stock = input.stockData ?? {};
  const financials = stock.financials ?? {};
  return {
    market: [
      ...marketOverview.slice(0, 5).map((item) => `${item.label ?? item.name}：${item.value ?? item.price ?? ""} ${item.change ?? item.changePercent ?? ""}`.trim()),
      `涨跌家数：上涨${sentiment.upCount ?? input.aiInputSummary?.market?.breadth?.up ?? "数据源未返回"}，下跌${sentiment.downCount ?? input.aiInputSummary?.market?.breadth?.down ?? "数据源未返回"}`,
    ],
    industry: [
      ...hotSectors.slice(0, 5).map((item) => `${item.name}：${item.status ?? item.flow ?? item.changePercent ?? "热点"}`),
      ...news.slice(0, 3).map((item) => `${item.title}：${item.impact ?? item.category ?? "中性"}`),
    ],
    stock: stock.code ? [`${stock.name} ${stock.code}`, `价格${stock.price ?? "数据源未返回"}`, `涨跌幅${stock.changePercent ?? "数据源未返回"}`, `成交额${stock.amount ?? "数据源未返回"}`, `行业${stock.industry ?? "数据源未返回"}`] : ["未提供明确股票数据"],
    news: news.length ? news.slice(0, 4).map((item) => `${item.title ?? "新闻"}：${item.source ?? "新闻源"}，${item.impact ?? item.category ?? "中性"}`) : ["新闻接口未返回强相关记录"],
    announcement: announcements.length ? announcements.slice(0, 4).map((item) => `${item.title ?? "公告"}：${item.analysis?.direction ?? item.impact ?? "中性"}`) : ["公告接口未返回强相关记录"],
    financial: [`营收${financials.revenue ?? "数据源未返回"}`, `净利润${financials.netProfit ?? "数据源未返回"}`, `ROE${financials.roe ?? "数据源未返回"}`, `来源${financials.source ?? "数据源未返回"}`],
    risk: (input.riskData ?? []).slice(0, 5).map((item) => typeof item === "string" ? item : item.message ?? item.title ?? "风险待跟踪"),
  };
}

function buildCompactInputSummary(input = {}) {
  const marketData = input.marketData ?? input.market ?? {};
  const stock = input.stockData ?? input.stockQuote ?? {};
  return {
    market: {
      indexes: marketData.marketOverview ?? marketData.indexes ?? [],
      breadth: { up: marketData.marketSentiment?.upCount, down: marketData.marketSentiment?.downCount },
      sentiment: marketData.marketSentiment?.summary,
    },
    industry: { hotSectors: marketData.hotSectors ?? [] },
    stock: { code: stock.code, name: stock.name, price: stock.price, changePercent: stock.changePercent, amount: stock.amount },
    company: { announcements: stock.announcements ?? [], financials: stock.financials ?? {} },
    user: { preference: input.investmentProfile ?? input.profile ?? {}, riskData: input.riskData ?? input.risks ?? [] },
  };
}

function scoreMarket(marketData = {}) {
  const sentiment = marketData.marketSentiment ?? {};
  const up = Number(sentiment.upCount ?? 0);
  const down = Number(sentiment.downCount ?? 0);
  const heat = Number(sentiment.heat ?? 50);
  let score = 8;
  if (heat >= 70) score += 5;
  else if (heat >= 55) score += 3;
  if (up > down) score += 4;
  if ((marketData.hotSectors ?? []).length >= 3) score += 3;
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

function scoreCapital(stock = {}, marketData = {}) {
  const amount = String(stock.amount ?? "");
  let score = 8;
  if (/亿|万/.test(amount)) score += 5;
  if ((marketData.hotSectors ?? []).some((item) => String(stock.industry ?? "").includes(item.name) || String(item.name).includes(stock.industry))) score += 5;
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

function scoreAiQuality(result, input = {}) {
  let score = 40;
  if (result.investmentDecision) score += 20;
  if ((input.newsData ?? input.newsEvents ?? []).length) score += 10;
  if ((input.announcementData ?? input.announcements ?? input.stockData?.announcements ?? []).length) score += 10;
  if (input.marketData?.marketOverview?.length) score += 10;
  if (input.stockData?.code || input.stockQuote?.code) score += 10;
  return { score: Math.min(100, score), dataCompleteness: score >= 80 ? "较完整" : "部分完整" };
}

function formatStructuredAnswer(result) {
  const decision = result.investmentDecision ?? {};
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
    ...flattenEvidence(result.basis ?? result.evidence ?? []).slice(0, 8),
    "",
    "【风险】",
    ...(result.risks ?? flattenRiskAnalysis(result)).slice(0, 6),
    "",
    "【观察建议】",
    ...(result.observationAdvice ?? result.tomorrowPlan ?? ["继续跟踪行情、新闻、公告和成交变化。"]),
  ].join("\n");
}

function formatHotDirections(items = []) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => `${item.name}：${item.reason ?? ""}；催化：${item.catalyst ?? ""}；持续性：${item.sustainability ?? ""}；风险：${item.risk ?? ""}`).join("\n");
}

function flattenRiskAnalysis(report = {}) {
  const riskAnalysis = report.riskAnalysis ?? {};
  return [
    ...(riskAnalysis.industryRisks ?? []),
    ...(riskAnalysis.companyRisks ?? []),
    ...(riskAnalysis.marketRisks ?? []),
    ...(report.investmentDecision?.risks ?? []),
    ...(report.risks ?? []),
  ].filter(Boolean);
}

function buildTechnicalView(input) {
  const stock = input?.stockData ?? input?.stockQuote ?? {};
  const volume = stock.amount ?? input?.marketData?.marketOverview?.find?.((item) => String(item.label).includes("成交"))?.value ?? "数据源未返回";
  return `技术观察：重点看价格位置、成交额${volume}、热点延续性和波动放大风险；只作为趋势观察，不作为买卖指令。`;
}

function parseJsonContent(content) {
  return JSON.parse(String(content).replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim());
}

function recordAiCall({ task, model, startedAt, success, source, error = "", tokenUsage = null }) {
  const durationMs = Date.now() - startedAt;
  const log = { time: new Date().toISOString(), task, model, source, success, durationMs, error, tokenUsage };
  aiCallLogs.unshift(log);
  aiCallLogs.splice(100);
  lastAiStatus = {
    lastCallAt: new Date().toISOString(),
    lastSuccessAt: success ? new Date().toISOString() : lastAiStatus.lastSuccessAt,
    lastFailureReason: success ? "" : error,
    lastDurationMs: durationMs,
    lastModel: model,
  };
}

function normalizeRating(value) {
  return ["强烈关注", "积极关注", "中性观察", "等待机会", "风险较高"].includes(value) ? value : scoreToRating(60);
}

function normalizeAction(value) {
  return ["关注", "等待", "持有", "降低仓位", "回避"].includes(value) ? value : "等待";
}

function scoreToTrend(score) {
  if (score >= 80) return "上涨";
  if (score >= 70) return "震荡偏强";
  if (score >= 50) return "震荡";
  if (score >= 35) return "偏弱";
  return "下跌";
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

function asStringList(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : item?.message ?? item?.title ?? JSON.stringify(item)).filter(Boolean);
  if (!value) return [];
  return [String(value)];
}

function flattenEvidence(evidence) {
  if (!evidence) return [];
  if (Array.isArray(evidence)) return evidence.map(String);
  if (typeof evidence === "object") return Object.values(evidence).flatMap(flattenEvidence).filter(Boolean);
  return [String(evidence)];
}
