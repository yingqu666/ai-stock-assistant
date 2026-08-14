import { stockDatabase } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addSyncedWatchlist, deleteSyncedWatchlist, getSyncStatus, syncWatchlist } from "./syncService.js";
import { getUserStoragePrefix } from "./userService.js";

const key = "ai-investment-cloud-watchlist-cache";
const groupKey = "ai-investment-watchlist-groups-cache";
const defaultGroups = ["AI科技", "半导体", "ETF", "长期观察"];

export async function getSyncedWatchlist() {
  const result = await syncWatchlist({
    localLoad: loadLocalWatchlist,
    localSave: saveLocalWatchlist,
  });
  const groups = result.groups ?? (await getWatchlistGroups());
  const items = await enrichWatchlistQuotes(normalizeItems(result.data));
  return {
    items,
    groups,
    syncStatus: getSyncStatus().watchlist ?? {
      status: result.status,
      lastSyncAt: "尚未同步",
      message: "",
    },
  };
}

export async function addSyncedStock(query, groupName = "长期观察") {
  const keyword = String(query ?? "").trim();
  if (!keyword) return { ok: false, message: "请输入股票/ETF代码、名称、简称或拼音。" };

  const stock = await findStock(keyword);
  if (!stock) return { ok: false, message: `未找到匹配标的：${keyword}` };

  const current = loadLocalWatchlist();
  if (current.some((item) => normalizeItem(item).code === stock.code)) {
    return { ok: false, message: "该标的已经在关注列表中。" };
  }

  const payload = {
    code: stock.code,
    name: stock.name,
    stockCode: stock.code,
    stockName: stock.name,
    assetType: stock.assetType ?? "股票",
    industry: stock.industry ?? "待补充",
    price: stock.price,
    changePercent: stock.changePercent,
    reason: `${stock.industry ?? "A股"}方向观察，等待更多事件验证。`,
    aiLevel: stock.assetType === "ETF" ? "主题观察" : "新加入观察",
    groupName: stock.assetType === "ETF" && (!groupName || groupName === "长期观察") ? "ETF" : groupName,
    addedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  };

  const result = await addSyncedWatchlist(payload, {
    localAdd: () => addLocal(payload),
  });
  if (result.mode === "cloud") addLocal(result.data);
  return { ok: true, message: result.mode === "cloud" ? `已同步添加：${stock.name}` : `已本地添加：${stock.name}` };
}

export async function removeSyncedStock(idOrCode) {
  await deleteSyncedWatchlist(idOrCode, {
    localDelete: removeLocal,
  });
}

export async function getWatchlistGroups() {
  try {
    const result = await cloudDataApi.getWatchlistGroups();
    saveLocalGroups(result.data ?? defaultGroups.map((name) => ({ name })));
    return normalizeGroups(result.data);
  } catch {
    return normalizeGroups(loadLocalGroups());
  }
}

export async function createWatchlistGroup(name) {
  const cleanName = String(name ?? "").trim();
  if (!cleanName) return { ok: false, message: "请输入分组名称。" };
  try {
    const result = await cloudDataApi.saveWatchlistGroup({ name: cleanName });
    const groups = await getWatchlistGroups();
    return { ok: true, data: result.data, groups, message: `已创建分组：${cleanName}` };
  } catch {
    const groups = normalizeGroups([...loadLocalGroups(), { name: cleanName }]);
    saveLocalGroups(groups);
    return { ok: true, groups, message: `已本地创建分组：${cleanName}` };
  }
}

export async function renameWatchlistGroup(oldName, newName) {
  const cleanName = String(newName ?? "").trim();
  if (!cleanName) return { ok: false, message: "请输入新的分组名称。" };
  try {
    await cloudDataApi.renameWatchlistGroup(oldName, cleanName);
  } catch {
    // local fallback below
  }
  const groups = normalizeGroups(loadLocalGroups()).map((group) => (group.name === oldName ? { ...group, name: cleanName } : group));
  const items = loadLocalWatchlist().map((item) => (normalizeItem(item).groupName === oldName ? { ...item, groupName: cleanName } : item));
  saveLocalGroups(groups);
  saveLocalWatchlist(items);
  return { ok: true, message: "分组已重命名" };
}

export async function deleteWatchlistGroup(name) {
  try {
    await cloudDataApi.deleteWatchlistGroup(name);
  } catch {
    // local fallback below
  }
  saveLocalGroups(normalizeGroups(loadLocalGroups()).filter((group) => group.name !== name));
  saveLocalWatchlist(loadLocalWatchlist().map((item) => (normalizeItem(item).groupName === name ? { ...item, groupName: "长期观察" } : item)));
  return { ok: true, message: "分组已删除，组内标的已移动到长期观察" };
}

export async function moveSyncedStockToGroup(idOrCode, groupName) {
  try {
    await cloudDataApi.moveWatchlistStock(idOrCode, groupName);
  } catch {
    // local fallback below
  }
  saveLocalWatchlist(loadLocalWatchlist().map((item) => {
    const normalized = normalizeItem(item);
    return normalized.id === idOrCode || normalized.code === idOrCode ? { ...normalized, groupName } : normalized;
  }));
  return { ok: true, message: "标的分组已更新" };
}

async function enrichWatchlistQuotes(items) {
  const enriched = await Promise.all(items.map(async (item) => {
    const stock = await findStock(item.code).catch(() => null);
    if (!stock) return item;
    return normalizeItem({
      ...item,
      ...stock,
      id: item.id,
      groupName: item.groupName,
      reason: item.reason,
      aiLevel: stock.aiReport?.investmentDecision?.rating ?? stock.aiRating ?? item.aiLevel,
      aiRating: stock.aiReport?.investmentDecision?.rating ?? stock.aiRating ?? item.aiRating,
      riskLevel: stock.aiReport?.riskLevel ?? stock.riskLevel ?? item.riskLevel,
      latestNews: stock.stockNews?.[0]?.title ?? stock.latestNews ?? item.latestNews,
      aiOpinion: stock.aiReport?.overallJudgement ?? stock.aiReport?.stockAnalysis ?? stock.aiOpinion ?? item.aiOpinion,
      addedAt: item.addedAt,
      stockCode: item.code,
      stockName: stock.name ?? item.name,
    });
  }));
  saveLocalWatchlist(enriched);
  return enriched;
}

async function findStock(keyword) {
  try {
    const result = await cloudDataApi.getStocks(keyword);
    if (result.data?.[0]) return result.data[0];
  } catch {
    // fallback below
  }
  return stockDatabase.find((stock) => matchesStock(stock, keyword));
}

function matchesStock(stock, keyword) {
  const text = String(keyword ?? "").trim();
  const upper = text.toUpperCase();
  const aliases = (stock.aliases ?? []).map((item) => String(item).toUpperCase());
  return stock.code === text
    || stock.code.includes(text)
    || String(stock.name ?? "").includes(text)
    || String(stock.shortName ?? "").includes(text)
    || String(stock.pinyin ?? "").toUpperCase().includes(upper)
    || aliases.some((alias) => alias.includes(upper) || alias.includes(text));
}

function addLocal(item) {
  const normalized = normalizeItem(item);
  const next = [...loadLocalWatchlist().filter((entry) => normalizeItem(entry).code !== normalized.code), normalized];
  saveLocalWatchlist(next);
  return normalized;
}

function removeLocal(idOrCode) {
  saveLocalWatchlist(loadLocalWatchlist().filter((item) => {
    const normalized = normalizeItem(item);
    return normalized.id !== idOrCode && normalized.code !== idOrCode && normalized.stockCode !== idOrCode;
  }));
}

function loadLocalWatchlist() {
  try {
    return JSON.parse(window.localStorage.getItem(localKey(key)) ?? "null") ?? [];
  } catch {
    return [];
  }
}

function saveLocalWatchlist(items) {
  window.localStorage.setItem(localKey(key), JSON.stringify(normalizeItems(items)));
}

function loadLocalGroups() {
  try {
    return JSON.parse(window.localStorage.getItem(localKey(groupKey)) ?? "null") ?? defaultGroups.map((name) => ({ name }));
  } catch {
    return defaultGroups.map((name) => ({ name }));
  }
}

function saveLocalGroups(groups) {
  window.localStorage.setItem(localKey(groupKey), JSON.stringify(normalizeGroups(groups)));
}

function localKey(name) {
  return `${getUserStoragePrefix()}${name}`;
}

function normalizeGroups(groups = []) {
  const seen = new Set();
  return [...groups, ...defaultGroups.map((name) => ({ name }))]
    .map((group, index) => ({ id: group.id ?? group.name ?? group, name: group.name ?? group, sortOrder: group.sortOrder ?? index }))
    .filter((group) => {
      if (!group.name || seen.has(group.name)) return false;
      seen.add(group.name);
      return true;
    });
}

function normalizeItems(items) {
  return (items ?? []).map(normalizeItem).filter((item) => item.code);
}

function normalizeItem(item) {
  const code = item.code ?? item.stockCode;
  const name = item.name ?? item.stockName;
  const riskLevel = item.riskLevel ?? deriveRiskLevel(item);
  const aiLevel = item.aiLevel ?? item.aiRating ?? "观察";
  return {
    id: item.id,
    code,
    stockCode: item.stockCode ?? code,
    name,
    stockName: item.stockName ?? name,
    assetType: item.assetType ?? "股票",
    market: item.market ?? "待补充",
    industry: item.industry ?? "待补充",
    price: item.price ?? "暂无",
    changePercent: item.changePercent ?? item.change ?? "暂无",
    amount: item.amount ?? "暂无",
    volume: item.volume ?? "暂无",
    turnoverRate: item.turnoverRate ?? "暂无",
    marketCap: item.marketCap ?? "暂无",
    dataSource: item.dataSource ?? item.quoteSource ?? "云端/本地",
    dataStatus: item.dataStatus ?? "部分真实",
    updatedAt: item.updatedAt ?? "暂无",
    groupName: item.groupName ?? "长期观察",
    addedAt: item.addedAt ?? item.createdAt ?? new Date().toLocaleString("zh-CN", { hour12: false }),
    reason: item.reason ?? "",
    aiLevel,
    aiRating: item.aiRating ?? aiLevel,
    riskLevel,
    latestNews: item.latestNews ?? pickLatestNews(item),
    aiOpinion: item.aiOpinion ?? buildWatchlistOpinion({ ...item, code, name, aiLevel, riskLevel }),
    riskTips: item.riskTips ?? [],
    researchReport: item.researchReport,
  };
}

function pickLatestNews(item) {
  const first = item.stockNews?.[0] ?? item.news?.[0] ?? item.announcements?.[0];
  return first?.title ?? "暂无强相关新闻，继续观察公告和行情变化。";
}

function buildWatchlistOpinion(item) {
  const name = item.name ?? item.code ?? "该标的";
  const rating = item.aiLevel ?? item.aiRating ?? "观察";
  const risk = item.riskLevel ?? "中";
  return `${name}当前AI评级为${rating}，风险等级${risk}，重点跟踪涨跌幅、成交额、新闻公告和行业热度变化。`;
}

function deriveRiskLevel(item) {
  const change = Number(String(item.changePercent ?? item.change ?? "").replace("%", "").replace("+", ""));
  if (Number.isFinite(change) && Math.abs(change) >= 5) return "高";
  if ((item.riskTips ?? []).length >= 2 || /风险|回避|降低/.test(String(item.aiLevel ?? item.aiRating ?? ""))) return "高";
  if (Number.isFinite(change) && Math.abs(change) >= 2) return "中";
  return "中";
}
