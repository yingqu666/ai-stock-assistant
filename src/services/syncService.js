import { cloudDataApi } from "./cloudService.js";
import { getReports as getLocalReports, saveReport as saveLocalReport } from "./storageService.js";
import { addLog } from "./logService.js";

const syncStatusKey = "ai-investment-sync:status";

export function getSyncStatus() {
  try {
    return JSON.parse(window.localStorage.getItem(syncStatusKey) ?? "null") ?? defaultStatus();
  } catch {
    return defaultStatus();
  }
}

export function setSyncStatus(scope, status, message = "", extra = {}) {
  const next = {
    ...getSyncStatus(),
    [scope]: {
      status,
      message,
      lastSyncAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      ...extra,
    },
  };
  window.localStorage.setItem(syncStatusKey, JSON.stringify(next));
  return next[scope];
}

export async function checkCloudStatus() {
  try {
    const response = await fetch(`${getApiBase()}/db-status`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
    setSyncStatus("cloud", data.connected ? "已连接" : "部分回退", data.connected ? "Supabase PostgreSQL 正常" : "数据库未连接", {
      mode: data.mode,
      tables: data.tables ?? [],
    });
    return { ...data, ok: true };
  } catch (error) {
    logFailure("cloud", error, "云端连接状态检查失败");
    setSyncStatus("cloud", "连接失败", error.message, { mode: "unknown", tables: [] });
    return { ok: false, mode: "unknown", connected: false, tables: [], error: error.message };
  }
}

export async function syncWatchlist({ localLoad, localSave } = {}) {
  try {
    const result = await cloudDataApi.getWatchlist();
    localSave?.(result.data);
    setSyncStatus("watchlist", "已同步", "自选股已从云端更新", { source: "Supabase" });
    return { data: result.data, mode: "cloud", status: "已同步" };
  } catch (error) {
    const data = localLoad?.() ?? [];
    logFailure("watchlist", error, "自选股同步失败");
    setSyncStatus("watchlist", "离线模式", error.message, { source: "本地缓存" });
    return { data, mode: "local", status: "离线模式" };
  }
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
      lastSyncAt: "尚未同步",
    },
  };
}
