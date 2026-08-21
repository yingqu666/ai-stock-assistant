import { collectMarketData } from "./dataCollector.js";
import { generateResearchReport } from "./aiService.js";
import { getStockDetail, searchStockCandidates } from "./stockService.js";
import { getEtfKnowledge, getSecurityUniverseStatus } from "./stockUniverseService.js";
import { assessDataQuality, buildPriceLevels, classifySecurity, dedupeEvents, validateFinancials } from "../../shared/securityClassifier.js";

const eastmoneyQuoteApi = "https://push2.eastmoney.com/api/qt/ulist.np/get";
const sinaQuoteApi = "https://hq.sinajs.cn/list=";
const tencentQuoteApi = "https://qt.gtimg.cn/q=";
const eastmoneyFastNewsApi = "https://np-listapi.eastmoney.com/comm/web/getFastNews";

const DATA_MISSING = "数据源未返回";
const INDUSTRY_MISSING = "行业数据暂缺";
const BOARD_LABELS = new Set(["沪市主板", "深市主板", "创业板", "科创板", "北交所", "沪市", "深市", "A股"]);
const BSE_CODE_MAP = {
  "830799": "920799",
  "430489": "920489",
  "832982": "920982",
  "835185": "920185",
};

const defaultInvestorProfile = {
  marketScope: "仅限A股和A股ETF",
  capitalSize: "几万元",
  trialCapital: "5000元",
  style: "成长科技方向",
  riskPreference: "平衡",
  riskLevel: "中",
  holdingPeriod: "波段观察",
  focusIndustries: ["AI基础设施", "芯片", "新能源", "资源", "电力", "储能", "国产替代", "光模块", "光刻机"],
  preference: "只研究A股，当前以5000元试水，风险偏好平衡，偏成长科技方向，重视AI基础设施、芯片、新能源、资源、电力、储能、国产替代、光模块、光刻机。",
};

const latestSourceStatus = {
  eastmoney: { status: "unknown", message: "尚未检测", updatedAt: "" },
  sina: { status: "unknown", message: "尚未检测", updatedAt: "" },
  tencent: { status: "unknown", message: "尚未检测", updatedAt: "" },
  news: { status: "unknown", message: "尚未检测", updatedAt: "" },
  universe: { status: "unknown", message: "尚未检测", updatedAt: "" },
  ai: { status: "unknown", message: "尚未调用", updatedAt: "" },
};

export async function getResearchData(query) {
  const startedAt = nowText();
  const resolved = await resolveSecurity(query);
  if (!resolved.code) {
    const message = `未找到匹配标的：${query}`;
    return {
      ok: false,
      status: "unavailable",
      message,
      updatedAt: startedAt,
      data: buildUnavailableResearch(query, message),
    };
  }

  const [quoteResult, detailResult, newsResult, marketData] = await Promise.all([
    fetchQuoteWithFallback(resolved).catch((error) => unavailable("quote", error.message)),
    getStockDetail(resolved.code).catch((error) => ({ ok: false, data: null, message: error.message })),
    fetchRelatedNews(resolved).catch((error) => ({ status: "unavailable", source: "东方财富资讯", message: error.message, data: [], updatedAt: nowText() })),
    collectMarketData().catch((error) => ({ source: "行情接口", status: "unavailable", error: error.message, marketOverview: [], hotSectors: [], marketSentiment: {}, updatedAt: nowText() })),
  ]);

  const detail = detailResult?.data ?? {};
  const quoteFallback = buildQuoteFromDetail(detail);
  const effectiveQuoteResult = mergeQuoteResults(quoteResult, quoteFallback);
  const quote = effectiveQuoteResult.data ?? {};
  const isEtf = isEtfCode(resolved.code);
  const securityProfile = detail.securityProfile ?? classifySecurity({ ...resolved, ...detail, ...quote });
  const announcements = dedupeEvents(Array.isArray(detail.announcements) ? detail.announcements : []);
  const financials = isEtf ? buildEtfFinancialUnavailable() : validateFinancials(normalizeFinancials(detail.financials, detailResult?.message), securityProfile);
  const security = buildSecurityProfile({ resolved, detail, quote, isEtf });
  const newsBuckets = buildNewsBuckets(newsResult.data);
  const dataSources = buildDataSources({ quoteResult: effectiveQuoteResult, newsResult, announcements, financials });
  const investmentProfile = buildInvestmentProfile();
  const researchData = {
    query,
    security,
    quote: normalizeQuote(effectiveQuoteResult, resolved),
    company: isEtf ? null : buildCompanyProfile(detail, security),
    etf: isEtf ? buildEtfProfile({ resolved, detail, quote }) : null,
    news: newsResult.data,
    newsBuckets,
    announcements,
    financials,
    marketData,
    dataStatus: buildDataStatus({ quoteResult: effectiveQuoteResult, detailResult, newsResult, announcements, financials }),
    dataSources,
    investmentProfile,
    sourceTimes: {
      quoteUpdatedAt: quote.updatedAt ?? effectiveQuoteResult.updatedAt ?? nowText(),
      newsUpdatedAt: newsResult.updatedAt ?? nowText(),
      announcementUpdatedAt: announcements[0]?.date ?? detail.updatedAt ?? nowText(),
      universeUpdatedAt: getSecurityUniverseStatus().updatedAt,
    },
    updatedAt: nowText(),
  };
  researchData.securityProfile = securityProfile;
  researchData.dataQuality = detail.dataQuality ?? assessDataQuality({ ...security, ...quote, financials, announcements, stockNews: researchData.news, securityProfile });
  researchData.priceLevels = detail.priceLevels ?? buildPriceLevels({ ...security, ...quote, financials, announcements, stockNews: researchData.news, securityProfile }, researchData.dataQuality);

  const hasUsableQuote = ["real", "partial"].includes(effectiveQuoteResult.status)
    && quote.price && quote.price !== DATA_MISSING
    && quote.changePercent && quote.changePercent !== DATA_MISSING;
  const aiReport = hasUsableQuote ? await generateResearchReport({
    marketData,
    stockData: buildAiStockInput({
      security,
      quote,
      detail,
      isEtf,
      announcements,
      financials,
      securityProfile,
      dataQuality: researchData.dataQuality,
      priceLevels: researchData.priceLevels,
      dataStatus: researchData.dataStatus.overall,
      dataSources,
      sourceTimes: researchData.sourceTimes,
    }),
    newsData: [...newsBuckets.stockRelated, ...newsBuckets.marketGeneral],
    newsBuckets,
    announcementData: announcements,
    investmentProfile,
    riskData: buildRiskData(researchData),
    dataSources,
  }).catch((error) => {
    latestSourceStatus.ai = { status: "fallback", message: error.message, updatedAt: nowText() };
    return null;
  }) : null;

  if (!hasUsableQuote) {
    latestSourceStatus.ai = { status: "skipped", message: "基础行情不足，未调用AI", updatedAt: nowText() };
  }

  if (aiReport?.source === "deepseek" || aiReport?.source === "ai-api") {
    latestSourceStatus.ai = { status: "ok", message: aiReport.source, updatedAt: nowText() };
  } else if (aiReport) {
    latestSourceStatus.ai = { status: "fallback", message: aiReport.source ?? "fallback", updatedAt: nowText() };
  }

  return {
    ok: true,
    status: researchData.dataStatus.overall,
    source: researchData.dataStatus.sources.join(" / "),
    updatedAt: researchData.updatedAt,
    data: { ...researchData, aiReport },
  };
}

export function getResearchSourceStatus() {
  const universe = getSecurityUniverseStatus();
  latestSourceStatus.universe = {
    status: universe.status,
    message: universe.message,
    updatedAt: universe.updatedAt,
  };
  return {
    updatedAt: nowText(),
    sources: latestSourceStatus,
  };
}

async function resolveSecurity(query) {
  const keyword = String(query ?? "").trim();
  if (/^\d{6}$/.test(keyword)) {
    const result = await searchStockCandidates(keyword).catch(() => ({ data: [] }));
    const first = result.data?.[0] ?? {};
    return {
      code: keyword,
      name: first.name ?? keyword,
      market: first.market ?? inferMarket(keyword),
      industry: first.industry,
      assetType: isEtfCode(keyword) ? "ETF" : "股票",
      trackingIndex: first.trackingIndex,
      components: first.components,
    };
  }
  const result = await searchStockCandidates(keyword);
  const first = result.data?.[0];
  return first ? { code: first.code, name: first.name, market: first.market, industry: first.industry, assetType: first.assetType, trackingIndex: first.trackingIndex, components: first.components } : {};
}

async function fetchQuoteWithFallback(security) {
  const errors = [];
  try {
    const data = await withRejectTimeout(fetchEastmoneyQuote(security), 1800, "东方财富行情超时");
    markSource(data.providerKey, "ok", "真实行情返回");
    return { status: "real", source: data.source, data: cleanQuoteIndustry(data), message: "", updatedAt: data.updatedAt };
  } catch (error) {
    markSource("eastmoney", "failed", error.message);
    errors.push(`eastmoney: ${error.message}`);
  }

  const [sinaResult, tencentResult] = await Promise.allSettled([
    withRejectTimeout(fetchSinaQuote(security), 1800, "新浪行情超时"),
    withRejectTimeout(fetchTencentQuote(security), 1800, "腾讯行情超时"),
  ]);
  if (sinaResult.status === "fulfilled") markSource("sina", "ok", "真实行情返回");
  else {
    markSource("sina", "failed", sinaResult.reason?.message ?? "新浪行情失败");
    errors.push(`sina: ${sinaResult.reason?.message ?? "新浪行情失败"}`);
  }
  if (tencentResult.status === "fulfilled") markSource("tencent", "ok", "真实行情返回");
  else {
    markSource("tencent", "failed", tencentResult.reason?.message ?? "腾讯行情失败");
    errors.push(`tencent: ${tencentResult.reason?.message ?? "腾讯行情失败"}`);
  }

  const backups = [sinaResult, tencentResult]
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  if (backups.length) {
    const data = cleanQuoteIndustry(mergeQuotes(backups));
    return { status: "partial", source: data.source, data, message: errors.join("；"), updatedAt: data.updatedAt };
  }

  return {
    status: "unavailable",
    source: "none",
    message: errors.join("；") || "行情接口未返回",
    data: null,
    updatedAt: nowText(),
  };
}

async function fetchEastmoneyQuote(security) {
  const fields = "f12,f14,f2,f3,f4,f5,f6,f8,f20,f100,f162,f167";
  const quoteCode = normalizeQuoteCode(security.code);
  const url = `${eastmoneyQuoteApi}?fltt=2&fields=${fields}&secids=${toSecid(quoteCode)}`;
  const json = await fetchJson(url, "东方财富行情");
  const row = json?.data?.diff?.[0];
  if (!row || row.f2 === "-" || row.f2 == null) throw new Error("东方财富行情为空");
  const etf = isEtfCode(security.code) ? getEtfKnowledge(security.code) : {};
  return {
    providerKey: "eastmoney",
    source: "东方财富",
    code: security.code,
    quoteCode: row.f12 || quoteCode,
    name: row.f14 || security.name,
    price: formatPrice(row.f2),
    changePercent: formatPercent(row.f3),
    changeAmount: formatPrice(row.f4),
    volume: formatVolume(row.f5),
    amount: formatAmount(row.f6),
    turnoverRate: isEtfCode(security.code) ? "ETF不使用换手率" : formatPercent(row.f8),
    marketCap: formatAmount(row.f20),
    fundScale: isEtfCode(security.code) ? formatAmount(row.f20) : undefined,
    pe: isEtfCode(security.code) ? "ETF不适用PE" : formatMetric(row.f162),
    pb: isEtfCode(security.code) ? "ETF不适用PB" : formatMetric(row.f167),
    industry: row.f100 || security.industry || etf.industry || "",
    trackingIndex: etf.trackingIndex ?? security.trackingIndex,
    components: etf.components ?? security.components ?? [],
    capitalFlow: isEtfCode(security.code) ? `成交额 ${formatAmount(row.f6)}，用于观察资金活跃度。` : undefined,
    updatedAt: nowText(),
  };
}

async function fetchSinaQuote(security) {
  const quoteCode = normalizeQuoteCode(security.code);
  const symbol = `${quoteMarketPrefix(quoteCode)}${quoteCode}`;
  const response = await fetch(`${sinaQuoteApi}${symbol}`, { cache: "no-store", headers: { Referer: "https://finance.sina.com.cn/" } });
  if (!response.ok) throw new Error(`新浪行情 HTTP ${response.status}`);
  const text = new TextDecoder("gb18030").decode(Buffer.from(await response.arrayBuffer()));
  const fields = (text.match(/="([^"]*)"/)?.[1] ?? "").split(",");
  if (fields.length < 10 || !fields[0]) throw new Error("新浪行情为空");
  const previousClose = toNumber(fields[2]);
  const current = toNumber(fields[3]);
  if (current <= 0 || previousClose <= 0) throw new Error("\u65b0\u6d6a\u884c\u60c5\u672a\u8fd4\u56de\u6709\u6548\u4ef7\u683c");
  const change = current - previousClose;
  const etf = isEtfCode(security.code) ? getEtfKnowledge(security.code) : {};
  return {
    providerKey: "sina",
    source: "新浪财经",
    code: security.code,
    quoteCode,
    name: fields[0] || security.name,
    price: formatPrice(current),
    changePercent: previousClose ? formatPercent((change / previousClose) * 100) : DATA_MISSING,
    changeAmount: formatPrice(change),
    volume: formatVolume(toNumber(fields[8]) / 100),
    amount: formatAmount(fields[9]),
    turnoverRate: isEtfCode(security.code) ? "ETF不使用换手率" : DATA_MISSING,
    marketCap: DATA_MISSING,
    pe: isEtfCode(security.code) ? "ETF不适用PE" : DATA_MISSING,
    pb: isEtfCode(security.code) ? "ETF不适用PB" : DATA_MISSING,
    industry: security.industry || etf.industry || "",
    trackingIndex: etf.trackingIndex ?? security.trackingIndex,
    components: etf.components ?? security.components ?? [],
    updatedAt: fields[30] && fields[31] ? `${fields[30]} ${fields[31]}` : nowText(),
  };
}

async function fetchTencentQuote(security) {
  const quoteCode = normalizeQuoteCode(security.code);
  const symbol = `${quoteMarketPrefix(quoteCode)}${quoteCode}`;
  const response = await fetch(`${tencentQuoteApi}${symbol}`, { cache: "no-store", headers: { Referer: "https://gu.qq.com/" } });
  if (!response.ok) throw new Error(`腾讯财经 HTTP ${response.status}`);
  const text = new TextDecoder("gb18030").decode(Buffer.from(await response.arrayBuffer()));
  const fields = (text.match(/="([^"]*)"/)?.[1] ?? "").split("~");
  if (fields.length < 40 || !fields[1]) throw new Error("腾讯财经行情为空");
  const etf = isEtfCode(security.code) ? getEtfKnowledge(security.code) : {};
  return {
    providerKey: "tencent",
    source: "腾讯财经",
    code: security.code,
    quoteCode,
    name: fields[1] || security.name,
    price: formatPrice(fields[3]),
    changePercent: formatPercent(fields[32]),
    changeAmount: formatPrice(fields[31]),
    volume: fields[36] ? `${fields[36]}手` : DATA_MISSING,
    amount: fields[37] ? `${fields[37]}万元` : DATA_MISSING,
    turnoverRate: isEtfCode(security.code) ? "ETF不使用换手率" : DATA_MISSING,
    marketCap: DATA_MISSING,
    pe: isEtfCode(security.code) ? "ETF不适用PE" : DATA_MISSING,
    pb: isEtfCode(security.code) ? "ETF不适用PB" : DATA_MISSING,
    industry: security.industry || etf.industry || "",
    trackingIndex: etf.trackingIndex ?? security.trackingIndex,
    components: etf.components ?? security.components ?? [],
    updatedAt: fields[30] || nowText(),
  };
}

async function fetchRelatedNews(security) {
  const json = await fetchJson(`${eastmoneyFastNewsApi}?client=web&biz=web_724&fastColumn=102&sortEnd=0&pageSize=40&req_trace=${Date.now()}`, "东方财富资讯");
  const rows = Array.isArray(json?.data) ? json.data : [];
  const relatedThemes = buildRelatedThemes(security);
  const related = rows.filter((item) => {
    const text = `${item.title ?? ""}${item.summary ?? ""}`;
    return text.includes(security.name)
      || text.includes(security.code)
      || (security.industry && !BOARD_LABELS.has(security.industry) && security.industry !== INDUSTRY_MISSING && text.includes(security.industry))
      || relatedThemes.some((theme) => text.includes(theme));
  });
  const isStockRelated = related.length > 0;
  const selected = (isStockRelated ? related : rows.slice(0, 8)).slice(0, 8);
  latestSourceStatus.news = {
    status: selected.length ? "ok" : "failed",
    message: selected.length ? "东方财富资讯返回" : "新闻接口未返回",
    updatedAt: nowText(),
  };
  return {
    status: selected.length ? "real" : "unavailable",
    source: "东方财富资讯",
    updatedAt: nowText(),
    data: selected.map((item) => {
      const title = item.title ?? "财经新闻";
      const themes = inferThemes(`${title}${item.summary ?? ""}`, relatedThemes);
      return {
        title,
        source: item.mediaName ?? "东方财富资讯",
        time: item.showTime ?? nowText(),
        link: item.url ?? item.shareUrl ?? "",
        relatedStock: security.code,
        relatedIndustries: themes,
        relatedThemes: themes,
        category: classifyNews(title),
        impact: analyzeImpact(title),
        relationType: isStockRelated ? "stock_related" : "market_general",
        dataStatus: isStockRelated ? "个股相关新闻" : "市场通用新闻，未命中个股关键词",
      };
    }),
  };
}

function buildSecurityProfile({ resolved, detail, quote, isEtf }) {
  const industry = normalizeIndustry(quote.industry || detail.industry || resolved.industry, isEtf);
  return {
    code: resolved.code,
    name: quote.name ?? detail.name ?? resolved.name,
    assetType: isEtf ? "ETF" : "股票",
    market: detail.market ?? resolved.market ?? inferMarket(resolved.code),
    industry,
    dataSource: quote.source ?? detail.dataSource ?? "",
    updatedAt: quote.updatedAt ?? detail.updatedAt ?? nowText(),
  };
}

function buildCompanyProfile(detail, security) {
  return {
    name: detail.companyName ?? security.name,
    industry: security.industry,
    mainBusiness: cleanUnavailable(detail.mainBusiness, `主营业务由公告和年报补充；行情更新时间：${security.updatedAt}`),
    listingDate: cleanUnavailable(detail.listingDate, `上市时间由数据源补充；更新时间：${security.updatedAt}`),
    profile: cleanUnavailable(detail.profile, `公司简介由公告和年报补充；行情更新时间：${security.updatedAt}`),
    industryPosition: cleanUnavailable(detail.industryPosition, `行业地位由行业数据补充；行情更新时间：${security.updatedAt}`),
  };
}

function buildEtfProfile({ resolved, detail, quote }) {
  const etf = getEtfKnowledge(resolved.code);
  return {
    name: quote.name ?? detail.name ?? resolved.name,
    code: resolved.code,
    trackingIndex: cleanUnavailable(detail.trackingIndex ?? quote.trackingIndex ?? etf.trackingIndex, `跟踪指数由基金公告复核；行情更新时间：${quote.updatedAt ?? nowText()}`),
    fundScale: quote.fundScale ?? quote.marketCap ?? `基金规模由行情接口补充；更新时间：${quote.updatedAt ?? nowText()}`,
    inceptionDate: cleanUnavailable(detail.inceptionDate ?? detail.listingDate, `成立时间由基金公告补充；行情更新时间：${quote.updatedAt ?? nowText()}`),
    fundManager: cleanUnavailable(detail.fundManager, `管理机构由基金公告补充；行情更新时间：${quote.updatedAt ?? nowText()}`),
    industryDirection: detail.industry ?? quote.industry ?? etf.industry ?? "ETF",
    components: Array.isArray(detail.components) && detail.components.length ? detail.components : quote.components ?? etf.components ?? [],
    capitalFlow: quote.amount ? `成交额 ${quote.amount}，用于观察资金活跃度。` : `资金方向由成交额和份额变化补充；行情更新时间：${quote.updatedAt ?? nowText()}`,
  };
}

function normalizeQuote(result, resolved) {
  if (!["real", "partial"].includes(result.status)) {
    return {
      status: "unavailable",
      message: result.message || "行情接口未返回",
      source: result.source,
      updatedAt: nowText(),
      code: resolved.code,
      name: resolved.name,
      price: DATA_MISSING,
      changePercent: DATA_MISSING,
      volume: DATA_MISSING,
      amount: DATA_MISSING,
      marketCap: DATA_MISSING,
      pe: isEtfCode(resolved.code) ? "ETF不适用PE" : DATA_MISSING,
      pb: isEtfCode(resolved.code) ? "ETF不适用PB" : DATA_MISSING,
    };
  }
  return { status: "real", ...result.data };
}

function normalizeFinancials(financials = {}, message = "") {
  if (isRealStatus(financials.status)) return financials;
  if (financials.status === "真实数据") return financials;
  return {
    revenue: DATA_MISSING,
    revenueYoY: DATA_MISSING,
    netProfit: DATA_MISSING,
    netProfitYoY: DATA_MISSING,
    grossMargin: DATA_MISSING,
    netMargin: DATA_MISSING,
    roe: DATA_MISSING,
    debtRatio: DATA_MISSING,
    cashFlow: DATA_MISSING,
    reportDate: DATA_MISSING,
    source: financials.source ?? message ?? "财务接口未返回有效数据",
    updatedAt: nowText(),
    status: "unavailable",
  };
}

function buildEtfFinancialUnavailable() {
  return { status: "not_applicable", source: "ETF不适用公司财务指标", revenue: "ETF不适用", netProfit: "ETF不适用", roe: "ETF不适用", grossMargin: "ETF不适用" };
}

function buildDataStatus({ quoteResult, detailResult, newsResult, announcements, financials }) {
  const sources = [];
  const quoteAvailable = quoteResult.status === "real" || quoteResult.status === "partial";
  if (quoteAvailable) sources.push(quoteResult.source);
  if (detailResult?.data) sources.push(detailResult.source ?? "stockService");
  if (newsResult.status === "real") sources.push(newsResult.source ?? "\u65b0\u95fb\u63a5\u53e3");
  if (announcements.length) sources.push("\u4e1c\u65b9\u8d22\u5bcc\u516c\u544a");
  if (financials.status === "\u771f\u5b9e\u6570\u636e") sources.push(financials.source);
  if (isRealStatus(financials.status)) sources.push(financials.source);
  const required = [quoteAvailable, Boolean(detailResult?.data), newsResult.status === "real"];
  const realCount = required.filter(Boolean).length;
  return {
    overall: quoteResult.status === "real" && realCount >= 2 ? "real" : realCount ? "partial" : "unavailable",
    quote: quoteResult.status,
    company: detailResult?.data ? "partial" : "unavailable",
    news: newsResult.status,
    announcements: announcements.length ? "real" : "unavailable",
    financials: financials.status,
    sources: [...new Set(sources.filter(Boolean))],
    message: quoteAvailable ? "\u771f\u5b9e\u884c\u60c5\u53ef\u7528" : quoteResult.message,
  };
}

function buildRiskData(data) {
  const risks = [];
  if (data.quote.status !== "real") risks.push({ message: `行情接口状态：${data.quote.message}` });
  if (!data.announcements.length) risks.push({ message: `公告接口未返回最新公告；公告更新时间：${data.sourceTimes?.announcementUpdatedAt ?? nowText()}` });
  if (data.financials.status === "unavailable") risks.push({ message: `财务数据状态：${data.financials.source}` });
  if (data.dataQuality?.level === "insufficient") risks.push({ message: data.dataQuality.message });
  if (data.securityProfile?.isSt) risks.push({ message: "ST/*ST标的存在退市、流动性、财务和交易规则风险。" });
  if (data.securityProfile?.isNewStock) risks.push({ message: "新股历史数据不足，禁止生成技术评分和买卖价格区间。" });
  return risks;
}

function buildAiStockInput({ security, quote, detail = {}, isEtf, announcements, financials, securityProfile, dataQuality, priceLevels, dataStatus, dataSources, sourceTimes }) {
  return {
    name: valueOrEmpty(quote.name ?? security.name),
    code: valueOrEmpty(security.code ?? quote.code),
    assetType: isEtf ? "ETF" : "股票",
    securityType: securityProfile?.securityType ?? (isEtf ? "etf" : "stock"),
    securityProfile,
    dataQuality,
    priceLevels,
    market: valueOrEmpty(security.market),
    industry: valueOrEmpty(security.industry ?? quote.industry),
    companyName: valueOrEmpty(detail.companyName ?? detail.name ?? security.name),
    listingDate: valueOrEmpty(detail.listingDate),
    profile: valueOrEmpty(detail.profile),
    mainBusiness: valueOrEmpty(detail.mainBusiness),
    industryPosition: valueOrEmpty(detail.industryPosition),
    price: valueOrEmpty(quote.price),
    changePercent: valueOrEmpty(quote.changePercent),
    changeAmount: valueOrEmpty(quote.changeAmount),
    volume: valueOrEmpty(quote.volume),
    amount: valueOrEmpty(quote.amount),
    turnoverRate: valueOrEmpty(quote.turnoverRate),
    marketCap: valueOrEmpty(quote.marketCap),
    pe: valueOrEmpty(quote.pe),
    pb: valueOrEmpty(quote.pb),
    valuationStatus: valueOrEmpty(detail.valuationStatus),
    valuationRange: detail.valuationRange ?? {},
    trackingIndex: valueOrEmpty(detail.trackingIndex ?? quote.trackingIndex),
    fundScale: valueOrEmpty(detail.fundScale ?? quote.fundScale ?? quote.marketCap),
    inceptionDate: valueOrEmpty(detail.inceptionDate),
    fundManager: valueOrEmpty(detail.fundManager),
    components: Array.isArray(detail.components) && detail.components.length ? detail.components : (quote.components ?? []),
    capitalFlow: valueOrEmpty(detail.capitalFlow ?? quote.capitalFlow),
    dataSource: valueOrEmpty(quote.source ?? quote.dataSource),
    quoteSource: valueOrEmpty(dataSources.quote),
    newsSource: valueOrEmpty(dataSources.news),
    announcementSource: valueOrEmpty(dataSources.announcement),
    aiSource: dataSources.ai,
    dataSources,
    dataStatus,
    updatedAt: valueOrEmpty(quote.updatedAt ?? sourceTimes?.quoteUpdatedAt),
    sourceTimes,
    announcements,
    financials: normalizeAiFinancials(financials),
  };
}

function normalizeAiFinancials(financials = {}) {
  return {
    revenue: valueOrEmpty(financials.revenue),
    revenueYoY: valueOrEmpty(financials.revenueYoY),
    netProfit: valueOrEmpty(financials.netProfit),
    netProfitYoY: valueOrEmpty(financials.netProfitYoY),
    grossMargin: valueOrEmpty(financials.grossMargin),
    netMargin: valueOrEmpty(financials.netMargin),
    roe: valueOrEmpty(financials.roe),
    debtRatio: valueOrEmpty(financials.debtRatio),
    cashFlow: valueOrEmpty(financials.cashFlow),
    reportDate: valueOrEmpty(financials.reportDate),
    source: valueOrEmpty(financials.source),
    status: financials.status ?? "unavailable",
    issues: financials.issues ?? [],
    availableCount: financials.availableCount,
    hasFatalIssue: Boolean(financials.hasFatalIssue),
    credibility: financials.credibility ?? {},
  };
}

function buildNewsBuckets(news = []) {
  const rows = Array.isArray(news) ? news : [];
  const stockRelated = rows.filter((item) => item.relationType === "stock_related");
  const marketGeneral = rows.filter((item) => item.relationType !== "stock_related");
  return { stockRelated, marketGeneral };
}

function buildDataSources({ quoteResult, newsResult, announcements, financials }) {
  const newsSources = [...new Set((newsResult.data ?? []).map((item) => item.source).filter(Boolean))];
  const announcementSources = [...new Set(announcements.map((item) => item.source).filter(Boolean))];
  return {
    quote: quoteResult.source || "行情接口未返回",
    news: newsSources.length ? newsSources.join(" / ") : (newsResult.source || "新闻接口未返回"),
    announcement: announcementSources.length ? announcementSources.join(" / ") : (announcements.length ? "东方财富公告" : "公告接口未返回"),
    financial: financials.source || "财务接口未返回",
    ai: "DeepSeek优先，失败使用规则fallback",
  };
}

function buildInvestmentProfile() {
  return { ...defaultInvestorProfile, focus: [...defaultInvestorProfile.focusIndustries] };
}

function isRealStatus(status) {
  return ["真实数据", "real", "鐪熷疄鏁版嵁"].includes(String(status ?? ""));
}

function valueOrEmpty(value) {
  return isMissingValue(value) ? "" : value;
}

function buildUnavailableResearch(query, message) {
  return {
    query,
    quote: { status: "unavailable", message },
    company: null,
    etf: null,
    news: [],
    announcements: [],
    financials: { status: "unavailable", source: message },
    dataStatus: { overall: "unavailable", message, sources: [] },
  };
}

function unavailable(type, message) {
  return { status: "unavailable", source: "none", message: `${type}: ${message}`, data: null, updatedAt: nowText() };
}

async function fetchJson(url, source) {
  const targets = buildThirdPartyUrls(url);
  let lastError;
  for (const target of targets) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    try {
      const response = await fetch(target, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
          Referer: "https://quote.eastmoney.com/",
        },
      });
      if (!response.ok) throw new Error(`${source} HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error(`${source} fetch failed`);
}

function withRejectTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function buildThirdPartyUrls(url) {
  const urls = [url];
  if (url.includes("https://push2.eastmoney.com")) {
    urls.push(url.replace("https://push2.eastmoney.com", "https://push2his.eastmoney.com"));
    urls.push(url.replace("https://push2.eastmoney.com", "http://push2.eastmoney.com"));
  }
  if (url.includes("https://np-listapi.eastmoney.com")) {
    urls.push(url.replace("https://np-listapi.eastmoney.com", "http://np-listapi.eastmoney.com"));
  }
  return [...new Set(urls)];
}

function buildQuoteFromDetail(detail = {}) {
  if (!detail?.code || detail.dataStatus === "备用数据") return null;
  if (!detail.price || /暂无|数据源未返回|待接|待补|不可用/.test(String(detail.price))) return null;
  return {
    status: detail.dataStatus === "真实数据" ? "real" : "partial",
    source: detail.quoteSource ?? detail.dataSource ?? "后端详情服务",
    message: "研究服务复用后端详情报价",
    updatedAt: detail.updatedAt ?? nowText(),
    data: {
      providerKey: "detail",
      source: detail.quoteSource ?? detail.dataSource ?? "后端详情服务",
      code: detail.code,
      name: detail.name,
      price: detail.price,
      changePercent: detail.changePercent,
      changeAmount: detail.changeAmount,
      volume: detail.volume,
      amount: detail.amount,
      turnoverRate: detail.turnoverRate,
      marketCap: detail.marketCap,
      fundScale: detail.fundScale,
      pe: detail.pe,
      pb: detail.pb,
      industry: detail.industry,
      trackingIndex: detail.trackingIndex,
      components: detail.components,
      capitalFlow: detail.capitalFlow,
      updatedAt: detail.updatedAt ?? nowText(),
    },
  };
}

function mergeQuoteResults(primaryResult, detailResult) {
  const available = [primaryResult, detailResult].filter((result) => result?.data && ["real", "partial"].includes(result.status));
  if (!available.length) return primaryResult;
  const mergedData = mergeQuotes(available.map((result) => result.data));
  const statuses = available.map((result) => result.status);
  const sources = available.map((result) => result.source).filter(Boolean);
  return {
    status: statuses.includes("real") ? "real" : "partial",
    source: [...new Set(sources)].join(" / "),
    message: [primaryResult?.message, detailResult?.message].filter(Boolean).join("；"),
    updatedAt: mergedData.updatedAt ?? available[0].updatedAt ?? nowText(),
    data: mergedData,
  };
}

function mergeQuotes(quotes) {
  const valid = quotes.filter(Boolean);
  const merged = {};
  for (const quote of valid) {
    for (const [key, value] of Object.entries(quote)) {
      if (!isMissingValue(value) && (isMissingValue(merged[key]) || key === "source")) {
        merged[key] = value;
      }
    }
  }
  merged.source = [...new Set(valid.map((quote) => quote.source).filter(Boolean))].join(" / ");
  merged.quoteSource = merged.source;
  merged.dataSource = merged.source;
  merged.updatedAt = valid.map((quote) => quote.updatedAt).filter(Boolean)[0] ?? nowText();
  return cleanQuoteIndustry(merged);
}

function cleanQuoteIndustry(quote = {}) {
  return {
    ...quote,
    industry: normalizeIndustry(quote.industry, isEtfCode(quote.code)),
  };
}

function normalizeIndustry(value, isEtf = false) {
  const text = String(value ?? "").trim();
  if (isEtf) return text && text !== DATA_MISSING ? text : "ETF";
  if (!text || text === DATA_MISSING || BOARD_LABELS.has(text)) return INDUSTRY_MISSING;
  return text;
}

function isMissingValue(value) {
  if (value === undefined || value === null) return true;
  const text = String(value).trim();
  return !text || [
    DATA_MISSING,
    INDUSTRY_MISSING,
    "暂无",
    "-",
    "数据暂不可用",
    "待接真实数据",
    "待补充",
    "undefined",
    "null",
    "NaN",
    "Infinity",
    "-Infinity",
  ].includes(text);
}

function markSource(key, status, message) {
  if (!key) return;
  latestSourceStatus[key] = { status, message, updatedAt: nowText() };
}

function cleanUnavailable(value, fallback) {
  if (!value || /待接|待补|本地研究库|暂无|不可用|数据源未返回/.test(String(value))) return fallback;
  return value;
}

function buildRelatedThemes(security) {
  const text = `${security.name ?? ""}${security.industry ?? ""}${(security.components ?? []).join("")}`;
  const themes = [];
  if (/AI|人工智能|芯片|半导体|算力|光模块|服务器/.test(text)) themes.push("半导体", "光模块", "算力", "电力", "AI");
  if (/通信|5G|光模块/.test(text)) themes.push("通信", "光模块", "算力");
  if (/电力|储能|新能源/.test(text)) themes.push("电力", "储能", "新能源");
  return [...new Set([security.industry, ...themes].filter((item) => item && item !== INDUSTRY_MISSING && !BOARD_LABELS.has(item)))];
}

function inferThemes(text, defaults = []) {
  const themes = [...defaults];
  if (/AI|人工智能|算力|服务器/.test(text)) themes.push("AI", "算力", "服务器");
  if (/芯片|半导体/.test(text)) themes.push("半导体", "芯片");
  if (/光模块|光通信/.test(text)) themes.push("光模块", "通信");
  if (/电力|储能|电网/.test(text)) themes.push("电力", "储能");
  return [...new Set(themes.filter(Boolean))];
}

function classifyNews(title) {
  if (/政策|证监会|发改委|工信部/.test(title)) return "政策新闻";
  if (/行业|产业|需求|订单|芯片|算力|半导体|储能|电力|光模块/.test(title)) return "行业新闻";
  return "市场新闻";
}

function analyzeImpact(title) {
  if (/增长|回购|增持|中标|突破|需求|上调|利好/.test(title)) return "利好";
  if (/减持|亏损|下滑|处罚|风险|终止|诉讼|下降/.test(title)) return "利空";
  return "中性";
}

function toSecid(code) {
  const text = normalizeQuoteCode(code);
  return `${String(text).startsWith("6") || String(text).startsWith("5") ? "1" : "0"}.${text}`;
}

function quoteMarketPrefix(code) {
  const text = String(code ?? "");
  if (text.startsWith("6") || text.startsWith("5")) return "sh";
  if (text.startsWith("8") || text.startsWith("920")) return "bj";
  return "sz";
}

function inferMarket(code) {
  const text = String(code ?? "");
  if (isEtfCode(text)) return text.startsWith("5") ? "沪市ETF" : "深市ETF";
  if (text.startsWith("688") || text.startsWith("689")) return "科创板";
  if (text.startsWith("300") || text.startsWith("301")) return "创业板";
  if (text.startsWith("6")) return "沪市";
  if (text.startsWith("8") || text.startsWith("920")) return "北交所";
  if (text.startsWith("0") || text.startsWith("2") || text.startsWith("3")) return "深市";
  return "A股";
}

function isEtfCode(code) {
  return /^(?:5\d{5}|1[56]\d{4})$/.test(String(code ?? ""));
}

function normalizeQuoteCode(code) {
  const text = String(code ?? "");
  return BSE_CODE_MAP[text] ?? text;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  if (isMissingValue(value)) return DATA_MISSING;
  const number = toNumber(value);
  return number ? number.toFixed(2) : DATA_MISSING;
}

function formatPercent(value) {
  if (isMissingValue(value)) return DATA_MISSING;
  const number = Number(value);
  return Number.isFinite(number) ? `${number >= 0 ? "+" : ""}${number.toFixed(2)}%` : DATA_MISSING;
}

function formatMetric(value) {
  if (isMissingValue(value)) return DATA_MISSING;
  const number = toNumber(value);
  return number ? number.toFixed(2) : DATA_MISSING;
}

function formatVolume(value) {
  const number = toNumber(value);
  if (number >= 10000) return `${(number / 10000).toFixed(2)}万手`;
  return number ? `${Math.round(number)}手` : DATA_MISSING;
}

function formatAmount(value) {
  const number = toNumber(value);
  if (number >= 1_0000_0000_0000) return `${(number / 1_0000_0000_0000).toFixed(2)}万亿`;
  if (number >= 1_0000_0000) return `${(number / 1_0000_0000).toFixed(2)}亿`;
  if (number >= 10000) return `${(number / 10000).toFixed(2)}万`;
  return number ? String(Math.round(number)) : DATA_MISSING;
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
