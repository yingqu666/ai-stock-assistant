import { cloudDataApi } from "./cloudService.js";
import { getReports as getLocalReports, saveReport as saveLocalReport } from "./storageService.js";
import { addLog } from "./logService.js";

let syncState = defaultStatus();

export function getSyncStatus() {
  return syncState;
}

export function getTopSyncStatus() {
  const entries = Object.values(syncState).filter(Boolean);
  const latest = entries.reduce((selected, item) => {
    if (!selected) return item;
    return (item.lastSyncAtMs ?? 0) > (selected.lastSyncAtMs ?? 0) ? item : selected;
  }, null);

  return latest ?? {
    status: "尚未同步",
    message: "",
    source: "本次会话",
    lastSyncAt: "尚未同步",
    lastSyncAtMs: 0,
  };
}

export function setSyncStatus(scope, status, message = "", extra = {}) {
  const timestampMs = extra.lastSyncAtMs ?? parseDateValue(extra.lastSyncAt)?.getTime() ?? Date.now();
  const item = {
    status,
    message,
    source: extra.source ?? "前端同步",
    ...extra,
    lastSyncAt: extra.lastSyncAt ?? formatDateTime(timestampMs),
    lastSyncAtMs: timestampMs,
  };

  syncState = {
    ...syncState,
    [scope]: item,
  };

  notifySyncStatusUpdated(item);
  return item;
}

export async function checkCloudStatus() {
  try {
    const response = await fetch(`${getApiBase()}/db-status`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);

    const databaseTime = data.connected ? await getDatabaseLatestSyncTime() : null;
    const lastSync = databaseTime ?? { lastSyncAtMs: Date.now(), source: "云端状态检查" };
    setSyncStatus("cloud", data.connected ? "云端已连接" : "部分回退", data.connected ? "Supabase PostgreSQL 正常" : "数据库未连接", {
      connected: data.connected,
      mode: data.mode,
      tables: data.tables ?? [],
      source: lastSync.source,
      lastSyncAtMs: lastSync.lastSyncAtMs,
      lastSyncAt: formatDateTime(lastSync.lastSyncAtMs),
    });

    return { ...data, ok: true, lastSyncAt: formatDateTime(lastSync.lastSyncAtMs) };
  } catch (error) {
    logFailure("cloud", error, "云端连接状态检查失败");
    setSyncStatus("cloud", "连接失败", error.message, { mode: "unknown", tables: [], source: "云端状态检查" });
    return { ok: false, mode: "unknown", connected: false, tables: [], error: error.message };
  }
}

export async function syncWatchlist({ localLoad, localSave } = {}) {
  try {
    const localData = localLoad?.() ?? [];
    const result = await cloudDataApi.getWatchlist();
    let cloudData = result.data ?? [];
    if (!cloudData.length && localData.length) {
      const migrated = await Promise.all(localData.map((item) => cloudDataApi.saveWatchlist(normalizeWatchlistPayload(item)).then((saved) => saved.data).catch(() => null)));
      cloudData = migrated.filter(Boolean);
      if (!cloudData.length) cloudData = localData;
    }
    localSave?.(cloudData);
    setSyncStatus("watchlist", "已同步", "自选股已保存并从云端更新", { source: "Supabase" });
    return { data: cloudData, groups: result.groups, mode: "cloud", status: "已同步" };
  } catch (error) {
    const data = localLoad?.() ?? [];
    logFailure("watchlist", error, "自选股同步失败");
    setSyncStatus("watchlist", "离线模式", error.message, { source: "本地缓存" });
    return { data, mode: "local", status: "离线模式" };
  }
}

function normalizeWatchlistPayload(item = {}) {
  const code = item.stockCode ?? item.code;
  const name = item.stockName ?? item.name ?? code;
  return {
    ...item,
    code,
    name,
    stockCode: code,
    stockName: name,
    reason: item.reason ?? "",
    aiLevel: item.aiLevel ?? "观察",
    groupName: item.groupName ?? item.group ?? "长期观察",
  };
}

export async function addSyncedWatchlist(payload, { localAdd } = {}) {
  try {
    const result = await cloudDataApi.saveWatchlist(payload);
    setSyncStatus("watchlist", "已同步", "自选股已保存到云端", { source: "Supabase" });
    return { ok: true, data: result.data, mode: "cloud" };
  } catch (error) {
    const fallback = localAdd?.(payload);
    logFailure("watchlist", error, "自选股保存云端失败");
    setSyncStatus("watchlist", "同步失败", error.message, { source: "本地缓存" });
    return { ok: true, data: fallback, mode: "local", message: "云端不可用，已保存本地" };
  }
}

export async function deleteSyncedWatchlist(idOrCode, { localDelete } = {}) {
  try {
    await cloudDataApi.deleteWatchlist(idOrCode);
    setSyncStatus("watchlist", "已同步", "自选股已从云端删除", { source: "Supabase" });
  } catch (error) {
    logFailure("watchlist", error, "自选股删除云端失败");
    setSyncStatus("watchlist", "同步失败", error.message, { source: "本地缓存" });
  }
  localDelete?.(idOrCode);
}

export async function syncPortfolio({ localLoad, localSave } = {}) {
  try {
    const result = await cloudDataApi.getPortfolio();
    localSave?.(result.data);
    setSyncStatus("portfolio", "已同步", "持仓已从云端更新", { source: "Supabase" });
    return { data: result.data, mode: "cloud", status: "已同步" };
  } catch (error) {
    const data = localLoad?.() ?? [];
    logFailure("portfolio", error, "投资组合同步失败");
    setSyncStatus("portfolio", "离线模式", error.message, { source: "本地缓存" });
    return { data, mode: "local", status: "离线模式" };
  }
}

export async function saveSyncedPortfolio(payload, { localSaveItem } = {}) {
  try {
    const result = await cloudDataApi.savePortfolio(payload);
    setSyncStatus("portfolio", "已同步", "持仓已保存到云端", { source: "Supabase" });
    return { ok: true, data: result.data, mode: "cloud" };
  } catch (error) {
    const data = localSaveItem?.(payload);
    logFailure("portfolio", error, "投资组合保存云端失败");
    setSyncStatus("portfolio", "同步失败", error.message, { source: "本地缓存" });
    return { ok: true, data, mode: "local", message: "云端不可用，已保存本地" };
  }
}

export async function deleteSyncedPortfolio(id, { localDelete } = {}) {
  try {
    await cloudDataApi.deletePortfolio(id);
    setSyncStatus("portfolio", "已同步", "持仓已从云端删除", { source: "Supabase" });
  } catch (error) {
    logFailure("portfolio", error, "投资组合删除云端失败");
    setSyncStatus("portfolio", "同步失败", error.message, { source: "本地缓存" });
  }
  localDelete?.(id);
}

export async function syncReports() {
  try {
    const result = await cloudDataApi.getReports();
    await Promise.all((result.data ?? []).map((report) => saveLocalReport(report)));
    setSyncStatus("reports", "已同步", "报告已从云端更新", { source: "Supabase" });
    return { data: result.data ?? [], mode: "cloud", status: "已同步" };
  } catch (error) {
    const data = await getLocalReports();
    logFailure("reports", error, "报告同步失败");
    setSyncStatus("reports", "离线模式", error.message, { source: "本地缓存" });
    return { data, mode: "local", status: "离线模式" };
  }
}

export async function saveSyncedReport(report) {
  await saveLocalReport(report);
  try {
    const result = await cloudDataApi.saveReport(report);
    setSyncStatus("reports", "已同步", "报告已保存到云端", { source: "Supabase" });
    return result.data;
  } catch (error) {
    logFailure("reports", error, "报告保存云端失败");
    setSyncStatus("reports", "同步失败", error.message, { source: "本地缓存" });
    return report;
  }
}

export async function syncSettings({ localLoad, localSave } = {}) {
  try {
    const result = await cloudDataApi.getSettings();
    localSave?.(result.data);
    setSyncStatus("settings", "已同步", "设置已从云端更新", { source: "Supabase" });
    return { data: result.data, mode: "cloud", status: "已同步" };
  } catch (error) {
    const data = await localLoad?.();
    logFailure("settings", error, "设置同步失败");
    setSyncStatus("settings", "离线模式", error.message, { source: "本地缓存" });
    return { data, mode: "local", status: "离线模式" };
  }
}

export async function saveSyncedSettings(settings, { localSave } = {}) {
  await localSave?.(settings);
  try {
    const result = await cloudDataApi.saveSettings(settings);
    setSyncStatus("settings", "已同步", "设置已保存到云端", { source: "Supabase" });
    return result.data;
  } catch (error) {
    logFailure("settings", error, "设置保存云端失败");
    setSyncStatus("settings", "同步失败", error.message, { source: "本地缓存" });
    return settings;
  }
}

export function registerNetworkSync(onOnline) {
  window.addEventListener("online", () => {
    setSyncStatus("network", "已联网", "网络恢复，准备同步");
    onOnline?.();
  });
  window.addEventListener("offline", () => {
    setSyncStatus("network", "离线模式", "当前网络不可用");
  });
}

async function getDatabaseLatestSyncTime() {
  const loaders = [
    cloudDataApi.getWatchlist(),
    cloudDataApi.getPortfolio(),
    cloudDataApi.getReports(),
    cloudDataApi.getSettings(),
  ];
  const results = await Promise.allSettled(loaders);
  const timestamps = [];

  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    collectTimestamps(result.value, timestamps);
  });

  if (!timestamps.length) return null;
  return {
    lastSyncAtMs: Math.max(...timestamps),
    source: "Supabase数据记录",
  };
}

function collectTimestamps(value, output) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectTimestamps(item, output));
    return;
  }
  if (typeof value !== "object") return;

  const dateKeys = ["updatedAt", "updated_at", "createdAt", "created_at", "createdTime", "addedAt", "generatedAt", "date"];
  dateKeys.forEach((key) => {
    const parsed = parseDateValue(value[key]);
    if (parsed) output.push(parsed.getTime());
  });

  ["data", "items", "reports", "watchlist", "portfolio"].forEach((key) => {
    if (value[key]) collectTimestamps(value[key], output);
  });
}

function notifySyncStatusUpdated(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sync-status-updated", { detail }));
}

function logFailure(module, error, message) {
  addLog({
    module,
    status: "failed",
    mode: "cloud-first",
    source: "syncService",
    message,
    error: error.message,
  });
}

function getApiBase() {
  return window.__AI_INVESTMENT_API_BASE__ ?? document.querySelector("meta[name='api-base']")?.content ?? "http://localhost:8787/api";
}

function defaultStatus() {
  return {
    network: {
      status: navigator.onLine ? "已联网" : "离线模式",
      message: "",
      source: "浏览器网络",
      lastSyncAt: "尚未同步",
      lastSyncAtMs: 0,
    },
  };
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function parseDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
