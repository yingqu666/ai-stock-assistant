import * as memory from "./memoryStore.js";
import * as postgres from "./postgres.js";

let activeStore = memory;
let databaseMode = "memory";
let databaseConnected = false;
let databaseTables = [];
let lastDatabaseError = "";

export async function initDatabase() {
  if (!postgres.isPostgresEnabled()) {
    postgres.logDatabaseConfig("startup");
    activeStore = memory;
    databaseMode = "memory";
    databaseConnected = false;
    databaseTables = [];
    lastDatabaseError = "DATABASE_URL 未配置";
    return { ok: true, mode: databaseMode, fallback: true };
  }

  try {
    await postgres.initPostgres();
    const status = await postgres.getPostgresStatus();
    activeStore = postgres;
    databaseMode = "postgres";
    databaseConnected = status.connected;
    databaseTables = status.tables;
    lastDatabaseError = "";
    return { ok: true, mode: databaseMode, fallback: false };
  } catch (error) {
    console.warn("PostgreSQL 初始化失败，已回退内存存储：", error.message);
    activeStore = memory;
    databaseMode = "memory";
    databaseConnected = false;
    databaseTables = [];
    lastDatabaseError = error.message;
    return { ok: false, mode: databaseMode, fallback: true, message: error.message };
  }
}

export function getDatabaseMode() {
  return databaseMode;
}

export async function getDatabaseStatus() {
  if (databaseMode === "postgres") {
    const status = await postgres.getPostgresStatus();
    databaseConnected = status.connected;
    databaseTables = status.tables;
    if (!status.connected) lastDatabaseError = status.error ?? "PostgreSQL disconnected";
    return { mode: status.connected ? "postgres" : "memory", connected: status.connected, tables: status.tables, error: status.error, info: status.info };
  }
  return { mode: "memory", connected: databaseConnected, tables: databaseTables, error: lastDatabaseError };
}

export const createUser = (...args) => activeStore.createUser(...args);
export const getUser = (...args) => activeStore.getUser(...args);
export const getUserByPhone = (...args) => activeStore.getUserByPhone(...args);
export const addWatchlist = (...args) => activeStore.addWatchlist(...args);
export const getWatchlist = (...args) => activeStore.getWatchlist(...args);
export const deleteWatchlist = (...args) => activeStore.deleteWatchlist(...args);
export const getWatchlistGroups = (...args) => activeStore.getWatchlistGroups(...args);
export const saveWatchlistGroup = (...args) => activeStore.saveWatchlistGroup(...args);
export const renameWatchlistGroup = (...args) => activeStore.renameWatchlistGroup(...args);
export const deleteWatchlistGroup = (...args) => activeStore.deleteWatchlistGroup(...args);
export const moveWatchlistStock = (...args) => activeStore.moveWatchlistStock(...args);
export const savePortfolio = (...args) => activeStore.savePortfolio(...args);
export const getPortfolio = (...args) => activeStore.getPortfolio(...args);
export const deletePortfolio = (...args) => activeStore.deletePortfolio(...args);
export const saveReport = (...args) => activeStore.saveReport(...args);
export const getReports = (...args) => activeStore.getReports(...args);
export const saveSettings = (...args) => activeStore.saveSettings(...args);
export const getSettings = (...args) => activeStore.getSettings(...args);
export const saveAIHistory = (...args) => activeStore.saveAIHistory(...args);
export const getAIHistory = (...args) => activeStore.getAIHistory(...args);
export const saveAIFeedback = (...args) => activeStore.saveAIFeedback(...args);
export const getAIFeedback = (...args) => activeStore.getAIFeedback(...args);
export const saveKnowledge = (...args) => activeStore.saveKnowledge(...args);
export const getKnowledge = (...args) => activeStore.getKnowledge(...args);
export const saveInvestmentJournal = (...args) => activeStore.saveInvestmentJournal(...args);
export const getInvestmentJournal = (...args) => activeStore.getInvestmentJournal(...args);
