import { stockDatabase, userPortfolio } from "../data.js";
import { addSyncedWatchlist, deleteSyncedWatchlist, getSyncStatus, syncWatchlist } from "./syncService.js";
import { getUserStoragePrefix } from "./userService.js";

const key = "ai-investment-cloud-watchlist-cache";

export async function getSyncedWatchlist() {
  const result = await syncWatchlist({
    localLoad: loadLocalWatchlist,
    localSave: saveLocalWatchlist,
  });
  return {
    items: normalizeItems(result.data),
    syncStatus: getSyncStatus().watchlist ?? {
      status: result.status,
      lastSyncAt: "尚未同步",
      message: "",
    },
  };
}

export async function addSyncedStock(query) {
  const keyword = String(query ?? "").trim();
  if (!keyword) return { ok: false, message: "请输入股票代码或名称。" };

  const stock = findStock(keyword);
  if (!stock) return { ok: false, message: "股票库中暂未找到该股票。" };

  const current = loadLocalWatchlist();
  if (current.some((item) => item.code === stock.code || item.stockCode === stock.code)) {
    return { ok: false, message: "该股票已经在关注列表中。" };
  }

  const payload = {
    code: stock.code,
    name: stock.name,
    stockCode: stock.code,
    stockName: stock.name,
    reason: `${stock.industry ?? "A股"}方向观察，等待更多事件验证。`,
    aiLevel: "新加入观察",
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

function findStock(keyword) {
  return stockDatabase.find((stock) => stock.code === keyword || stock.name.includes(keyword));
}

function addLocal(item) {
  const normalized = normalizeItem(item);
  const next = [...loadLocalWatchlist().filter((entry) => normalizeItem(entry).code !== normalized.code), normalized];
  saveLocalWatchlist(next);
  return normalized;
}

function removeLocal(idOrCode) {
  saveLocalWatchlist(loadLocalWatchlist().filter((item) => item.id !== idOrCode && item.code !== idOrCode && item.stockCode !== idOrCode));
}

function loadLocalWatchlist() {
  try {
    return JSON.parse(window.localStorage.getItem(localKey()) ?? "null") ?? userPortfolio;
  } catch {
    return userPortfolio;
  }
}

function saveLocalWatchlist(items) {
  window.localStorage.setItem(localKey(), JSON.stringify(normalizeItems(items)));
}

function localKey() {
  return `${getUserStoragePrefix()}${key}`;
}

function normalizeItems(items) {
  return (items ?? []).map(normalizeItem);
}

function normalizeItem(item) {
  return {
    id: item.id,
    code: item.code ?? item.stockCode,
    name: item.name ?? item.stockName,
    addedAt: item.addedAt ?? item.createdAt ?? new Date().toLocaleString("zh-CN", { hour12: false }),
    reason: item.reason ?? "",
    aiLevel: item.aiLevel ?? "观察",
  };
}
