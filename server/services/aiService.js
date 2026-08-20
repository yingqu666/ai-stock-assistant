const deepseekEndpoint = "https://api.deepseek.com/chat/completions";
const openAiEndpoint = "https://api.openai.com/v1/chat/completions";
const defaultDeepseekModel = "deepseek-chat";
const defaultGenericModel = "gpt-4.1-mini";
const aiTimeoutMs = normalizeTimeout(process.env.AI_TIMEOUT_MS, 15000);
let aiQueue = Promise.resolve();

const reportSchema = {
  stockBasics: {
    name: "股票/ETF名称",
    code: "股票/ETF代码",
    industry: "所属行业",
    assetType: "股票或ETF",
    summary: "股票基本情况",
  },
  currentQuote: {
    price: "当前价格",
    changePercent: "涨跌幅",
    volume: "成交量",
    amount: "成交额",
    turnoverRate: "换手率",
    marketCap: "总市值",
    pe: "PE",
    pb: "PB",
  },
  upsideLogic: ["上涨逻辑或积极因素"],
  valuationAnalysis: "估值分析",
  shortTermObservation: "短期观察，1-5天",
  midLongTermObservation: "中长期观察，1-4周",
  overallJudgement: "综合判断，不输出确定买卖",
  investorFit: {
    score: "0-100",
    level: "高/中/低",
    reasons: ["与用户投资方向匹配的理由"],
    riskReminders: ["结合用户资金规模和风格的风险提醒"],
    positionReference: "仓位参考建议，不输出确定买卖",
  },
  dataSources: {
    quote: "行情来源",
    announcement: "公告来源",
    news: "新闻来源",
    ai: "AI模型来源",
  },
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
    rating: "重点关注/可以观察/等待机会/暂不参与/风险较高",
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

const marketAnalysisSchema = {
  currentMarketJudgment: "当前市场判断：强势/震荡偏强/震荡等待/风险阶段，并说明一句核心理由",
  marketSummary: "今日A股市场分析，必须引用指数、涨跌家数、成交额、涨停跌停、热点板块和新闻",
  mainDirections: [
    {
      name: "今日主线方向",
      reason: "为什么成为主线，基于热点板块、成交额、资金活跃度和新闻",
      relatedSectors: ["相关板块"],
      sustainability: "持续性：强/一般/弱，并说明依据",
      risk: "该方向最大风险",
    },
  ],
  riskReminders: [
    {
      target: "风险对象：市场/板块/股票名称",
      reason: "风险原因，引用行情、资金或新闻",
      shortTermImpact: "短期影响",
      midTermImpact: "中期影响",
    },
  ],
  operationPlan: "操作思路，只能给观察、等待、控制仓位、降低风险暴露，不输出确定买卖",
  investmentDecision: {
    marketTrend: "上涨/震荡偏强/震荡/偏弱/下跌",
    rating: "重点关注/可以观察/等待机会/暂不参与/风险较高",
    score: "0-100，仅作为市场环境参考",
    action: "关注/等待/持有/降低仓位/回避",
    positionAdvice: "0%-100%仓位参考或低仓位/半仓/保持当前仓位/降低仓位",
    reasons: ["判断依据"],
    risks: ["风险条件"],
    watchPoints: ["观察条件"],
  },
  evidence: {
    market: ["指数、涨跌家数、成交额、涨停跌停依据"],
    industry: ["热点板块TOP12依据"],
    news: ["市场新闻、行业新闻或公告依据"],
    risk: ["风险依据"],
  },
  conclusion: "一句话结论，不保证收益，不自动交易",
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

export async function generateMarketAnalysis(input) {
  return runAiJsonTask({
    task: "生成首页AI市场分析，只分析市场环境、主线方向、风险和操作思路，不分析具体买卖股票",
    input: normalizeMarketAnalysisInput(input),
    outputSchema: marketAnalysisSchema,
    fallback: () => fallbackMarketAnalysis(input),
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
              "如果输入dataQuality为insufficient，禁止输出具体评分、技术结论和买卖价格区间，只能说明数据不足。",
              "如果securityType为newStock，禁止输出技术评分、支撑位、压力位、买入区间和卖出区间。",
              "如果securityType为etf，使用ETF模板，不能使用公司主营、公司净利润、ROE、核心竞争力等普通公司模板。",
              "如果securityType为st，必须显著提示退市、流动性、财务和交易风险，不能因短期涨幅给出积极评级。",
              "价格区间只能引用输入priceLevels，不能自行编造具体价格。",
              "可以给出明确的研究判断和评级，但禁止输出保证收益、确定买入、确定卖出等结论。",
              "回答必须是结构化JSON。",
            ].join("\n"),
          },
          { role: "user", content: buildPrompt({ task, input, outputSchema }) },
        ],
        temperature: 0.2,
        max_tokens: 1200,
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
      if (error?.name === "AbortError" || controller.signal.aborted) {
        throw new Error(`AI调用超时 ${timeoutMs}ms`);
      }
      throw new Error(`AI响应JSON解析失败：${error.message}`);
    }
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI返回为空");
    const source = config.provider === "deepseek" ? "deepseek" : "openai";
    const parsed = parseJsonContent(content);
    recordAiCall({ task, model: config.model, startedAt, success: true, source, tokenUsage: json.usage ?? null });
    const normalized = normalizeOutput(parsed, fallback());
    return {
      ...normalized,
      dataSources: { ...(normalized.dataSources ?? {}), ai: source === "deepseek" ? "DeepSeek" : source },
      source,
      tokenUsage: json.usage ?? null,
    };
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
    newsBuckets: input.newsBuckets ?? {},
    dataSources: input.dataSources ?? stockData.dataSources ?? {},
    aiInputSummary: input.aiInputSummary ?? buildCompactInputSummary(input),
  };
}

function normalizeMarketAnalysisInput(input = {}) {
  const marketData = input.marketSnapshot ?? input.marketData ?? {};
  const newsSnapshot = input.newsSnapshot ?? {};
  const newsData = asArray(input.newsData ?? input.newsEvents ?? newsSnapshot.news)
    .concat(asArray(newsSnapshot.stockNews))
    .slice(0, 8)
    .map((item) => ({
      title: trimText(item.title, 140),
      source: item.source,
      time: item.time ?? item.publishedAt,
      category: item.category ?? item.newsType,
      impact: item.impact ?? item.direction,
      relatedIndustry: item.relatedIndustry,
      relatedIndustries: asArray(item.relatedIndustries).slice(0, 4),
      relatedStocks: asArray(item.relatedStocks).slice(0, 5),
      summary: trimText(item.summary ?? item.aiSummary ?? item.analysis?.summary, 220),
    }));
  const sentiment = marketData.marketSentiment ?? {};
  return {
    marketSnapshot: {
      source: marketData.source,
      dataStatus: marketData.dataStatus,
      updatedAt: marketData.updatedAt,
      indexes: asArray(marketData.marketOverview).slice(0, 8),
      breadth: {
        upCount: sentiment.upCount,
        downCount: sentiment.downCount,
        flatCount: sentiment.flatCount,
        limitUpCount: sentiment.limitUpCount,
        limitDownCount: sentiment.limitDownCount,
        turnover: sentiment.turnover ?? findMetric(marketData.marketOverview, "成交")?.value,
        moneyEffect: sentiment.moneyEffect,
        summary: sentiment.summary,
      },
      hotSectors: asArray(marketData.hotSectors).slice(0, 12).map((sector) => ({
        name: sector.name,
        changePercent: sector.changePercent ?? sector.change,
        amount: sector.amount ?? sector.turnover,
        capitalFlow: sector.capitalFlow ?? sector.flow,
        heatRank: sector.heatRank ?? sector.rank,
        reason: trimText(sector.reason ?? sector.aiReason ?? sector.rankingReason, 180),
        risk: trimText(sector.risk, 160),
      })),
    },
    newsSnapshot: {
      source: newsSnapshot.source,
      dataStatus: newsSnapshot.dataStatus,
      updatedAt: newsSnapshot.updatedAt,
      news: newsData,
    },
  };
}

function fallbackMarketAnalysis(input = {}) {
  const marketData = input.marketSnapshot ?? input.marketData ?? {};
  const newsSnapshot = input.newsSnapshot ?? {};
  const newsRows = asArray(input.newsData ?? input.newsEvents ?? newsSnapshot.news);
  const sentiment = marketData.marketSentiment ?? {};
  const sectors = asArray(marketData.hotSectors).slice(0, 5);
  const up = Number(sentiment.upCount ?? 0);
  const down = Number(sentiment.downCount ?? 0);
  const state = up > down * 1.2 ? "震荡偏强" : down > up * 1.2 ? "风险阶段" : "震荡等待";
  const mainDirections = sectors.slice(0, 3).map((sector) => ({
    name: sector.name ?? "热点方向",
    reason: `${sector.name ?? "相关板块"}位于热点TOP，涨跌幅${sector.changePercent ?? sector.change ?? "数据不足"}，成交额${sector.amount ?? sector.turnover ?? "数据不足"}。`,
    relatedSectors: [sector.name].filter(Boolean),
    sustainability: sector.amount || sector.turnover ? "一般：需要继续观察成交额和资金活跃度是否延续。" : "弱：成交额或资金数据不足。",
    risk: sector.risk ?? "热点退潮或指数转弱会降低持续性。",
  }));
  const riskReminders = [
    {
      target: sectors[0]?.name ?? "市场",
      reason: `上涨${sentiment.upCount ?? "数据不足"}家、下跌${sentiment.downCount ?? "数据不足"}家，涨停${sentiment.limitUpCount ?? "数据不足"}家、跌停${sentiment.limitDownCount ?? "数据不足"}家；若赚钱效应转弱需控制风险。`,
      shortTermImpact: "短线可能加大分化，追高性价比下降。",
      midTermImpact: "若成交额不能延续，主线持续性会下降。",
    },
  ];
  return {
    currentMarketJudgment: `${state}：基于涨跌家数、成交额和热点板块强度的规则fallback判断。`,
    marketSummary: `今日市场处于${state}，上涨${sentiment.upCount ?? "数据不足"}家、下跌${sentiment.downCount ?? "数据不足"}家，成交额${sentiment.turnover ?? findMetric(marketData.marketOverview, "成交")?.value ?? "数据不足"}。`,
    mainDirections,
    riskReminders,
    operationPlan: "以观察主线持续性和控制仓位暴露为主，不追高，不输出确定买卖。",
    investmentDecision: {
      marketTrend: state,
      rating: state === "风险阶段" ? "等待机会" : "可以观察",
      score: state === "风险阶段" ? 52 : 68,
      action: "等待",
      positionAdvice: state === "风险阶段" ? "降低仓位" : "低仓位到半仓观察",
      reasons: [
        `涨跌家数：上涨${sentiment.upCount ?? "数据不足"}，下跌${sentiment.downCount ?? "数据不足"}`,
        `热点板块：${sectors.map((item) => item.name).filter(Boolean).join("、") || "数据不足"}`,
        `新闻数量：${newsRows.length}`,
      ],
      risks: riskReminders.map((item) => `${item.target}：${item.reason}`),
      watchPoints: ["热点板块成交额是否延续", "涨跌家数是否继续改善", "重要新闻是否改变风险偏好"],
    },
    hotDirections: mainDirections,
    risks: riskReminders.map((item) => `${item.target}：${item.reason}`),
    tomorrowPlan: ["观察TOP热点板块是否延续", "检查成交额和涨停数量变化", "关注市场新闻是否出现利空"],
    evidence: {
      market: [`上涨${sentiment.upCount ?? "数据不足"}家，下跌${sentiment.downCount ?? "数据不足"}家`, `成交额${sentiment.turnover ?? "数据不足"}`],
      industry: sectors.map((item) => `${item.name} ${item.changePercent ?? item.change ?? ""}`).filter(Boolean),
      news: newsRows.slice(0, 3).map((item) => `${item.title ?? "新闻"}（${item.source ?? "来源未返回"}）`),
      risk: riskReminders.map((item) => item.reason),
    },
    conclusion: `${state}，以观察主线和风险控制为主。`,
    source: "fallback",
  };
}

function compactAiInput(input = {}) {
  const normalized = normalizeAiInput(input);
  const stockRelatedNews = asArray(normalized.newsBuckets.stockRelated);
  const primaryNews = (stockRelatedNews.length ? stockRelatedNews : normalized.newsData).slice(0, 3).map(compactEvent);
  return {
    question: trimText(normalized.question, 160),
    marketData: compactMarketData(normalized.marketData),
    stockData: compactStockData(normalized.stockData),
    newsData: primaryNews,
    newsBuckets: {
      stockRelated: primaryNews,
      marketGeneral: stockRelatedNews.length ? [] : asArray(normalized.newsBuckets.marketGeneral).slice(0, 1).map(compactEvent),
    },
    announcementData: (normalized.announcementData ?? []).slice(0, 3).map(compactEvent),
    investmentProfile: compactPlainObject(normalized.investmentProfile, 8, 120),
    riskData: asArray(normalized.riskData).slice(0, 3).map((item) => typeof item === "string" ? trimText(item, 160) : compactPlainObject(item, 5, 120)),
    portfolio: asArray(normalized.portfolio).slice(0, 5).map((item) => compactPlainObject(item, 6, 120)),
    historyReports: asArray(normalized.historyReports).slice(0, 1).map((item) => compactPlainObject(item, 5, 120)),
    aiHistory: asArray(normalized.aiHistory).slice(0, 2).map((item) => compactPlainObject(item, 5, 120)),
    historicalReflection: trimText(normalized.historicalReflection, 200),
    dataSources: compactPlainObject(normalized.dataSources, 8, 120),
    aiInputSummary: compactPlainObject(normalized.aiInputSummary, 8, 120),
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
    securityType: stock.securityType,
    securityProfile: compactPlainObject(stock.securityProfile ?? {}, 8, 120),
    dataQuality: compactPlainObject(stock.dataQuality ?? {}, 8, 140),
    priceLevels: compactPlainObject(stock.priceLevels ?? {}, 8, 160),
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
    quoteSource: stock.quoteSource,
    newsSource: stock.newsSource,
    announcementSource: stock.announcementSource,
    aiSource: stock.aiSource,
    dataSources: compactPlainObject(stock.dataSources ?? {}, 8, 160),
    dataStatus: stock.dataStatus,
    updatedAt: stock.updatedAt,
    profile: trimText(stock.profile, 220),
    mainBusiness: trimText(stock.mainBusiness, 180),
    industryPosition: trimText(stock.industryPosition, 160),
    financials: compactPlainObject(stock.financials ?? {}, 12, 120),
    announcements: (stock.announcements ?? []).slice(0, 3).map(compactEvent),
  };
}

function compactEvent(event = {}) {
  return {
    title: trimText(event.title, 120),
    source: trimText(event.source, 80),
    time: event.time ?? event.date,
    category: trimText(event.category ?? event.type, 80),
    impact: trimText(event.impact ?? event.analysis?.impact, 160),
    direction: trimText(event.analysis?.direction, 80),
    relationType: event.relationType,
    dataStatus: trimText(event.dataStatus, 100),
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

function findMetric(metrics = [], keyword = "") {
  return asArray(metrics).find((item) => String(item?.label ?? "").includes(keyword)) ?? null;
}

function normalizeTimeout(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 15000);
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
      "只基于输入数据做A股/ETF投研，不编造行情、新闻、公告或财务。",
      "报告必须简短，固定包含：股票概况、看好逻辑、风险因素、估值分析、短期观察、长期观察、仓位参考。",
      "必须引用当前价格、涨跌幅、成交额、PE、PB、行业；如果财务字段存在，也要引用ROE和净利润。",
      "新闻最多使用输入中的3条，公告最多使用3条，优先个股相关新闻，保留真实来源名称。",
      "结合投资者画像输出匹配度、关注理由、风险提醒和仓位参考。",
      "评级只能使用：重点关注、可以观察、等待机会、暂不参与、风险较高。",
      "评分只能作为辅助信息，必须先给当前判断，再说明行业、行情、财务、新闻、公告和风险依据。",
      "action只能使用：关注、等待、持有、降低仓位、回避。",
      "禁止确定买入、确定卖出、保证收益。没有数据时明确写数据缺失。",
    ],
    requiredInputFields: ["marketData", "stockData", "newsData", "announcementData", "investmentProfile", "riskData"],
    input,
    outputSchema: compactOutputSchema(outputSchema),
  }, null, 2);
}

function buildLegacyPrompt({ task, input, outputSchema }) {
  return JSON.stringify({
    task,
    rules: [
      "股票研究报告固定包含：股票基本情况、当前行情、上涨逻辑、风险因素、估值分析、短期观察、中长期观察、综合判断。",
      "同时保留兼容字段：companyAnalysis、recentChanges、investmentLogic、riskAnalysis、investmentDecision。",
      "当前行情必须引用输入中的价格、涨跌幅、成交量、成交额、换手率、总市值、PE、PB和所属行业；缺失字段要明确说明为空或数据源未返回。",
      "新闻使用优先级：先使用newsBuckets.stockRelated个股相关新闻，再使用newsBuckets.marketGeneral市场通用新闻；禁止把市场新闻说成个股新闻。",
      "必须保留输入中的真实source名称，不要把东方财富资讯改写成财联社或其它来源。",
      "报告必须输出dataSources，包含行情来源、公告来源、新闻来源、AI模型来源。",
      "必须结合investmentProfile输出investorFit，包含与用户投资方向匹配度、关注理由、风险提醒、仓位参考建议。",
      "用户画像限制：只能A股，资金规模几万元，当前试水资金5000元，投资风格偏成长科技，关注AI基础设施、芯片、电力、储能、资源、国产替代、光模块、光刻机。",
      "仓位参考只能使用低仓位观察、保持观察仓位、降低暴露、暂不增加仓位等表达，不能输出确定买入或确定卖出。",
      "股票研究报告固定包含【公司/标的分析】【近期变化】【投资逻辑】【风险分析】【AI投资判断】。",
      "每日市场报告固定包含【今日A股市场分析】【今日热点方向】【明日市场观察】。",
      "今日热点方向必须根据输入的hotSectors、行业新闻和市场变化选TOP5，不要固定只看AI、半导体、电力。",
      "AI投资判断必须包含综合评分、评级、短期趋势、中期趋势、关注条件、风险条件。",
      "评级只能使用：重点关注、可以观察、等待机会、暂不参与、风险较高。",
      "评分只能作为辅助信息，必须先给当前判断，再说明行业、行情、财务、新闻、公告和风险依据。",
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

function compactOutputSchema() {
  return {
    stockBasics: { name: "名称", code: "代码", industry: "行业", assetType: "股票/ETF", summary: "股票概况" },
    currentQuote: { price: "当前价格", changePercent: "涨跌幅", volume: "成交量", amount: "成交额", turnoverRate: "换手率", marketCap: "总市值", pe: "PE", pb: "PB" },
    assetProfile: { assetType: "股票/ETF", stockStyle: "成长/价值/周期/ETF/综合", industry: "行业", summary: "类型判断" },
    industryLogic: { industry: "行业", logic: "行业逻辑", catalysts: ["催化因素"], marketReference: ["市场参考"] },
    financialReview: { status: "状态", source: "财务来源", revenue: "营收", netProfit: "净利润", roe: "ROE", grossMargin: "毛利率", netMargin: "净利率", debtRatio: "资产负债率", cashFlow: "现金流", summary: "财务评价" },
    valuationReview: { pe: "PE", pb: "PB", level: "估值状态", summary: "估值评价" },
    scoreBreakdown: { industryTrend: "行业趋势0-20", financialQuality: "财务质量0-20", valuationLevel: "估值水平0-20", marketAttention: "市场关注0-20", riskControl: "风险控制0-20", total: "综合0-100", classification: "成长/价值/周期/ETF/综合" },
    riskLevel: "低/中/高",
    investorMatch: { score: "0-100", level: "高/中/低", reasons: ["匹配理由"], riskReminders: ["风险提醒"], positionReference: "仓位参考" },
    upsideLogic: ["看好逻辑，最多3条"],
    valuationAnalysis: "估值分析，引用PE/PB和可用财务",
    shortTermObservation: "短期观察，1-5天",
    midLongTermObservation: "长期观察，1-4周",
    riskAnalysis: { industryRisks: ["行业风险"], companyRisks: ["公司/标的风险"], marketRisks: ["市场风险"] },
    investmentDecision: { score: "0-100辅助分", rating: "重点关注/可以观察/等待机会/暂不参与/风险较高", action: "关注/等待/持有/降低仓位/回避", positionAdvice: "仓位参考", reasons: ["必须引用行业/行情/财务/新闻/公告依据"], risks: ["风险"], watchPoints: ["观察条件"] },
    investorFit: { score: "0-100", level: "高/中/低", reasons: ["匹配理由"], riskReminders: ["风险提醒"], positionReference: "仓位参考" },
    dataSources: { quote: "行情来源", announcement: "公告来源", news: "新闻来源", ai: "DeepSeek" },
    evidence: { stock: ["行情/行业依据"], news: ["新闻依据"], announcement: ["公告依据"], financial: ["财务依据"], risk: ["风险依据"] },
    conclusion: "一句话综合判断",
  };
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
  const dataSources = buildReportDataSources(normalized, "fallback");
  const stockBasics = buildStockBasics(stock);
  const currentQuote = buildCurrentQuote(stock);
  const investorFit = buildInvestorFit(normalized);
  const assetProfile = buildAssetProfile(stock);
  const industryLogic = buildIndustryLogic(stock, market, news);
  const financialReview = buildFinancialReview(stock);
  const valuationReview = buildValuationReview(stock);
  const scoreBreakdown = buildScoreBreakdown(normalized, investmentDecision.score);
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
    stockData: stock,
    stockBasics,
    currentQuote,
    assetProfile,
    industryLogic,
    financialReview,
    valuationReview,
    scoreBreakdown,
    riskLevel: buildRiskLevel(investmentDecision.score, riskAnalysis),
    investorMatch: investorFit,
    upsideLogic: investmentDecision.reasons.slice(0, 5),
    valuationAnalysis: buildValuationAnalysis(stock),
    shortTermObservation: investmentDecision.shortTerm,
    midLongTermObservation: investmentDecision.midTerm,
    overallJudgement: buildOverallJudgement(investmentDecision, stock),
    investorFit,
    dataSources,
    companyAnalysis,
    recentChanges,
    investmentLogic,
    riskAnalysis,
    investmentDecision,
    marketSummary: buildMarketSummary(market),
    coreLogic: "结合指数表现、成交额、涨跌家数、热点行业、新闻公告和用户关注标的进行结构化研究。",
    industryAnalysis: formatHotDirections(hotDirections),
    stockAnalysis: buildStockAnalysisText(stock, investmentDecision),
    hotDirections,
    opportunities: hotDirections.map((item) => item.name).slice(0, 5),
    risks: flattenRiskAnalysis({ riskAnalysis, investmentDecision }).slice(0, 8),
    tomorrowPlan: [
      "观察指数和成交额是否延续",
      ...hotDirections.slice(0, 3).map((item) => `跟踪${item.name}持续性`),
      stock.code ? `复核${stock.name ?? stock.code}公告、新闻和成交变化` : "检查自选股公告和新闻变化",
    ].slice(0, 6),
    conclusion: buildOverallJudgement(investmentDecision, stock),
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
  const investmentDecision = applyQualityGate(normalizeInvestmentDecision(output.investmentDecision ?? fallback.investmentDecision, fallback), fallback.stockData ?? fallback.stockBasics ?? fallback);
  const evidence = output.evidence ?? output.conclusionBasis ?? fallback.evidence ?? {};
  const basis = Array.isArray(output.basis) ? output.basis : flattenEvidence(evidence);
  const riskAnalysis = output.riskAnalysis ?? fallback.riskAnalysis;
  return {
    ...fallback,
    ...output,
    stockBasics: output.stockBasics ?? fallback.stockBasics,
    currentQuote: output.currentQuote ?? fallback.currentQuote,
    assetProfile: output.assetProfile ?? fallback.assetProfile,
    industryLogic: output.industryLogic ?? fallback.industryLogic,
    financialReview: output.financialReview ?? fallback.financialReview,
    valuationReview: output.valuationReview ?? fallback.valuationReview,
    scoreBreakdown: output.scoreBreakdown ?? fallback.scoreBreakdown,
    riskLevel: output.riskLevel ?? fallback.riskLevel,
    investorMatch: output.investorMatch ?? output.investorFit ?? fallback.investorMatch ?? fallback.investorFit,
    upsideLogic: Array.isArray(output.upsideLogic) ? output.upsideLogic : fallback.upsideLogic,
    valuationAnalysis: output.valuationAnalysis ?? fallback.valuationAnalysis,
    shortTermObservation: output.shortTermObservation ?? fallback.shortTermObservation,
    midLongTermObservation: output.midLongTermObservation ?? fallback.midLongTermObservation,
    overallJudgement: output.overallJudgement ?? fallback.overallJudgement,
    investorFit: output.investorFit ?? fallback.investorFit,
    dataSources: output.dataSources ?? fallback.dataSources,
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

function buildStockBasics(stock = {}) {
  return {
    name: stock.name ?? "",
    code: stock.code ?? "",
    industry: stock.industry ?? "",
    assetType: stock.assetType ?? "",
    summary: `${stock.name ?? stock.code ?? "当前标的"}属于${stock.industry || "行业数据暂缺"}，类型为${stock.assetType || "股票/ETF"}。`,
  };
}

function buildCurrentQuote(stock = {}) {
  return {
    price: stock.price ?? "",
    changePercent: stock.changePercent ?? "",
    volume: stock.volume ?? "",
    amount: stock.amount ?? "",
    turnoverRate: stock.turnoverRate ?? "",
    marketCap: stock.marketCap ?? "",
    pe: stock.pe ?? "",
    pb: stock.pb ?? "",
  };
}

function buildAssetProfile(stock = {}) {
  return {
    assetType: stock.assetType ?? "股票",
    stockStyle: classifyStockStyle(stock),
    industry: stock.industry ?? "行业数据暂缺",
    summary: `${stock.name ?? stock.code ?? "当前标的"}属于${stock.industry ?? "行业数据暂缺"}，类型判断为${classifyStockStyle(stock)}。`,
  };
}

function classifyStockStyle(stock = {}) {
  if (stock.assetType === "ETF") return "ETF";
  const text = `${stock.name ?? ""}${stock.industry ?? ""}${stock.mainBusiness ?? ""}`;
  if (/煤炭|石油|有色|钢铁|化工|玻璃|玻纤|资源/.test(text)) return "周期";
  if (/银行|保险|白酒|消费|公用事业|高速|电力/.test(text)) return "价值";
  if (/半导体|芯片|软件|电池|新能源|通信|AI|人工智能|光模块|创新/.test(text)) return "成长";
  const pe = parseNumeric(stock.pe);
  const pb = parseNumeric(stock.pb);
  if (Number.isFinite(pe) && pe > 45) return "成长";
  if (Number.isFinite(pb) && pb < 1.2) return "价值";
  return "综合";
}

function parseNumeric(value) {
  const text = String(value ?? "").replace(/,/g, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function isMissingField(value) {
  const text = String(value ?? "").trim();
  return !text || /暂无|缺失|未返回|不适用|接口异常|数据源未返回/.test(text);
}

function buildIndustryLogic(stock = {}, market = {}, news = []) {
  const relatedNews = asArray(news).slice(0, 3).map((item) => item.title).filter(Boolean);
  return {
    industry: stock.industry ?? "行业数据暂缺",
    logic: stock.assetType === "ETF"
      ? `ETF重点观察跟踪方向、成交额和成分行业热度，当前成交额${stock.amount ?? "数据源未返回"}。`
      : `${stock.industry ?? "行业"}方向需要结合行业景气、政策催化和成交活跃度观察。`,
    catalysts: relatedNews,
    marketReference: asArray(market.hotSectors).slice(0, 3).map((item) => item.name ?? item).filter(Boolean),
  };
}

function buildFinancialReview(stock = {}) {
  const f = stock.financials ?? {};
  if (stock.assetType === "ETF") {
    return { status: "not_applicable", summary: "ETF不适用公司财务指标，重点看跟踪指数、规模、流动性和成分方向。" };
  }
  if (f.hasFatalIssue || (f.issues ?? []).length) {
    return {
      status: "invalid",
      source: f.source ?? "财务来源未返回",
      reportDate: f.reportDate ?? "",
      revenue: f.revenue ?? "",
      netProfit: f.netProfit ?? "",
      roe: f.roe ?? "不适用",
      grossMargin: f.grossMargin ?? "",
      netMargin: f.netMargin ?? "",
      debtRatio: f.debtRatio ?? "",
      cashFlow: f.cashFlow ?? "",
      issues: f.issues ?? [],
      summary: `财务字段异常：${(f.issues ?? []).join("；") || "存在异常字段"}。不进行正常财务评分。`,
    };
  }
  const available = ["revenue", "netProfit", "roe", "grossMargin", "netMargin", "debtRatio", "cashFlow"].filter((key) => !isMissingField(f[key]));
  return {
    status: f.status ?? (available.length ? "partial" : "unavailable"),
    source: f.source ?? "财务来源未返回",
    reportDate: f.reportDate ?? "",
    revenue: f.revenue ?? "",
    netProfit: f.netProfit ?? "",
    roe: f.roe ?? "",
    grossMargin: f.grossMargin ?? "",
    netMargin: f.netMargin ?? "",
    debtRatio: f.debtRatio ?? "",
    cashFlow: f.cashFlow ?? "",
    summary: available.length
      ? `财务可用字段${available.length}/7：营收${f.revenue ?? "缺失"}，净利润${f.netProfit ?? "缺失"}，ROE${f.roe ?? "缺失"}，毛利率${f.grossMargin ?? "缺失"}。`
      : "财务数据缺失，AI分析需要降低基本面权重。",
  };
}

function buildValuationReview(stock = {}) {
  if (stock.assetType === "ETF") {
    return { status: "not_applicable", summary: "ETF不使用公司PE/PB作为核心估值，重点看跟踪指数估值和资金流向。" };
  }
  const pe = parseNumeric(stock.pe);
  const pb = parseNumeric(stock.pb);
  const peLabel = Number.isFinite(pe) ? (pe > 60 ? "偏高" : pe < 12 ? "偏低" : "中性") : "缺失";
  const pbLabel = Number.isFinite(pb) ? (pb > 6 ? "偏高" : pb < 1.2 ? "偏低" : "中性") : "缺失";
  return {
    pe: stock.pe ?? "",
    pb: stock.pb ?? "",
    level: peLabel === "偏高" || pbLabel === "偏高" ? "偏高" : peLabel === "缺失" && pbLabel === "缺失" ? "数据不足" : "可观察",
    summary: `PE ${stock.pe ?? "缺失"}（${peLabel}），PB ${stock.pb ?? "缺失"}（${pbLabel}），需结合行业属性和盈利质量判断。`,
  };
}

function buildRiskLevel(score, riskAnalysis = {}) {
  const riskCount = flattenRiskAnalysis({ riskAnalysis }).length;
  if (score < 55 || riskCount >= 7) return "高";
  if (score < 70 || riskCount >= 4) return "中";
  return "低";
}

function buildScoreBreakdown(input = {}, totalScore = 60) {
  const stock = input.stockData ?? {};
  const industryTrend = scoreIndustryTrend(stock, input.marketData);
  const financialQuality = scoreFundamental(stock);
  const valuationLevel = scoreValuation(stock);
  const marketAttention = scoreCapital(stock, input.marketData);
  const riskControl = Math.max(0, Math.min(20, 20 - asArray(input.riskData).length * 3));
  return {
    industryTrend,
    financialQuality,
    valuationLevel,
    marketAttention,
    riskControl,
    total: clampScore(totalScore),
    classification: classifyStockStyle(stock),
  };
}

function scoreIndustryTrend(stock = {}, market = {}) {
  const industry = String(stock.industry ?? "");
  const matched = asArray(market.hotSectors).some((item) => industry && (String(item.name).includes(industry) || industry.includes(item.name)));
  if (matched) return 17;
  if (/半导体|芯片|AI|人工智能|电池|新能源|软件|通信|煤炭|白酒|银行/.test(industry)) return 13;
  return 10;
}

function scoreValuation(stock = {}) {
  if (stock.assetType === "ETF") return 12;
  const pe = parseNumeric(stock.pe);
  const pb = parseNumeric(stock.pb);
  let score = 10;
  if (Number.isFinite(pe) && pe > 0 && pe < 35) score += 5;
  if (Number.isFinite(pb) && pb > 0 && pb < 4) score += 4;
  if (Number.isFinite(pe) && pe > 80) score -= 4;
  if (Number.isFinite(pb) && pb > 8) score -= 3;
  return Math.max(0, Math.min(20, score));
}

function buildValuationAnalysis(stock = {}) {
  if (stock.assetType === "ETF") {
    return `ETF标的不适用公司PE/PB财务估值，重点观察跟踪方向、成交额、基金规模和资金活跃度；当前成交额${stock.amount || "数据源未返回"}。`;
  }
  return `估值观察：PE ${stock.pe || "数据源未返回"}，PB ${stock.pb || "数据源未返回"}，总市值${stock.marketCap || "数据源未返回"}；需要结合行业估值和财务质量复核。`;
}

function buildInvestorFit(input = {}) {
  const stock = input.stockData ?? {};
  const profile = input.investmentProfile ?? {};
  const focuses = asArray(profile.focusIndustries ?? profile.focus ?? profile.industries);
  const text = `${stock.name ?? ""}${stock.industry ?? ""}${stock.assetType ?? ""}${stock.trackingIndex ?? ""}${asArray(stock.components).join("")}`;
  const matched = focuses.filter((item) => item && text.includes(item));
  const themeMatched = focuses.filter((item) => item && inferThemeMatch(text, item));
  const allMatched = [...new Set([...matched, ...themeMatched])];
  const score = Math.min(100, 45 + allMatched.length * 12 + (stock.assetType === "ETF" && allMatched.length ? 8 : 0));
  const level = score >= 75 ? "高" : score >= 55 ? "中" : "低";
  return {
    score,
    level,
    matchedDirections: allMatched,
    reasons: allMatched.length
      ? allMatched.slice(0, 4).map((item) => `标的与用户关注方向“${item}”存在关联，需要结合行情、新闻和公告继续验证。`)
      : ["当前标的与用户成长科技方向的直接匹配度不高，更多作为分散观察或基本面研究对象。"],
    riskReminders: [
      `用户当前试水资金${profile.trialCapital ?? "5000元"}，单一标的不宜过度集中。`,
      `用户偏${profile.style ?? "成长科技方向"}，需防范题材波动和估值回撤。`,
      "如果行情、新闻或公告数据不完整，需要降低本次判断权重。",
    ],
    positionReference: score >= 75 ? "低仓位观察，等待数据和趋势继续确认" : score >= 55 ? "保持观察仓位，不因单日波动提高暴露" : "暂不增加仓位，优先等待更明确的匹配信号",
  };
}

function inferThemeMatch(text, theme) {
  const source = String(text ?? "");
  const target = String(theme ?? "");
  const groups = {
    "AI基础设施": /AI|人工智能|算力|服务器|光模块|通信|芯片|电力/,
    "芯片": /芯片|半导体|集成电路|科创半导体/,
    "电力": /电力|电网|能源|储能/,
    "储能": /储能|电池|新能源|电力设备/,
    "资源": /资源|煤炭|有色|石油|化工|玻纤|玻璃/,
    "国产替代": /国产|替代|半导体|光刻机|芯片|信创/,
    "光模块": /光模块|光通信|通信|CPO/,
    "光刻机": /光刻机|半导体设备|芯片设备/,
  };
  return groups[target]?.test(source) ?? source.includes(target);
}

function buildReportDataSources(input = {}, aiSource = "fallback") {
  const sources = input.dataSources ?? input.stockData?.dataSources ?? {};
  const newsSources = [...new Set(asArray(input.newsData).map((item) => item.source).filter(Boolean))];
  const announcementSources = [...new Set(asArray(input.announcementData).map((item) => item.source).filter(Boolean))];
  return {
    quote: sources.quote ?? input.stockData?.quoteSource ?? input.stockData?.dataSource ?? "行情来源未返回",
    announcement: sources.announcement ?? (announcementSources.length ? announcementSources.join(" / ") : "公告来源未返回"),
    news: sources.news ?? (newsSources.length ? newsSources.join(" / ") : "新闻来源未返回"),
    ai: aiSource === "deepseek" ? "DeepSeek" : aiSource,
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
  return applyQualityGate({
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
  }, stock);
}

function applyQualityGate(decision = {}, stock = {}) {
  const quality = stock.dataQuality ?? {};
  const profile = stock.securityProfile ?? {};
  const securityType = stock.securityType ?? profile.securityType;
  if (quality.level === "insufficient") {
    return {
      ...decision,
      score: "数据不足，无法评分",
      rating: "暂不参与",
      marketTrend: "数据不足",
      shortTerm: "关键行情/财务/新闻字段缺失，无法生成可靠短线判断。",
      midTerm: "数据不足，需等待真实数据补齐后再观察。",
      action: "等待",
      positionAdvice: "不增加仓位",
      probability: { up: "不生成", flat: "不生成", down: "不生成" },
      reasons: [quality.message ?? "数据不足，无法生成可靠判断。"],
      risks: [...asStringList(decision.risks), ...(quality.missingFields ?? []).map((item) => `缺失字段：${item}`)].slice(0, 6),
      watchPoints: ["等待真实行情、公告、财务和新闻数据补齐。"],
    };
  }
  if (securityType === "newStock") {
    return {
      ...decision,
      score: "新股不评分",
      rating: "等待机会",
      shortTerm: "新股历史数据不足，暂不生成技术趋势判断。",
      midTerm: "等待更多交易日、换手率和公告数据验证。",
      action: "等待",
      positionAdvice: "不增加仓位",
      reasons: ["新股上市交易日不足，历史价格和技术样本不足。"],
      risks: [...asStringList(decision.risks), "新股波动大，技术价格区间无可靠样本。"].slice(0, 6),
    };
  }
  if (securityType === "st") {
    const numeric = Number(decision.score);
    return {
      ...decision,
      score: Number.isFinite(numeric) ? Math.min(numeric, 45) : decision.score,
      rating: "风险较高",
      action: "回避",
      positionAdvice: "降低风险暴露",
      risks: ["ST/*ST退市风险", "流动性风险", "财务风险", ...asStringList(decision.risks)].slice(0, 6),
    };
  }
  return decision;
}

function buildOverallJudgement(decision = {}, stock = {}) {
  if (stock.dataQuality?.level === "insufficient") return "数据不足，无法生成可靠判断；当前只展示真实返回的数据。";
  if ((stock.securityType ?? stock.securityProfile?.securityType) === "newStock") return "新股历史数据不足，暂不生成技术评分和买卖价格区间，谨慎交易。";
  return `当前AI判断：${decision.rating}；${typeof decision.score === "number" ? `综合评分${decision.score}/100仅作辅助，` : `${decision.score ?? "不评分"}，`}策略为${decision.action}。`;
}

function buildStockAnalysisText(stock = {}, decision = {}) {
  const type = stock.securityType ?? stock.securityProfile?.securityType;
  if (stock.dataQuality?.level === "insufficient") return "关键数据严重缺失，AI不生成硬性结论。";
  if (type === "etf") return `${stock.name ?? stock.code}：ETF分析以跟踪方向、成交额、流动性和板块持续性为主，当前判断${decision.rating}。`;
  if (type === "newStock") return `${stock.name ?? stock.code}：新股样本不足，只观察上市后换手、成交额和公告，不生成技术区间。`;
  if (type === "st") return `${stock.name ?? stock.code}：ST风险权重优先，当前判断${decision.rating}，不因短期涨幅降低退市和流动性风险。`;
  return `${stock.name ?? stock.code ?? "当前标的"}：当前判断 ${decision.rating}，${typeof decision.score === "number" ? `综合评分 ${decision.score}/100仅作辅助，` : ""}核心依据来自行情、行业、新闻公告和财务变化。`;
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
    user: {
      preference: input.investmentProfile ?? input.profile ?? {},
      focusIndustries: input.investmentProfile?.focusIndustries ?? input.investmentProfile?.industries ?? [],
      capitalSize: input.investmentProfile?.capitalSize,
      trialCapital: input.investmentProfile?.trialCapital,
      style: input.investmentProfile?.style,
      riskData: input.riskData ?? input.risks ?? [],
    },
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
  if (stock.dataQuality?.level === "insufficient" || stock.financials?.hasFatalIssue) return 0;
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
  const evidence = result.evidence ?? {};
  return [
    "【AI投资判断】",
    `当前判断：${decision.rating ?? "可以观察"}`,
    `综合评分：${decision.score ?? 60}/100（辅助参考，不代表可以买）`,
    `趋势：${decision.marketTrend ?? "震荡"}`,
    `短期：${decision.shortTerm ?? "1-5天观察"}`,
    `中期：${decision.midTerm ?? "1-4周观察"}`,
    `策略：${decision.action ?? "等待"}，${decision.positionAdvice ?? "保持当前仓位"}`,
    "",
    "【依据】",
    `行业：${flattenEvidence(evidence.industry ?? result.industryLogic?.marketReference ?? []).slice(0, 2).join("；") || "行业数据不足"}`,
    `行情：${flattenEvidence(evidence.stock ?? result.currentQuote ?? []).slice(0, 3).join("；") || "行情数据不足"}`,
    `财务：${flattenEvidence(evidence.financial ?? result.financialReview?.summary ?? []).slice(0, 2).join("；") || "财务数据不足"}`,
    `新闻：${flattenEvidence(evidence.news ?? []).slice(0, 2).join("；") || "新闻数据不足"}`,
    `公告：${flattenEvidence(evidence.announcement ?? []).slice(0, 2).join("；") || "公告数据不足"}`,
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
  const raw = String(content ?? "");
  const candidates = [
    raw,
    raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, ""),
    extractJsonObject(raw),
  ].filter(Boolean);
  const errors = [];
  for (const candidate of candidates) {
    try {
      return JSON.parse(cleanJsonText(candidate));
    } catch (error) {
      errors.push(error.message);
    }
  }
  console.warn("[ai-json-parse-failed]", {
    length: raw.length,
    preview: trimText(raw, 500),
    errors: errors.slice(0, 3),
  });
  throw new Error(`AI响应JSON解析失败：${errors[0] ?? "无法解析模型返回"}`);
}

function extractJsonObject(text) {
  const source = String(text ?? "");
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return source.slice(start, end + 1);
}

function cleanJsonText(text) {
  return String(text ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .replace(/[\u0000-\u001F\u007F]/g, (char) => ["\n", "\r", "\t"].includes(char) ? char : "");
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
  const mapped = {
    强烈关注: "重点关注",
    积极关注: "重点关注",
    中性观察: "可以观察",
    降低关注: "暂不参与",
    回避: "风险较高",
  };
  const normalized = mapped[value] ?? value;
  return ["重点关注", "可以观察", "等待机会", "暂不参与", "风险较高"].includes(normalized) ? normalized : scoreToRating(60);
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
  if (score >= 78) return "重点关注";
  if (score >= 62) return "可以观察";
  if (score >= 40) return "等待机会";
  if (score >= 25) return "暂不参与";
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
