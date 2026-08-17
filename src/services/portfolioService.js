import { account } from "../data.js";
import { answerInvestmentQuestion } from "./aiService.js";
import { getCachedMarketData, getCachedNewsData } from "./refreshService.js";
import { queryStock } from "./stockService.js";
import { deleteSyncedPortfolio, getSyncStatus, saveSyncedPortfolio, syncPortfolio } from "./syncService.js";
import { getUserStoragePrefix } from "./userService.js";

const localKey = "ai-investment-portfolio-cache";
const historyKey = "ai-investment-portfolio-history";

export async function getPortfolioSummary() {
  const synced = await syncPortfolio({
    localLoad: loadLocalPositions,
    localSave: saveLocalPositions,
  });
  const basePositions = normalizePositions(synced.data?.length ? synced.data : account.positions);
  const positions = await Promise.all(basePositions.map(enrichPosition));

  const stockAsset = sumBy(positions.filter((item) => item.assetType !== "ETF"), "marketValue");
  const etfAsset = sumBy(positions.filter((item) => item.assetType === "ETF"), "marketValue");
  const totalMarketValue = stockAsset + etfAsset;
  const totalCost = positions.reduce((sum, item) => sum + item.cost * item.qty, 0);
  const totalPnl = positions.reduce((sum, item) => sum + item.pnl, 0);
  const cash = Number(account.cash ?? 0);
  const totalAsset = cash + totalMarketValue;
  const todayPnl = positions.reduce((sum, item) => sum + item.todayPnl, 0);
  const allocation = buildAllocation(positions, totalMarketValue);
  const industryAllocation = buildIndustryAllocation(allocation);
  const dailyRecords = recordDailySnapshot(totalAsset, todayPnl, totalPnl);

  return {
    cash,
    positions,
    stockAsset,
    etfAsset,
    totalMarketValue,
    totalAsset,
    todayPnl,
    totalPnl,
    returnRate: totalCost ? (totalPnl / totalCost) * 100 : 0,
    concentrationRisk: buildConcentrationRisk(allocation, industryAllocation),
    allocation,
    industryAllocation,
    dailyRecords,
    sevenDayRecords: dailyRecords.slice(-7),
    thirtyDayRecords: dailyRecords.slice(-30),
    aiAnalysis: buildPortfolioAnalysis(positions, totalMarketValue, industryAllocation),
    syncStatus: getSyncStatus().portfolio ?? { status: synced.status ?? "本地模式", lastSyncAt: "暂无", source: synced.mode ?? "本地" },
  };
}

export async function analyzeHoldingRisks(portfolio = null) {
  const summary = portfolio ?? await getPortfolioSummary();
  const [marketData, newsSnapshot] = await Promise.all([
    getCachedMarketData().catch(() => ({})),
    getCachedNewsData().catch(() => ({ news: [], stockNews: [] })),
  ]);
  const fallback = buildHoldingRiskAnalysis(summary, marketData, newsSnapshot, "fallback");
  try {
    const ai = await answerInvestmentQuestion("请基于当前市场、新闻和我的持仓，分析每个持仓的风险，不给买卖指令。", {
      marketData,
      newsData: [...(newsSnapshot.news ?? []), ...(newsSnapshot.stockNews ?? [])].slice(0, 12),
      portfolio: summary.positions,
      riskData: summary.concentrationRisk ? [summary.concentrationRisk.message] : [],
    });
    return {
      ...fallback,
      source: ai.source ?? fallback.source,
      overall: ai.answer ?? fallback.overall,
      aiRaw: ai.raw,
    };
  } catch (error) {
    return {
      ...fallback,
      source: "fallback",
      overall: `${fallback.overall} AI接口暂不可用，已使用本地规则fallback：${error.message}`,
    };
  }
}

export async function previewPortfolioPosition(code) {
  const keyword = String(code ?? "").trim();
  if (!keyword) return { ok: false, message: "请输入股票或ETF代码。" };
  const quote = await queryStock(keyword);
  if (!quote?.code) return { ok: false, message: `未找到标的：${keyword}` };
  return {
    ok: true,
    data: {
      code: quote.code,
      name: quote.name,
      assetType: quote.assetType ?? "股票",
      currentPrice: Number(quote.price) || 0,
      priceText: quote.price ?? "暂无",
      industry: quote.industry ?? "待补充",
      market: quote.market ?? "待补充",
      dataSource: quote.dataSource ?? "stockService",
      dataStatus: quote.dataStatus ?? "部分真实",
      updatedAt: quote.updatedAt ?? new Date().toLocaleString("zh-CN", { hour12: false }),
    },
  };
}

export async function addPortfolioPosition(input) {
  const quoteResult = await previewPortfolioPosition(input.code);
  if (!quoteResult.ok) return quoteResult;
  const quote = quoteResult.data;
  const costPrice = Number(input.cost);
  const quantity = Number(input.qty);
  if (!costPrice || !quantity) {
    return { ok: false, message: "请填写买入价格和买入数量。" };
  }

  const payload = {
    stockCode: quote.code,
    stockName: quote.name,
    assetType: quote.assetType,
    industry: quote.industry,
    currentPrice: quote.currentPrice,
    costPrice,
    quantity,
  };

  const result = await saveSyncedPortfolio(payload, {
    localSaveItem: (item) => saveLocalItem(item),
  });
  if (result.mode === "cloud") saveLocalItem(result.data);
  return { ok: true, message: result.mode === "cloud" ? `持仓已同步保存：${quote.name}` : `云端不可用，持仓已保存本地：${quote.name}` };
}

export async function removePortfolioPosition(id) {
  await deleteSyncedPortfolio(id, {
    localDelete: (targetId) => saveLocalPositions(loadLocalPositions().filter((item) => normalizePosition(item).id !== targetId)),
  });
}

async function enrichPosition(position) {
  const quote = await queryStock(position.code);
  const currentPrice = Number(quote.price) || position.price || position.cost;
  const marketValue = currentPrice * position.qty;
  const costValue = position.cost * position.qty;
  const fees = Number(position.buyFee ?? 0) + Number(position.sellFee ?? 0) + Number(position.stampTax ?? 0) + Number(position.otherFee ?? 0);
  const pnl = marketValue - costValue - fees;
  const change = parseChange(quote.changePercent);
  return {
    ...position,
    name: quote.name ?? position.name,
    assetType: quote.assetType ?? position.assetType ?? "股票",
    industry: quote.industry ?? position.industry ?? inferIndustry(position.code),
    currentPrice,
    currentPriceText: quote.price ?? currentPrice.toFixed(2),
    changePercent: quote.changePercent ?? "暂无",
    todayPnl: marketValue * (Number.isFinite(change) ? change / 100 : 0),
    marketValue,
    costValue,
    pnl,
    returnRate: costValue ? (pnl / costValue) * 100 : 0,
    weight: 0,
    dataSource: quote.dataSource ?? "stockService",
    dataStatus: quote.dataStatus ?? "部分真实",
    updatedAt: quote.updatedAt ?? "暂无",
  };
}

function buildAllocation(positions, totalMarketValue) {
  return positions.map((item) => ({
    name: item.name,
    code: item.code,
    assetType: item.assetType,
    industry: item.industry,
    marketValue: item.marketValue,
    weight: totalMarketValue ? (item.marketValue / totalMarketValue) * 100 : 0,
  }));
}

function buildIndustryAllocation(allocation) {
  const map = new Map();
  allocation.forEach((item) => map.set(item.industry, (map.get(item.industry) ?? 0) + item.weight));
  return [...map.entries()].map(([industry, weight]) => ({ industry, weight })).sort((a, b) => b.weight - a.weight);
}

function buildConcentrationRisk(allocation, industryAllocation) {
  const maxStock = [...allocation].sort((a, b) => b.weight - a.weight)[0];
  const maxIndustry = industryAllocation[0];
  let score = 35;
  if (maxStock?.weight > 50) score += 25;
  if (maxIndustry?.weight > 60) score += 25;
  if (allocation.length <= 2 && allocation.length > 0) score += 15;
  score = Math.min(100, score);
  const level = score >= 75 ? "偏高" : score >= 50 ? "中等" : "可控";
  return {
    score,
    level,
    message: maxStock ? `最大单一标的 ${maxStock.name} 占比 ${maxStock.weight.toFixed(1)}%，最大行业 ${maxIndustry?.industry ?? "暂无"} 占比 ${maxIndustry?.weight?.toFixed(1) ?? 0}%。` : "暂无持仓，集中度风险低。",
  };
}

function recordDailySnapshot(totalAsset, todayPnl, totalPnl) {
  const today = new Date().toISOString().slice(0, 10);
  const records = loadHistory().filter((item) => item.date !== today);
  const seed = records.length ? records : buildSeedHistory(totalAsset);
  const next = [
    ...seed.filter((item) => item.date !== today),
    { date: today, totalAsset, todayPnl, totalPnl },
  ].slice(-30);
  window.localStorage.setItem(scopedHistoryKey(), JSON.stringify(next));
  return next;
}

function buildSeedHistory(totalAsset) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const drift = (index - 3) * 18;
    return {
      date: date.toISOString().slice(0, 10),
      totalAsset: Math.max(0, totalAsset + drift),
      todayPnl: drift,
      totalPnl: drift,
    };
  });
}

function saveLocalItem(item) {
  const normalized = normalizePosition(item);
  const next = [normalized, ...loadLocalPositions().filter((position) => normalizePosition(position).id !== normalized.id)];
  saveLocalPositions(next);
  return normalized;
}

function loadLocalPositions() {
  try {
    return JSON.parse(window.localStorage.getItem(scopedKey()) ?? "null") ?? account.positions;
  } catch {
    return account.positions;
  }
}

function saveLocalPositions(positions) {
  window.localStorage.setItem(scopedKey(), JSON.stringify(normalizePositions(positions)));
}

function loadHistory() {
  try {
    return JSON.parse(window.localStorage.getItem(scopedHistoryKey()) ?? "[]");
  } catch {
    return [];
  }
}

function scopedKey() {
  return `${getUserStoragePrefix()}${localKey}`;
}

function scopedHistoryKey() {
  return `${getUserStoragePrefix()}${historyKey}`;
}

function normalizePositions(positions) {
  return (positions ?? []).map(normalizePosition).filter((item) => item.code && item.qty > 0);
}

function normalizePosition(position) {
  const code = position.code ?? position.stockCode;
  return {
    id: String(position.id ?? `${code}-${position.createdAt ?? Date.now()}`),
    code,
    name: position.name ?? position.stockName ?? code,
    assetType: position.assetType ?? "股票",
    industry: position.industry ?? inferIndustry(code),
    qty: Number(position.qty ?? position.quantity ?? 0),
    cost: Number(position.cost ?? position.costPrice ?? 0),
    price: Number(position.price ?? position.currentPrice ?? position.costPrice ?? 0),
    buyFee: Number(position.buyFee ?? 0),
    sellFee: Number(position.sellFee ?? 0),
    stampTax: Number(position.stampTax ?? 0),
    otherFee: Number(position.otherFee ?? 0),
  };
}

function inferIndustry(code) {
  if (code === "688981" || code === "512760" || code === "512480") return "半导体";
  if (code === "159819") return "AI主题";
  if (code === "600519") return "消费";
  if (code === "300750") return "新能源";
  if (code === "301396") return "软件服务";
  if (code === "600176") return "玻璃玻纤";
  return "其他";
}

function buildLegacyPortfolioAnalysis(positions, totalMarketValue, industryAllocation) {
  const allocation = buildAllocation(positions, totalMarketValue);
  const maxStock = [...allocation].sort((a, b) => b.weight - a.weight)[0];
  const maxIndustry = industryAllocation[0];
  const risks = [];
  if (maxStock?.weight > 50) risks.push(`${maxStock.name} 占比 ${maxStock.weight.toFixed(1)}%，单一标的集中度偏高`);
  if (maxIndustry?.weight > 60) risks.push(`${maxIndustry.industry} 行业占比 ${maxIndustry.weight.toFixed(1)}%，行业集中度偏高`);
  if (!risks.length) risks.push("组合集中度暂时可控，但仍需关注市场波动和新闻事件。");
  return {
    strengths: ["持仓数据支持云端同步", "股票与ETF已统一纳入资产管理", "组合结构清晰，便于每日复盘"],
    risks,
    suggestions: ["关注单一标的和行业集中度变化", "结合风险提醒调整观察优先级", "不输出买卖指令，只给出研究和风险提示"],
  };
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
}

function buildPortfolioAnalysis(positions, totalMarketValue, industryAllocation) {
  const allocation = buildAllocation(positions, totalMarketValue);
  const maxStock = [...allocation].sort((a, b) => b.weight - a.weight)[0];
  const maxIndustry = industryAllocation[0];
  const concentration = Math.max(maxStock?.weight ?? 0, maxIndustry?.weight ?? 0);
  const score = Math.max(30, Math.min(100, Math.round(88 - concentration * 0.45 - (positions.length > 0 && positions.length <= 2 ? 8 : 0))));
  const riskLevel = concentration >= 65 ? "高" : concentration >= 40 ? "中" : "低";
  const industryConcentration = maxIndustry ? `${maxIndustry.industry} 占比 ${maxIndustry.weight.toFixed(1)}%` : "暂无持仓";
  const maxRiskSource = maxIndustry?.weight > (maxStock?.weight ?? 0)
    ? `${maxIndustry.industry}行业集中度偏高`
    : (maxStock ? `${maxStock.name}单一标的占比偏高` : "暂无持仓风险");
  const risks = [];
  if (maxStock?.weight > 50) risks.push(`${maxStock.name} 占比 ${maxStock.weight.toFixed(1)}%，单一标的集中度偏高`);
  if (maxIndustry?.weight > 60) risks.push(`${maxIndustry.industry} 行业占比 ${maxIndustry.weight.toFixed(1)}%，行业集中度偏高`);
  if (!risks.length) risks.push("组合集中度暂时可控，但仍需关注市场波动和新闻事件。");
  const positionAdvice = riskLevel === "高" ? "降低同方向新增仓位" : riskLevel === "中" ? "保持当前仓位并等待确认" : "低仓位到中等仓位观察";
  return {
    score,
    industryConcentration,
    riskLevel,
    maxRiskSource,
    positionAdvice,
    adjustmentDirections: [
      riskLevel === "高" ? "优先降低单一行业或单一标的集中度" : "继续保持分散观察",
      "新增资产前先检查是否与现有持仓同方向暴露过高",
      "结合AI日报和风险看板复核市场环境",
    ],
    strengths: ["持仓数据支持云端同步", "股票与ETF已统一纳入资产管理", "组合结构清晰，便于每日复盘"],
    risks,
    suggestions: ["关注单一标的和行业集中度变化", "结合风险提醒调整观察优先级", "不输出买卖指令，只给出研究和风险提示"],
  };
}

function buildHoldingRiskAnalysis(summary = {}, marketData = {}, newsSnapshot = {}, source = "fallback") {
  const marketRisk = marketData.marketSentiment?.riskLevel ?? marketData.marketSentiment?.moneyEffect ?? "中";
  const newsRows = [...(newsSnapshot.stockNews ?? []), ...(newsSnapshot.news ?? [])];
  const holdings = (summary.positions ?? []).map((position) => {
    const relatedNews = newsRows.filter((item) => {
      const text = `${item.title ?? ""}${item.relatedStock ?? ""}${(item.relatedStocks ?? []).join("")}${item.relatedIndustry ?? ""}${(item.relatedIndustries ?? []).join("")}`;
      return text.includes(position.code) || text.includes(position.name) || text.includes(position.industry);
    }).slice(0, 3);
    return buildHoldingRiskItem(position, summary, marketData, relatedNews);
  });
  return {
    source,
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    overall: holdings.length
      ? `当前持仓风险以${summary.concentrationRisk?.level ?? "中等"}为主，市场环境${marketRisk}。以下仅做风险观察，不自动交易。`
      : "暂无持仓，无法生成持仓风险分析。",
    holdings,
    basis: {
      market: marketData.marketSentiment?.summary ?? "市场状态数据不足",
      hotSectors: (marketData.hotSectors ?? []).slice(0, 5).map((item) => item.name),
      newsCount: newsRows.length,
    },
  };
}

function buildHoldingRiskItem(position = {}, summary = {}, marketData = {}, relatedNews = []) {
  const isEtf = position.assetType === "ETF";
  const weight = Number(position.weight ?? 0);
  const returnRate = Number(position.returnRate ?? 0);
  const currentPrice = Number(position.currentPrice ?? position.price ?? 0);
  const cost = Number(position.cost ?? 0);
  const hotSectors = marketData.hotSectors ?? [];
  const sectorHot = hotSectors.find((sector) => {
    const text = `${sector.name ?? ""}${sector.reason ?? ""}${sector.aiReason ?? ""}`;
    return text.includes(position.industry) || String(position.industry ?? "").includes(sector.name);
  });
  const riskScore = Math.min(100, Math.max(15,
    35
    + (weight > 35 ? 20 : weight > 20 ? 10 : 0)
    + (returnRate < -8 ? 16 : returnRate > 20 ? 10 : 0)
    + (relatedNews.some((item) => /利空|减持|亏损|下滑|处罚|风险/.test(`${item.impact ?? ""}${item.title ?? ""}`)) ? 18 : 0)
    + (marketData.marketSentiment?.moneyEffect === "偏弱" ? 12 : 0)
    - (sectorHot ? 8 : 0),
  ));
  const riskLevel = riskScore >= 70 ? "高" : riskScore >= 45 ? "中" : "低";
  const watchPrice = currentPrice > 0 ? `${(currentPrice * 0.97).toFixed(currentPrice >= 100 ? 1 : 2)}-${(currentPrice * 1.03).toFixed(currentPrice >= 100 ? 1 : 2)}` : "价格数据不足";
  const riskPrice = currentPrice > 0 ? (returnRate < 0 ? currentPrice * 0.97 : currentPrice * 0.94).toFixed(currentPrice >= 100 ? 1 : 2) : "价格数据不足";
  const riskReasons = [
    `仓位：当前占比${weight.toFixed(1)}%，${weight > 35 ? "单一持仓偏高" : "仓位暂可控"}`,
    `盈亏：当前收益率${returnRate.toFixed(2)}%，${returnRate < -8 ? "亏损扩大需要复核逻辑" : returnRate > 20 ? "浮盈较高需防回撤" : "盈亏未触发极端风险"}`,
    relatedNews[0] ? `新闻：${relatedNews[0].title}` : "新闻：暂未匹配到强相关新闻",
    isEtf
      ? `ETF：重点观察${position.industry}板块趋势、成交额和流动性`
      : `股票：重点观察公司公告、财务、行业位置和相关新闻`,
  ];
  return {
    code: position.code,
    name: position.name,
    assetType: position.assetType,
    riskLevel,
    aiJudgment: riskLevel === "高" ? "风险较高，优先复核持仓逻辑" : riskLevel === "中" ? "中等风险，继续观察确认" : "风险暂可控，跟踪变化",
    riskReasons,
    watchPrice,
    riskPrice,
    watchChanges: isEtf
      ? ["板块是否仍在热点方向", "成交额是否持续活跃", "跟踪方向是否出现利空新闻"]
      : ["公司公告是否改变逻辑", "财务和盈利趋势是否稳定", "行业热度和资金是否延续"],
    holdConditions: isEtf
      ? ["跟踪板块仍保持趋势和成交活跃", "未出现持续资金流出", "市场赚钱效应不明显恶化"]
      : ["公司基本面和公告未出现明显恶化", "价格未跌破风险位置", "行业逻辑和新闻催化未被证伪"],
    relatedNews,
  };
}

function parseChange(value) {
  const number = Number(String(value ?? "").replace("%", "").replace("+", ""));
  return Number.isFinite(number) ? number : 0;
}
