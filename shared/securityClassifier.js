const MISSING_PATTERNS = /^(|暂无|数据源未返回|数据不足|数据暂不可用|真实行情获取失败|待补充|待接真实数据|undefined|null)$/;
const BOARD_LABELS = new Set(["沪市主板", "深市主板", "创业板", "科创板", "北交所", "沪市", "深市", "A股"]);

export function classifySecurity(security = {}) {
  const code = String(security.code ?? security.stockCode ?? "").trim();
  const name = String(security.name ?? security.stockName ?? security.companyName ?? "").trim();
  const listedDays = estimateListedDays(security.listingDate ?? security.inceptionDate);
  const isEtf = isEtfCode(code) || /ETF|基金/.test(`${name}${security.assetType ?? ""}${security.securityType ?? ""}`);
  const isSt = !isEtf && /(^|\s|\*)ST/i.test(name);
  const isNewStock = !isEtf && (name.startsWith("N") || name.startsWith("C") || (Number.isFinite(listedDays) && listedDays >= 0 && listedDays < 5));
  const securityType = isEtf ? "etf" : isSt ? "st" : isNewStock ? "newStock" : "stock";
  return {
    assetType: isEtf ? "ETF" : "股票",
    securityType,
    isEtf,
    isSt,
    isNewStock,
    listedDays: Number.isFinite(listedDays) ? listedDays : null,
    template: isEtf ? "ETF专项模板" : isSt ? "ST风险模板" : isNewStock ? "新股降级模板" : "普通A股模板",
    warnings: buildSecurityWarnings({ securityType, name, listedDays }),
  };
}

export function assessDataQuality(security = {}) {
  const profile = security.securityProfile ?? classifySecurity(security);
  const financials = validateFinancials(security.financials ?? {}, profile);
  const fields = profile.isEtf
    ? [
      hasValue(security.price),
      hasValue(security.changePercent),
      hasValue(security.amount),
      hasValue(security.trackingIndex) || hasMeaningfulIndustry(security.industry),
      hasValue(security.fundScale) || hasValue(security.marketCap) || hasValue(security.volume),
    ]
    : [
      hasValue(security.price),
      hasValue(security.changePercent),
      hasValue(security.amount),
      hasMeaningfulIndustry(security.industry),
      hasValue(security.pe) || hasValue(security.pb),
      financials.availableCount >= 2,
      (security.announcements ?? []).length > 0 || (security.stockNews ?? security.news ?? []).length > 0,
      hasValue(security.highPrice) && hasValue(security.lowPrice),
    ];
  const availableCount = fields.filter(Boolean).length;
  const requiredCount = fields.length;
  let level = availableCount >= Math.ceil(requiredCount * 0.75) ? "complete" : availableCount >= Math.ceil(requiredCount * 0.4) ? "partial" : "insufficient";
  if (!hasValue(security.price) || !hasValue(security.changePercent)) level = "insufficient";
  if (security.dataConflict) level = "insufficient";
  if (profile.isNewStock && level === "complete") level = "partial";
  if (financials.hasFatalIssue && !profile.isEtf) level = level === "complete" ? "partial" : "insufficient";
  return {
    level,
    label: level === "complete" ? "完整" : level === "partial" ? "部分缺失" : "严重缺失",
    availableCount,
    requiredCount,
    canScore: level !== "insufficient" && !profile.isNewStock && !financials.hasFatalIssue,
    canGeneratePriceLevels: level !== "insufficient" && !profile.isNewStock,
    canGenerateTechnicalView: level !== "insufficient" && !profile.isNewStock,
    message: security.dataConflict ? `数据源冲突：${security.dataConflict}` : buildQualityMessage(level, profile, financials),
    missingFields: buildMissingFields(security, profile, financials),
    financials,
  };
}

export function validateFinancials(financials = {}, profile = {}) {
  if (profile.isEtf) {
    return {
      ...financials,
      status: "not_applicable",
      availableCount: 0,
      hasFatalIssue: false,
      issues: ["ETF不适用公司财务指标"],
      roe: "不适用",
      source: financials.source ?? "ETF不适用公司财务指标",
    };
  }
  const clean = { ...financials };
  const issues = [...(Array.isArray(financials.issues) ? financials.issues : [])];
  for (const key of ["revenue", "revenueYoY", "netProfit", "netProfitYoY", "grossMargin", "netMargin", "roe", "debtRatio", "cashFlow"]) {
    if (isInvalidNumberText(clean[key])) {
      clean[key] = "数据异常";
      issues.push(`${key}数值异常`);
    }
  }
  if (isExtremePercent(clean.roe)) {
    clean.roe = "不适用";
    issues.push("ROE分母可能异常或净资产无效");
  }
  const rank = normalizeRank(clean.industryRank ?? clean.rank);
  if (rank && rank.denominator && rank.numerator > rank.denominator) {
    clean.industryRank = "暂无";
    issues.push("行业排名分母小于分子，已忽略");
  }
  const availableCount = ["revenue", "netProfit", "grossMargin", "netMargin", "roe", "debtRatio", "cashFlow"].filter((key) => hasValue(clean[key]) && clean[key] !== "数据异常" && clean[key] !== "不适用").length;
  return {
    ...clean,
    availableCount,
    hasFatalIssue: Boolean(financials.hasFatalIssue) || issues.some((item) => /ROE|数值异常|行业排名/.test(item)),
    issues,
    status: clean.status ?? (availableCount ? "partial" : "unavailable"),
    credibility: clean.credibility ?? { level: issues.length ? "低" : availableCount >= 4 ? "中" : "低", reason: issues.join("；") || "财务字段已通过基础格式校验" },
  };
}

export function buildPriceLevels(security = {}, quality = assessDataQuality(security)) {
  const profile = security.securityProfile ?? classifySecurity(security);
  if (!quality.canGeneratePriceLevels) {
    return {
      status: "unavailable",
      message: profile.isNewStock ? "新股历史数据不足，暂不生成技术买卖区间，谨慎交易。" : "数据不足，无法生成可靠价格区间。",
      levels: [],
    };
  }
  const price = parseNumber(security.price);
  const high = parseNumber(security.highPrice);
  const low = parseNumber(security.lowPrice);
  const previousClose = parseNumber(security.previousClose);
  if (![price, high, low].every(Number.isFinite) || high <= low || price <= 0) {
    return { status: "unavailable", message: "缺少当前价、日内高点或日内低点，不能生成价格区间。", levels: [] };
  }
  const support = Math.min(price, Math.max(low, previousClose ? Math.min(price * 0.985, previousClose) : price * 0.985));
  const watchLow = Math.max(low, support);
  const watchHigh = Math.min(price * 1.015, Math.max(price, watchLow * 1.01));
  const pressure = Math.max(high, watchHigh * 1.025);
  const risk = Math.min(low, watchLow * 0.985);
  if (!(pressure > watchHigh && watchHigh >= watchLow && risk < watchLow)) {
    return { status: "unavailable", message: "价格逻辑校验未通过，已停止生成区间。", levels: [] };
  }
  return {
    status: "available",
    message: "价格区间由程序基于真实当前价、日内高低点和昨收计算，AI只负责解释。",
    levels: [
      { name: "关注区域", value: `${formatPrice(watchLow)}-${formatPrice(watchHigh)}`, basis: previousClose ? "昨收附近 + 日内低点支撑 + 当前价缓冲" : "日内低点支撑 + 当前价缓冲" },
      { name: "压力区域", value: formatPrice(pressure), basis: "当日高点/上方波动压力" },
      { name: "风险区域", value: formatPrice(risk), basis: "跌破日内低点后短线趋势失效" },
    ],
  };
}

export function analyzeAnnouncement(title = "", context = {}) {
  const text = String(title ?? "");
  const type = classifyAnnouncementType(text);
  const numbers = extractAnnouncementNumbers(text);
  const direction = classifyAnnouncementDirection(text, type);
  const facts = numbers.length
    ? `公告涉及关键数字：${numbers.slice(0, 4).join("、")}。`
    : `${type}公告，标题未提供可校验的业绩数字，需阅读公告原文。`;
  return {
    type,
    direction,
    event: `${type}：${text || "公告标题未返回"}`,
    factSummary: facts,
    shortTermImpact: buildAnnouncementShortImpact(type, direction, numbers),
    midLongTermImpact: buildAnnouncementLongImpact(type, direction, context),
    risk: buildAnnouncementRisk(type, numbers),
    numbers,
    confidence: numbers.length || !/业绩|财报|预告/.test(text) ? "中" : "低",
  };
}

export function dedupeEvents(events = []) {
  const grouped = [];
  for (const event of events) {
    const key = normalizeEventKey(event.title ?? event.event ?? "");
    const existed = grouped.find((item) => item.key && similarity(item.key, key) > 0.72);
    if (existed) {
      existed.sources = [...new Set([...(existed.sources ?? []), event.source].filter(Boolean))];
      existed.duplicateCount += 1;
      continue;
    }
    grouped.push({ ...event, key, duplicateCount: 1, sources: [event.source].filter(Boolean) });
  }
  return grouped.map(({ key, ...event }) => event);
}

export function hasValue(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  return !MISSING_PATTERNS.test(text) && !/数据源未返回|暂无|待补|不适用|NaN|Infinity/.test(text);
}

function hasMeaningfulIndustry(value) {
  const text = String(value ?? "").trim();
  return hasValue(text) && !BOARD_LABELS.has(text);
}

function isEtfCode(code) {
  return /^(?:159|510|512|513|518|560|588|5\d{5}|1[56]\d{4})$/.test(String(code ?? ""));
}

function estimateListedDays(dateText) {
  const text = String(dateText ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return NaN;
  const date = new Date(`${text.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return NaN;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function buildSecurityWarnings({ securityType, listedDays }) {
  if (securityType === "etf") return ["ETF不适用公司主营、净利润、ROE等公司基本面模板。"];
  if (securityType === "st") return ["ST/*ST标的存在退市、流动性、财务和交易规则风险，所有判断需提高风险权重。"];
  if (securityType === "newStock") return [`上市交易时间较短${Number.isFinite(listedDays) ? `（约${listedDays}天）` : ""}，不生成技术评分和价格区间。`];
  return [];
}

function buildQualityMessage(level, profile, financials) {
  if (profile.isNewStock) return "新股历史数据不足，暂不生成技术买卖区间，谨慎交易。";
  if (level === "insufficient") return "数据不足，无法生成可靠判断。";
  if (financials.hasFatalIssue) return `财务字段存在异常：${financials.issues.join("；")}。`;
  if (level === "partial") return "部分关键数据缺失，评分和策略仅能降级参考。";
  return "关键数据较完整，可生成研究观察结论。";
}

function buildMissingFields(security, profile, financials) {
  const checks = profile.isEtf
    ? [["当前价", security.price], ["涨跌幅", security.changePercent], ["成交额", security.amount], ["跟踪方向/指数", security.trackingIndex || security.industry], ["规模/成交量", security.fundScale || security.marketCap || security.volume]]
    : [["当前价", security.price], ["涨跌幅", security.changePercent], ["成交额", security.amount], ["行业", security.industry], ["PE/PB", security.pe || security.pb], ["财务", financials.availableCount ? "ok" : ""], ["新闻/公告", (security.announcements ?? []).length || (security.stockNews ?? security.news ?? []).length ? "ok" : ""], ["高低点", security.highPrice && security.lowPrice ? "ok" : ""]];
  return checks.filter(([, value]) => !hasValue(value)).map(([name]) => name);
}

function isInvalidNumberText(value) {
  return /NaN|Infinity|-Infinity/.test(String(value ?? ""));
}

function isExtremePercent(value) {
  const number = parseNumber(value);
  return Number.isFinite(number) && Math.abs(number) > 200;
}

function normalizeRank(value) {
  const match = String(value ?? "").match(/(\d+(?:\.\d+)?)\s*[\/／]\s*(\d+(?:\.\d+)?)/);
  return match ? { numerator: Number(match[1]), denominator: Number(match[2]) } : null;
}

function parseNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function formatPrice(value) {
  return Number.isFinite(value) ? value.toFixed(value >= 100 ? 1 : 2) : "数据不足";
}

function classifyAnnouncementType(title) {
  if (/业绩预告|预增|预减|预盈|预亏/.test(title)) return "业绩预告";
  if (/年报|季报|半年报|财报|年度报告|季度报告/.test(title)) return "财报";
  if (/股权激励|激励计划/.test(title)) return "股权激励";
  if (/董事会|监事会|股东大会/.test(title)) return "董事会/治理决议";
  if (/合同|订单|中标|项目/.test(title)) return "重大合同/订单";
  if (/增持|减持|股东/.test(title)) return "股东增减持";
  if (/回购/.test(title)) return "回购";
  if (/上市公告|首次公开发行|发行公告/.test(title)) return "上市公告";
  if (/ST|风险警示|退市|终止上市/.test(title)) return "风险警示";
  return "其他";
}

function classifyAnnouncementDirection(title, type) {
  if (/增长|预增|盈利|中标|签订|回购|增持|解除风险/.test(title)) return "利好";
  if (/下降|预减|亏损|减持|处罚|诉讼|终止|风险警示|退市/.test(title)) return "利空";
  if (type === "股东增减持" && /减持/.test(title)) return "利空";
  if (type === "回购") return "利好";
  return "中性";
}

function extractAnnouncementNumbers(title) {
  const normalized = String(title ?? "").replace(/(\d+(?:\.\d+)?)\s*%\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*%/g, "$1%至$2%");
  return [...normalized.matchAll(/(^|[^\d%.-])(-?\d+(?:\.\d+)?\s*(?:%|万元|亿元|元|股|万股|亿股))/g)].map((match) => match[2]);
}

function buildAnnouncementShortImpact(type, direction, numbers) {
  if (type === "业绩预告" || type === "财报") return numbers.length ? `短期重点看业绩数字是否超预期，方向初判${direction}。` : `短期影响需依赖公告原文数字，标题信息不足，方向初判${direction}。`;
  if (type === "股东增减持") return direction === "利空" ? "短期可能压制风险偏好，需观察减持规模和价格反应。" : "短期可能改善股东信心，但仍需看成交确认。";
  if (type === "回购") return "短期可能改善情绪，需观察回购金额、价格上限和执行进度。";
  if (type === "风险警示") return "短期风险显著抬升，优先关注流动性和退市风险。";
  return `短期影响初判${direction}，需要结合行情反应验证。`;
}

function buildAnnouncementLongImpact(type, direction) {
  if (type === "业绩预告" || type === "财报") return "中长期取决于营收、利润、现金流和盈利质量是否持续改善。";
  if (type === "重大合同/订单") return "中长期取决于合同落地、毛利率、回款和收入确认节奏。";
  if (type === "股权激励") return "中长期看激励目标能否兑现，以及是否带来经营效率改善。";
  if (type === "风险警示") return "中长期需优先评估退市、财务和持续经营风险。";
  return `中长期影响目前为${direction}观察，需等待后续公告和财务验证。`;
}

function buildAnnouncementRisk(type, numbers) {
  if ((type === "业绩预告" || type === "财报") && !numbers.length) return "业绩类公告标题缺少可校验数字，不能直接推导业绩改善或恶化。";
  if (type === "股东增减持") return "需关注减持执行、价格区间和是否引发资金分歧。";
  if (type === "风险警示") return "需关注退市、停牌、流动性和交易规则变化。";
  return "需阅读公告原文，并结合财务、行情和行业变化复核。";
}

function normalizeEventKey(title) {
  return String(title ?? "").replace(/[【】\[\]\s：:，,。.;；()（）公告关于的]/g, "").slice(0, 60);
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  const intersection = [...aSet].filter((char) => bSet.has(char)).length;
  return intersection / Math.max(aSet.size, bSet.size, 1);
}
