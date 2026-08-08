import { stockDatabase, userPortfolio } from "../data.js";
import { cloudDataApi } from "./cloudService.js";
import { addSyncedWatchlist, deleteSyncedWatchlist, getSyncStatus, syncWatchlist } from "./syncService.js";
import { getUserStoragePrefix } from "./userService.js";

const key = "ai-investment-cloud-watchlist-cache";
const groupKey = "ai-investment-watchlist-groups-cache";
const defaultGroups = ["AI科技", "半导体", "电力能源", "长期观察"];

export async function getSyncedWatchlist() {
  const result = await syncWatchlist({
    localLoad: loadLocalWatchlist,
    localSave: saveLocalWatchlist,
  });
  const groups = result.groups ?? (await getWatchlistGroups());
  return {
    items: normalizeItems(result.data),
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
  if (!keyword) return { ok: false, message: "请输入股票代码、名称或拼音简称。" };

  const stock = await findStock(keyword);
  if (!stock) return { ok: false, message: `未找到匹配股票：${keyword}` };

  const current = loadLocalWatchlist();
  if (current.some((item) => normalizeItem(item).code === stock.code)) {
    return { ok: false, message: "该股票已经在关注列表中。" };
  }

  const payload = {
    code: stock.code,
    name: stock.name,
    stockCode: stock.code,
    stockName: stock.name,
    reason: `${stock.industry ?? "A股"}方向观察，等待更多事件验证。`,
    aiLevel: "新加入观察",
    groupName,
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
    const groups = [...normalizeGroups(loadLocalGroups()), { name: cleanName }];
    saveLocalGroups(groups);
    return { ok: true, groups, message: `已本地创建分组：${cleanName}` };
  }
}

export async function renameWatchlistGroup(oldName, newName) {
  try {
    await cloudDataApi.renameWatchlistGroup(oldName, newName);
  } catch {
    // local fallback below
  }
  const groups = normalizeGroups(loadLocalGroups()).map((group) => (group.name === oldName ? { ...group, name: newName } : group));
  const items = loadLocalWatchlist().map((item) => (normalizeItem(item).groupName === oldName ? { ...item, groupName: newName } : item));
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
  return { ok: true, message: "分组已删除，组内股票已移至长期观察" };
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
  return { ok: true, message: "股票分组已更新" };
}

async function findStock(keyword) {
  try {
    const result = await cloudDataApi.getStocks(keyword);
    if (result.data?.[0]) return result.data[0];
  } catch {
    // fallback below
  }
  const upper = keyword.toUpperCase();
  return stockDatabase.find((stock) => stock.code === keyword || stock.name.includes(keyword) || String(stock.pinyin ?? "").toUpperCase().includes(upper));
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
    return JSON.parse(window.localStorage.getItem(localKey(key)) ?? "null") ?? userPortfolio;
  } catch {
    return userPortfolio;
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
    .map((group, index) => ({ id: group.id ?? group.name, name: group.name ?? group, sortOrder: group.sortOrder ?? index }))
    .filter((group) => {
      if (!group.name || seen.has(group.name)) return false;
      seen.add(group.name);
      return true;
    });
}

function normalizeItems(items) {
  return (items ?? []).map(normalizeItem);
}

function normalizeItem(item) {
  return {
    id: item.id,
    code: item.code ?? item.stockCode,
    stockCode: item.stockCode ?? item.code,
    name: item.name ?? item.stockName,
    stockName: item.stockName ?? item.name,
    groupName: item.groupName ?? "长期观察",
    addedAt: item.addedAt ?? item.createdAt ?? new Date().toLocaleString("zh-CN", { hour12: false }),
    reason: item.reason ?? "",
    aiLevel: item.aiLevel ?? "观察",
  };
}
