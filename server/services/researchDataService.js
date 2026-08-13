import { collectMarketData } from "./dataCollector.js";
import { generateResearchReport } from "./aiService.js";
import { getStockDetail, searchStockCandidates } from "./stockService.js";
import { getEtfKnowledge, getSecurityUniverseStatus } from "./stockUniverseService.js";

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
  const announcements = Array.isArray(detail.announcements) ? detail.announcements : [];
  const financials = isEtf ? buildEtfFinancialUnavailable() : normalizeFinancials(detail.financials, detailResult?.message);
  const security = buildSecurityProfile({ resolved, detail, quote, isEtf });
  const researchData = {
    query,
    security,
    quote: normalizeQuote(effectiveQuoteResult, resolved),
    company: isEtf ? null : buildCompanyProfile(detail, security),
    etf: isEtf ? buildEtfProfile({ resolved, detail, quote }) : null,
    news: newsResult.data,
    announcements,
    financials,
    marketData,
    dataStatus: buildDataStatus({ quoteResult: effectiveQuoteResult, detailResult, newsResult, announcements, financials }),
    sourceTimes: {
      quoteUpdatedAt: quote.updatedAt ?? effectiveQuoteResult.updatedAt ?? nowText(),
      newsUpdatedAt: newsResult.updatedAt ?? nowText(),
      announcementUpdatedAt: announcements[0]?.date ?? detail.updatedAt ?? nowText(),
      universeUpdatedAt: getSecurityUniverseStatus().updatedAt,
    },
    updatedAt: nowText(),
  };

  const hasUsableQuote = ["real", "partial"].includes(effectiveQuoteResult.status)
    && quote.price && quote.price !== DATA_MISSING
    && quote.changePercent && quote.changePercent !== DATA_MISSING;
  const aiReport = hasUsableQuote ? await generateResearchReport({
    marketData,
    stockData: {
      ...security,
      ...quote,
      assetType: isEtf ? "ETF" : "股票",
      announcements,
      financials,
      dataStatus: researchData.dataStatus.overall,
    },
    newsData: newsResult.data,
    announcementData: announcements,
    investmentProfile: {},
    riskData: buildRiskData(researchData),
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
    const data = await fetchEastmoneyQuote(security);
    markSource(data.providerKey, "ok", "真实行情返回");
    return { status: "real", source: data.source, data: cleanQuoteIndustry(data), message: "", updatedAt: data.updatedAt };
  } catch (error) {
    markSource("eastmoney", "failed", error.message);
    errors.push(`eastmoney: ${error.message}`);
  }

  const [sinaResult, tencentResult] = await Promise.allSettled([
    fetchSinaQuote(security),
    fetchTencentQuote(security),
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
  if (financials.status === "真实数据") return financials;
  return {
    revenue: DATA_MISSING,
    revenueYoY: DATA_MISSING,
    netProfit: DATA_MISSING,
    netProfitYoY: DATA_MISSING,
    grossMargin: DATA_MISSING,
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
  return risks;
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
    const timeout = setTimeout(() => controller.abort(), 10000);
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
    "数据暂不可用",
    "待接真实数据",
    "待补充",
    "undefined",
    "null",
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
  const number = toNumber(value);
  return number ? number.toFixed(2) : DATA_MISSING;
}

function formatPercent(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? `${number >= 0 ? "+" : ""}${number.toFixed(2)}%` : DATA_MISSING;
}

function formatMetric(value) {
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
