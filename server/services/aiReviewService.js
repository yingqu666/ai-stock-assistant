import { getAIHistory, saveAIHistory } from "../db/store.js";

const windows = [30, 60, 90];
const eastmoneyApi = "https://push2.eastmoney.com/api/qt";
const indexSecids = "1.000001,0.399001,0.399006";
const boardFs = "m:90+t:2";

export async function reviewUserAIHistory(userId, options = {}) {
  const history = await getAIHistory(userId);
  const pending = history.filter((item) => needsReview(item));
  const reviewed = [];
  const skipped = [];
  const actualCache = new Map();

  for (const item of pending) {
    const actual = options.actualResult ?? (await getActualResultForPrediction(item, actualCache));
    if (!actual.available) {
      skipped.push({ id: item.id, reason: actual.reason, source: actual.source });
      continue;
    }

    const score = scorePrediction(item, actual);
    reviewed.push(
      await saveAIHistory(userId, {
        ...item,
        id: item.id,
        actualResult: actual,
        accuracyScore: score.score,
        reviewStatus: score.status,
        reviewNote: score.note,
      }),
    );
  }

  const stats = buildAccuracyStats(await getAIHistory(userId));
  return {
    reviewedCount: reviewed.length,
    skippedCount: skipped.length,
    reviewed,
    skipped,
    stats,
  };
}

export async function getAIReviewStats(userId) {
  return buildAccuracyStats(await getAIHistory(userId));
}

export function buildReflection(history = [], currentInput = {}) {
  const reviewed = history.filter((item) => Number(item.accuracyScore ?? item.accuracy_score) >= 0);
  if (!reviewed.length) return "暂无足够历史复盘样本，当前报告以最新数据为主。";

  const industries = currentInput?.investmentProfile?.industries ?? [];
  const related = reviewed.filter((item) => industries.some((industry) => JSON.stringify(item).includes(industry)));
  const sample = related.length ? related : reviewed;
  const avg = Math.round(sample.reduce((sum, item) => sum + Number(item.accuracyScore ?? item.accuracy_score ?? 0), 0) / sample.length);

  if (avg < 60) return `过去类似判断平均准确度约 ${avg} 分，存在偏差，本次应降低信心并加强风险提示。`;
  if (avg < 75) return `过去类似判断平均准确度约 ${avg} 分，结论仅可作为观察线索，需要等待数据验证。`;
  return `过去类似判断平均准确度约 ${avg} 分，但不代表未来结果，仍需结合最新行情验证。`;
}

async function getActualResultForPrediction(item, cache) {
  const type = getType(item);
  const key = `${type}:${toDateKey(item.targetDate ?? item.target_date)}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const [market, boards] = await Promise.all([
      fetchMarketActual(),
      type === "industry" ? fetchIndustryActual() : Promise.resolve([]),
    ]);
    const stockCodes = type === "stock" || type === "risk" ? extractStockCodes(item) : [];
    const stocks = stockCodes.length ? await fetchStockActual(stockCodes) : [];
    const actual = {
      available: true,
      source: "东方财富",
      checkedAt: new Date().toISOString(),
      targetDate: toDateKey(item.targetDate ?? item.target_date),
      market,
      industries: boards,
      stocks,
      riskVerified: evaluateRiskResult(item, market, boards, stocks),
    };
    cache.set(key, actual);
    return actual;
  } catch (error) {
    const fallback = {
      available: false,
      source: "real-unavailable",
      reason: error.message,
      checkedAt: new Date().toISOString(),
    };
    cache.set(key, fallback);
    return fallback;
  }
}

function scorePrediction(item, actual) {
  const type = getType(item);
  if (type === "market") return scoreMarketPrediction(item, actual);
  if (type === "industry") return scoreIndustryPrediction(item, actual);
  if (type === "stock") return scoreStockPrediction(item, actual);
  if (type === "risk") return scoreRiskPrediction(item, actual);
  return buildScore(50, "缺少明确判断类型，暂按中性处理");
}

function scoreMarketPrediction(item, actual) {
  const text = predictionText(item);
  const averageChange = actual.market.averageChange;
  const turnoverChange = actual.market.turnoverChangePercent;
  let score = 45;
  const expectsPositive = hasAny(text, ["强", "上涨", "修复", "回流", "改善"]);
  const expectsWeak = hasAny(text, ["弱", "下跌", "回撤", "谨慎", "承压"]);
  const expectsRange = hasAny(text, ["震荡", "分化", "观察"]);

  if (expectsPositive && averageChange > 0) score += 30;
  if (expectsWeak && averageChange < 0) score += 30;
  if (expectsRange && Math.abs(averageChange) < 0.8) score += 25;
  if (hasAny(text, ["成交", "放量", "缩量"]) && Math.abs(turnoverChange) >= 3) score += 10;

  return buildScore(score, `指数平均涨跌幅 ${formatPercent(averageChange)}，成交额变化 ${formatPercent(turnoverChange)}。`);
}

function scoreIndustryPrediction(item, actual) {
  const text = predictionText(item);
  const matched = actual.industries.filter((board) => text.includes(board.name) || board.keywords.some((keyword) => text.includes(keyword)));
  let score = 45;
  if (matched.some((board) => board.changePercent > 0)) score += 35;
  if (matched.some((board) => board.changePercent > 1)) score += 10;
  if (!matched.length && actual.industries.some((board) => board.changePercent > 2 && text.includes("热点"))) score += 10;
  return buildScore(score, matched.length ? `匹配板块：${matched.map((item) => `${item.name}${formatPercent(item.changePercent)}`).join("、")}。` : "未匹配到明确行业板块。");
}

function scoreStockPrediction(item, actual) {
  const text = predictionText(item);
  let score = 45;
  const stocks = actual.stocks;
  if (!stocks.length) return buildScore(45, "未识别到可验证股票代码。");
  const maxUp = Math.max(...stocks.map((stock) => stock.changePercent));
  const maxDown = Math.min(...stocks.map((stock) => stock.changePercent));
  if (hasAny(text, ["关注", "改善", "走强", "修复"]) && maxUp > 0) score += 30;
  if (hasAny(text, ["谨慎", "风险", "回撤", "承压"]) && maxDown < 0) score += 25;
  return buildScore(score, `关注股票次日最大涨幅 ${formatPercent(maxUp)}，最大跌幅 ${formatPercent(maxDown)}。`);
}

function scoreRiskPrediction(item, actual) {
  const text = predictionText(item);
  let score = 45;
  if (actual.riskVerified) score += 35;
  if (hasAny(text, ["高位", "回撤", "波动"]) && actual.market.averageChange < 0) score += 10;
  if (actual.stocks.some((stock) => stock.changePercent < -2)) score += 10;
  return buildScore(score, actual.riskVerified ? "风险提醒得到次日行情验证。" : "次日行情暂未验证主要风险。");
}

function buildAccuracyStats(history) {
  const reviewed = history.filter((item) => item.accuracyScore !== null && item.accuracyScore !== undefined);
  const byWindow = Object.fromEntries(windows.map((days) => [String(days), summarize(filterByDays(reviewed, days))]));
  const byType = {
    market: summarize(reviewed.filter((item) => getType(item) === "market")),
    industry: summarize(reviewed.filter((item) => getType(item) === "industry")),
    stock: summarize(reviewed.filter((item) => getType(item) === "stock")),
    risk: summarize(reviewed.filter((item) => getType(item) === "risk")),
  };
  const byIndustry = {
    AI: summarize(reviewed.filter((item) => JSON.stringify(item).includes("AI"))),
    半导体: summarize(reviewed.filter((item) => JSON.stringify(item).includes("半导体"))),
    新能源: summarize(reviewed.filter((item) => JSON.stringify(item).includes("新能源"))),
  };
  const credibilityScore = calculateCredibility(byType, reviewed.length);

  return {
    sampleSize: reviewed.length,
    windows: byWindow,
    byType,
    byIndustry,
    credibilityScore,
    confidenceLevel: confidenceLevel(credibilityScore, reviewed.length),
    recent: reviewed.slice(0, 30),
  };
}

async function fetchMarketActual() {
  const url = `${eastmoneyApi}/ulist.np/get?fltt=2&fields=f12,f14,f2,f3,f6&secids=${indexSecids}`;
  const rows = await fetchEastmoneyRows(url);
  if (!rows.length) throw new Error("指数真实数据为空");
  const indexes = rows.map((row) => ({
    code: row.f12,
    name: normalizeName(row.f14),
    price: toNumber(row.f2),
    changePercent: toNumber(row.f3),
    turnover: toNumber(row.f6),
  }));
  const totalTurnover = indexes.reduce((sum, item) => sum + item.turnover, 0);
  const averageChange = indexes.reduce((sum, item) => sum + item.changePercent, 0) / indexes.length;
  return {
    indexes,
    averageChange,
    totalTurnover,
    turnoverChangePercent: 0,
  };
}

async function fetchIndustryActual() {
  const url = `${eastmoneyApi}/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(boardFs)}&fields=f14,f3`;
  const rows = await fetchEastmoneyRows(url);
  return rows.map((row) => ({
    name: row.f14,
    changePercent: toNumber(row.f3),
    keywords: buildIndustryKeywords(row.f14),
  }));
}

async function fetchStockActual(codes) {
  const secids = codes.map(toSecid).join(",");
  if (!secids) return [];
  const url = `${eastmoneyApi}/ulist.np/get?fltt=2&fields=f12,f14,f2,f3,f6&secids=${secids}`;
  const rows = await fetchEastmoneyRows(url);
  return rows.map((row) => ({
    code: row.f12,
    name: row.f14,
    price: toNumber(row.f2),
    changePercent: toNumber(row.f3),
    amount: toNumber(row.f6),
  }));
}

async function fetchEastmoneyRows(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`东方财富 HTTP ${response.status}`);
    const json = await response.json();
    return json?.data?.diff ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateRiskResult(item, market, boards, stocks) {
  const text = predictionText(item);
  if (stocks.some((stock) => stock.changePercent <= -2)) return true;
  if (market.averageChange <= -0.8 && hasAny(text, ["市场", "波动", "回撤", "风险"])) return true;
  if (boards.some((board) => board.changePercent <= -2) && hasAny(text, ["行业", "板块", "高位"])) return true;
  return false;
}

function needsReview(item) {
  if (item.reviewStatus && item.reviewStatus !== "pending") return false;
  const target = item.targetDate ?? item.target_date;
  if (!target) return true;
  return toDateKey(target) <= toDateKey(new Date());
}

function summarize(records) {
  if (!records.length) return { count: 0, accuracy: 0, effectiveRate: 0 };
  const avg = Math.round(records.reduce((sum, item) => sum + Number(item.accuracyScore ?? item.accuracy_score ?? 0), 0) / records.length);
  const effective = records.filter((item) => Number(item.accuracyScore ?? item.accuracy_score ?? 0) >= 60).length;
  return { count: records.length, accuracy: avg, effectiveRate: Math.round((effective / records.length) * 100) };
}

function calculateCredibility(byType, sampleSize) {
  if (!sampleSize) return 0;
  const weighted =
    (byType.market.accuracy || 0) * 0.35 +
    (byType.industry.accuracy || 0) * 0.25 +
    (byType.stock.accuracy || 0) * 0.2 +
    (byType.risk.effectiveRate || 0) * 0.2;
  const samplePenalty = sampleSize < 10 ? 0.85 : sampleSize < 30 ? 0.95 : 1;
  return Math.round(weighted * samplePenalty);
}

function confidenceLevel(score, sampleSize) {
  if (sampleSize < 5 || score < 60) return "低";
  if (score < 75) return "中";
  return "高";
}

function buildScore(score, note) {
  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: normalized,
    status: normalized >= 75 ? "correct" : normalized >= 60 ? "partial" : "wrong",
    note,
  };
}

function filterByDays(records, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return records.filter((item) => new Date(item.date) >= cutoff);
}

function predictionText(item) {
  return JSON.stringify({
    content: item.predictionContent ?? item.prediction_content,
    market: item.marketPrediction,
    sector: item.sectorPrediction,
    stock: item.stockPrediction,
    risk: item.riskPrediction,
  });
}

function extractStockCodes(item) {
  const matches = predictionText(item).match(/\b(00|30|60|68)\d{4}\b/g) ?? [];
  return [...new Set(matches)].slice(0, 10);
}

function buildIndustryKeywords(name = "") {
  const keywords = [name];
  if (name.includes("半导体") || name.includes("芯片")) keywords.push("半导体", "芯片");
  if (name.includes("人工智能") || name.includes("AI")) keywords.push("AI", "人工智能", "算力");
  if (name.includes("新能源") || name.includes("电池")) keywords.push("新能源", "电池");
  return [...new Set(keywords)];
}

function normalizeName(name) {
  if (name === "上证指数") return "上证指数";
  if (name === "深证成指") return "深证成指";
  if (name === "创业板指") return "创业板指";
  return name;
}

function toSecid(code) {
  return String(code).startsWith("6") ? `1.${code}` : `0.${code}`;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPercent(value) {
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getType(item) {
  return item.predictionType ?? item.prediction_type ?? "market";
}

function toDateKey(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
