import { account } from "../data.js";
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
  const basePositions = normalizePositions(synced.data.length ? synced.data : account.positions);
  const positions = await Promise.all(basePositions.map(enrichPosition));

  const totalMarketValue = positions.reduce((sum, item) => sum + item.marketValue, 0);
  const totalCost = positions.reduce((sum, item) => sum + item.cost * item.qty, 0);
  const totalPnl = positions.reduce((sum, item) => sum + item.pnl, 0);
  const totalAsset = account.cash + totalMarketValue;
  const todayPnl = positions.reduce((sum, item) => sum + item.pnl * 0.08, 0);
  const allocation = buildAllocation(positions, totalMarketValue);
  const industryAllocation = buildIndustryAllocation(allocation);
  const dailyRecords = recordDailySnapshot(totalAsset, todayPnl, totalPnl);

  return {
    cash: account.cash,
    positions,
    totalAsset,
    todayPnl,
    totalPnl,
    returnRate: totalCost ? (totalPnl / totalCost) * 100 : 0,
    allocation,
    industryAllocation,
    dailyRecords,
    aiAnalysis: buildPortfolioAnalysis(positions, totalMarketValue, industryAllocation),
    syncStatus: getSyncStatus().portfolio,
  };
}

export async function addPortfolioPosition(input) {
  const payload = {
    stockCode: input.code,
    stockName: input.name || input.code,
    costPrice: Number(input.cost),
    quantity: Number(input.qty),
  };
  if (!payload.stockCode || !payload.stockName || !payload.costPrice || !payload.quantity) {
    return { ok: false, message: "请填写股票代码、名称、成本和数量。" };
  }
  const result = await saveSyncedPortfolio(payload, {
    localSaveItem: (item) => saveLocalItem(item),
  });
  if (result.mode === "cloud") saveLocalItem(result.data);
  return { ok: true, message: result.mode === "cloud" ? "持仓已同步保存" : "云端不可用，持仓已保存本地" };
}

export async function removePortfolioPosition(id) {
  await deleteSyncedPortfolio(id, {
    localDelete: (targetId) => saveLocalPositions(loadLocalPositions().filter((item) => item.id !== targetId)),
  });
}

async function enrichPosition(position) {
  const quote = await queryStock(position.code);
  const currentPrice = Number(quote.price) || position.price || position.cost;
  const marketValue = currentPrice * position.qty;
  const costValue = position.cost * position.qty;
  const fees = Number(position.buyFee ?? 0) + Number(position.sellFee ?? 0) + Number(position.stampTax ?? 0) + Number(position.otherFee ?? 0);
  const pnl = marketValue - costValue - fees;
  return {
    ...position,
    currentPrice,
    changePercent: quote.changePercent ?? "模拟",
    marketValue,
    pnl,
    returnRate: costValue ? (pnl / costValue) * 100 : 0,
  };
}

function buildAllocation(positions, totalMarketValue) {
  return positions.map((item) => ({
    name: item.name,
    code: item.code,
    industry: inferIndustry(item.code),
    weight: totalMarketValue ? (item.marketValue / totalMarketValue) * 100 : 0,
  }));
}

function buildIndustryAllocation(allocation) {
  const map = new Map();
  allocation.forEach((item) => map.set(item.industry, (map.get(item.industry) ?? 0) + item.weight));
  return [...map.entries()].map(([industry, weight]) => ({ industry, weight })).sort((a, b) => b.weight - a.weight);
}

function recordDailySnapshot(totalAsset, todayPnl, totalPnl) {
  const today = new Date().toISOString().slice(0, 10);
  const records = loadHistory().filter((item) => item.date !== today);
  const next = [
    ...records,
    {
      date: today,
      totalAsset,
      todayPnl,
      totalPnl,
    },
  ].slice(-30);
  window.localStorage.setItem(scopedHistoryKey(), JSON.stringify(next));
  return next;
}

function saveLocalItem(item) {
  const normalized = normalizePosition(item);
  const next = [normalized, ...loadLocalPositions().filter((position) => position.id !== normalized.id)];
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
  return {
    id: position.id ?? position.code ?? position.stockCode,
    code: position.code ?? position.stockCode,
    name: position.name ?? position.stockName,
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
  if (code === "688981") return "半导体";
  if (code === "601138") return "AI算力";
  if (code === "600519") return "消费";
  if (code === "300750") return "新能源";
  if (code === "301396") return "软件服务";
  return "其他";
}

function buildPortfolioAnalysis(positions, totalMarketValue, industryAllocation) {
  const weights = positions.map((item) => ({ name: item.name, weight: totalMarketValue ? (item.marketValue / totalMarketValue) * 100 : 0 }));
  const maxStock = weights.sort((a, b) => b.weight - a.weight)[0];
  const maxIndustry = industryAllocation[0];
  const risks = [];
  if (maxStock?.weight > 60) risks.push(`${maxStock.name} 占比 ${maxStock.weight.toFixed(1)}%，单股集中度偏高`);
  if (maxIndustry?.weight > 70) risks.push(`${maxIndustry.industry} 行业占比 ${maxIndustry.weight.toFixed(1)}%，行业集中度偏高`);
  if (!risks.length) risks.push("组合集中度暂时可控，但仍需关注市场波动和新闻事件。");
  return {
    strengths: ["持仓数据已支持云端同步", "组合结构清晰，便于每日复盘"],
    risks,
    suggestions: ["关注单股和行业集中度变化", "结合风险提醒调整观察优先级，不输出买卖指令"],
  };
}
