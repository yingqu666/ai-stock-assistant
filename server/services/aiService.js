const reportSchema = {
  marketSummary: "市场环境判断",
  coreLogic: "当前主线",
  industryAnalysis: "热点行业分析",
  stockAnalysis: "我的股票影响",
  risks: ["风险因素"],
  opportunities: ["研究机会"],
  tomorrowPlan: ["明日观察"],
  evidence: {
    market: ["市场判断依据"],
    industry: ["行业判断依据"],
    stock: ["股票判断依据"],
    risk: ["风险判断依据"],
  },
};

const aiCallLogs = [];
const aiTimeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 18000);
let lastAiStatus = {
  lastCallAt: null,
  lastSuccessAt: null,
  lastFailureReason: "",
  lastDurationMs: null,
  lastModel: process.env.AI_MODEL ?? "gpt-4.1-mini",
};

export function getAiRuntimeStatus() {
  const mode = process.env.AI_MODE === "api" && process.env.AI_API_ENDPOINT && process.env.AI_API_KEY ? "api" : "fallback";
  return {
    mode,
    provider: process.env.AI_PROVIDER ?? (mode === "api" ? "openai-compatible" : "fallback"),
    endpointConfigured: Boolean(process.env.AI_API_ENDPOINT),
    model: process.env.AI_MODEL ?? "gpt-4.1-mini",
    hasApiKey: Boolean(process.env.AI_API_KEY),
    ...lastAiStatus,
  };
}

export function getAiCallLogs() {
  return aiCallLogs.slice(0, 100);
}

export async function generateResearchReport(input) {
  return runAiJsonTask({
    task: "生成A股投资研究报告",
    input,
    outputSchema: reportSchema,
    fallback: () => fallbackReport(input),
  });
}

export async function answerInvestmentQuestion(question, input) {
  const result = await runAiJsonTask({
    task: "回答用户关于A股市场、行业、个股或组合的问题",
    input: { question, ...input },
    outputSchema: {
      answer: "string",
      evidence: ["使用到的行情、新闻、组合或历史依据"],
      risks: ["需要提醒的风险"],
      followUp: ["下一步可观察事项"],
    },
    fallback: () => fallbackAnswer(question, input),
  });

  return {
    answer: result.answer,
    evidence: result.evidence ?? [],
    risks: result.risks ?? [],
    followUp: result.followUp ?? [],
    quality: scoreAiQuality(result, input),
    source: result.source ?? "fallback",
  };
}

export async function runResearchTeam(input) {
  const report = await generateResearchReport(input);
  return {
    agents: [
      { name: "市场分析师", responsibility: "指数、成交量、市场情绪", output: report.marketSummary },
      { name: "行业分析师", responsibility: "热点行业、产业链、政策影响", output: report.industryAnalysis },
      { name: "公司分析师", responsibility: "公告、财报、业务变化", output: report.stockAnalysis },
      { name: "技术分析师", responsibility: "趋势、成交、波动", output: buildTechnicalView(input) },
      { name: "风险分析师", responsibility: "风险因素、反方观点、组合暴露", output: (report.risks ?? []).join("；") },
      { name: "投资经理AI", responsibility: "综合分析并输出研究报告", output: report.coreLogic },
    ],
    report,
  };
}

export function buildReportTemplate(report) {
  return {
    title: "AI投资研究报告",
    sections: [
      { title: "市场环境判断", content: report.marketSummary, evidence: report.evidence?.market ?? [] },
      { title: "当前主线", content: report.coreLogic, evidence: [...(report.evidence?.market ?? []), ...(report.evidence?.industry ?? [])] },
      { title: "热点行业分析", content: report.industryAnalysis, evidence: report.evidence?.industry ?? [] },
      { title: "我的股票影响", content: report.stockAnalysis, evidence: report.evidence?.stock ?? [] },
      { title: "风险因素", content: report.risks, evidence: report.evidence?.risk ?? [] },
      { title: "明日观察", content: report.tomorrowPlan, evidence: report.evidence?.market ?? [] },
    ],
    disclaimer: "本报告仅用于投资研究观察，不构成确定买入、卖出、满仓、清仓等交易建议。",
  };
}

async function runAiJsonTask({ task, input, outputSchema, fallback }) {
  const startedAt = Date.now();
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";
  if (process.env.AI_MODE !== "api" || !process.env.AI_API_ENDPOINT || !process.env.AI_API_KEY) {
    recordAiCall({ task, model, startedAt, success: true, source: "fallback", tokenUsage: null });
    return { ...fallback(), source: "fallback" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiTimeoutMs);

  try {
    const response = await fetch(process.env.AI_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "你是A股投资研究助手。只做研究分析、风险提示和观察计划，不输出确定买入、卖出、满仓、清仓等指令。所有结论必须引用输入中的具体数据依据；数据不足时必须明确说明。必须输出JSON。",
          },
          { role: "user", content: buildPrompt({ task, input, outputSchema }) },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI返回为空");
    recordAiCall({ task, model, startedAt, success: true, source: "ai-api", tokenUsage: json.usage ?? null });
    return { ...normalizeOutput(parseJsonContent(content), fallback()), source: "ai-api", tokenUsage: json.usage ?? null };
  } catch (error) {
    const message = error.name === "AbortError" ? `AI调用超时 ${aiTimeoutMs}ms` : error.message;
    console.warn("AI API failed, fallback used:", message);
    recordAiCall({ task, model, startedAt, success: false, source: "ai-api", error: message, tokenUsage: null });
    return { ...fallback(), source: "fallback", error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt({ task, input, outputSchema }) {
  return JSON.stringify(
    {
      task,
      rules: [
        "不输出确定买卖建议",
        "每个结论必须给出依据来源",
        "市场判断依据优先使用指数、成交额、涨跌家数",
        "行业判断依据优先使用板块涨幅、新闻事件、政策消息",
        "股票判断依据优先使用当前价格、涨跌、成交、公告、行业趋势",
        "用户维度必须考虑持仓、投资偏好、风险等级",
        "历史维度必须参考过去AI判断和复盘表现",
        "输出结构化JSON，不要输出Markdown",
      ],
      input,
      outputSchema,
    },
    null,
    2,
  );
}

function parseJsonContent(content) {
  return JSON.parse(content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim());
}

function normalizeOutput(output, fallback) {
  return {
    ...fallback,
    ...output,
    risks: Array.isArray(output.risks) ? output.risks : fallback.risks,
    opportunities: Array.isArray(output.opportunities) ? output.opportunities : fallback.opportunities,
    tomorrowPlan: Array.isArray(output.tomorrowPlan) ? output.tomorrowPlan : fallback.tomorrowPlan,
    evidence: output.evidence ?? output.conclusionBasis ?? fallback.evidence,
  };
}

function fallbackReport(input) {
  const marketSummarySource = input?.marketData?.marketSentiment?.summary ?? input?.market?.marketSentiment?.summary ?? "市场数据暂未完整更新。";
  const industries = input?.investmentProfile?.industries ?? input?.settings?.industries ?? ["AI", "半导体", "新能源"];
  const portfolio = input?.portfolio ?? [];
  const evidence = buildEvidence(input);
  const historyScore = summarizeHistory(input?.aiHistory ?? []);
  const reflection = input?.historicalReflection ?? "暂无可用历史反思。";

  return {
    marketSummary: `市场环境判断：${marketSummarySource}`,
    coreLogic: `当前主线：结合成交量、涨跌家数、热点板块和新闻影响，当前适合做结构化观察。历史复盘提示：${historyScore} ${reflection}`,
    industryAnalysis: `热点行业分析：${industries.join("、")} 仍需结合政策、资金方向和产业链订单变化验证。`,
    stockAnalysis: portfolio.length
      ? `我的股票影响：组合中 ${portfolio.map((item) => item.stockName ?? item.name ?? item.stockCode ?? item.code).join("、")} 需要持续跟踪公告、新闻和成交变化。`
      : "我的股票影响：暂无云端持仓数据，建议先维护自选股和组合。",
    risks: ["真实AI接口未启用或调用失败", "市场波动和高位题材回撤风险仍需跟踪", "本结论仅用于研究观察，不构成确定买卖建议"],
    opportunities: industries.slice(0, 5),
    tomorrowPlan: ["观察热点板块成交是否延续", "检查自选股公告和新闻变化", "复盘AI风险提醒是否有效"],
    evidence,
  };
}

function fallbackAnswer(question, input) {
  const market = input?.market?.marketSentiment?.summary ?? input?.marketData?.marketSentiment?.summary ?? "市场数据暂未完整更新";
  const stock = input?.stockData;
  const news = input?.newsData ?? input?.news ?? [];
  const portfolio = input?.portfolio ?? [];
  const history = input?.aiHistory ?? input?.history ?? [];
  const evidence = [];

  evidence.push(`市场背景：${market}`);
  if (stock?.code) evidence.push(`${stock.name ?? stock.code} ${stock.code}：现价${stock.price ?? "暂无"}，涨跌幅${stock.changePercent ?? "暂无"}，成交额${stock.amount ?? "暂无"}`);
  if (news.length) evidence.push(...news.slice(0, 3).map((item) => `${item.title ?? "新闻"}：${item.impact ?? item.category ?? "待判断"}`));
  if (portfolio.length) evidence.push(`组合：${portfolio.map((item) => item.stockName ?? item.name ?? item.stockCode ?? item.code).join("、")}`);
  if (history.length) evidence.push(`历史AI判断样本：${history.length}条`);

  return {
    answer: [
      `问题：${question}`,
      `市场背景：${market}`,
      stock?.code ? `相关股票：${stock.name ?? stock.code}（${stock.code}），现价 ${stock.price ?? "暂无"}，涨跌幅 ${stock.changePercent ?? "暂无"}，成交额 ${stock.amount ?? "暂无"}，行业 ${stock.industry ?? "待补充"}。` : "问题中未识别到明确股票，当前按市场和组合维度回答。",
      news.length ? `相关新闻：${news.slice(0, 3).map((item) => `${item.title ?? "新闻"}（${item.impact ?? item.category ?? "待判断"}）`).join("；")}。` : "相关新闻：当前上下文没有足够新闻或公告。",
      "结论：当前只给出研究观察。若行情强但新闻和公告依据不足，应降低追高冲动；若个股出现放量下跌、利空公告或行业退潮，需要优先看风险。这里不输出确定买入或卖出建议。",
    ].join("\n\n"),
    evidence,
    risks: ["行情可能延迟", "新闻和公告覆盖仍不完整", "fallback规则不能替代真实大模型深度分析"],
    followUp: ["补充公司公告和财报", "观察成交额变化", "复盘第二天走势是否验证判断"],
    source: "fallback",
  };
}

function buildEvidence(input) {
  const marketOverview = input.marketData?.marketOverview ?? input.aiInputSummary?.market?.indexes ?? [];
  const sentiment = input.marketData?.marketSentiment ?? {};
  const hotSectors = input.marketData?.hotSectors ?? input.aiInputSummary?.industry?.hotSectors ?? [];
  const news = input.newsData ?? [];
  const stock = input.stockData ?? {};
  return {
    market: [
      ...marketOverview.slice(0, 5).map((item) => `${item.label ?? item.name}：${item.value ?? item.price ?? ""} ${item.change ?? item.changePercent ?? ""}`.trim()),
      `涨跌家数：上涨${sentiment.upCount ?? input.aiInputSummary?.market?.breadth?.up ?? "未知"}，下跌${sentiment.downCount ?? input.aiInputSummary?.market?.breadth?.down ?? "未知"}`,
    ],
    industry: [
      ...hotSectors.slice(0, 5).map((item) => `${item.name}：${item.status ?? item.flow ?? item.changePercent ?? "热点"}`),
      ...news.slice(0, 3).map((item) => `${item.title}（${item.impact ?? item.category ?? "待判断"}）`),
    ],
    stock: stock.code ? [`${stock.name} ${stock.code}`, `价格${stock.price ?? "暂无"}`, `涨跌幅${stock.changePercent ?? "暂无"}`, `成交额${stock.amount ?? "暂无"}`, `行业${stock.industry ?? "待补充"}`] : ["未提供明确股票数据"],
    risk: ["需结合行情、新闻、公告和用户持仓综合判断"],
  };
}

function summarizeHistory(history) {
  if (!history.length) return "暂无足够历史样本。";
  const scored = history.filter((item) => item.accuracyScore ?? item.accuracy_score);
  const avgScore = scored.length ? Math.round(scored.reduce((sum, item) => sum + Number(item.accuracyScore ?? item.accuracy_score ?? 0), 0) / scored.length) : 0;
  return `已有 ${history.length} 条AI历史判断，平均复盘得分 ${avgScore}%。`;
}

function buildTechnicalView(input) {
  const volume = input?.marketData?.marketOverview?.find?.((item) => String(item.label).includes("成交"))?.value ?? "暂无";
  return `技术观察：重点看指数位置、成交额 ${volume}、热点延续性和波动放大风险；仅作为趋势观察，不作为买卖指令。`;
}

function recordAiCall({ task, model, startedAt, success, source, error = "", tokenUsage = null }) {
  const durationMs = Date.now() - startedAt;
  const log = {
    time: new Date().toISOString(),
    task,
    model,
    source,
    success,
    durationMs,
    error,
    tokenUsage,
  };
  aiCallLogs.unshift(log);
  aiCallLogs.splice(100);
  lastAiStatus = {
    lastCallAt: log.time,
    lastSuccessAt: success ? log.time : lastAiStatus.lastSuccessAt,
    lastFailureReason: success ? "" : error,
    lastDurationMs: durationMs,
    lastModel: model,
  };
}

function scoreAiQuality(result, input) {
  const evidence = result.evidence ?? [];
  const risks = result.risks ?? [];
  const answer = String(result.answer ?? result.marketSummary ?? "");
  const hasMarket = JSON.stringify(input.marketData ?? input.market ?? {}).length > 20;
  const hasNews = (input.newsData ?? input.news ?? []).length > 0;
  const hasStock = Boolean(input.stockData?.code);
  const hasUser = Boolean((input.portfolio ?? []).length || input.investmentProfile || input.profile);
  const dataCompleteness = [hasMarket, hasNews, hasStock, hasUser].filter(Boolean).length * 25;
  const logicCompleteness = Math.min(100, evidence.length * 18 + (answer.length > 80 ? 25 : 0));
  const riskCompleteness = Math.min(100, risks.length * 35);
  const total = Math.round(dataCompleteness * 0.4 + logicCompleteness * 0.35 + riskCompleteness * 0.25);
  return { total, dataCompleteness, logicCompleteness, riskCompleteness };
}
