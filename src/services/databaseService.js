import { getReports, saveReport, getHistory, saveHistory } from "./storageService.js";
import { getCurrentUser, getCurrentUserId, getUserStoragePrefix } from "./userService.js";

const dbPrefix = "ai-investment-db:";

export async function saveUserInfo(user) {
  return saveObject("user", user);
}

export async function getUserInfo() {
  return (
    getCurrentUser() ??
    getObject("user", {
      id: "local-user",
      phone: "",
      name: "个人用户",
    })
  );
}

export async function saveInvestmentProfile(profile) {
  return saveObject("investmentProfile", withUserId(profile));
}

export async function getInvestmentProfile() {
  return getObject("investmentProfile", {
    userId: getCurrentUserId(),
    preference: "稳健成长",
    industries: ["AI", "半导体", "新能源", "电力"],
    riskLevel: "中",
    refreshInterval: 30,
  });
}

export async function saveWatchlist(stocks) {
  return saveObject("watchlist", withUserId({ records: stocks }));
}

export async function getWatchlistRecords() {
  return getObject("watchlist", { records: [] }).records ?? [];
}

export async function savePortfolio(positions) {
  return saveObject("portfolio", withUserId({ records: positions }));
}

export async function getPortfolioRecords() {
  return getObject("portfolio", { records: [] }).records ?? [];
}

export async function saveAiReport(report) {
  return saveReport(withUserId(report));
}

export async function getAiReports() {
  return getReports();
}

export async function saveReviewHistory(history) {
  return saveHistory(withUserId(history));
}

export async function getReviewHistory() {
  return getHistory();
}

function withUserId(value) {
  return { ...value, userId: getCurrentUserId() };
}

async function saveObject(key, value) {
  try {
    window.localStorage.setItem(getScopedKey(key), JSON.stringify(value));
  } catch {
    // Storage is best-effort for the static prototype.
  }
  return value;
}

function getObject(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(getScopedKey(key)) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function getScopedKey(key) {
  return `${dbPrefix}${getUserStoragePrefix()}${key}`;
}
