import { apiRequest, clearServerToken, saveServerToken } from "./apiClient.js";

export async function cloudLogin(phone, code) {
  const result = await apiRequest("/login", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
  saveServerToken(result.token);
  return result;
}

export async function cloudSendCode(phone) {
  return apiRequest("/login", {
    method: "POST",
    body: JSON.stringify({ phone, action: "sendCode" }),
  });
}

export async function cloudLogout() {
  try {
    await apiRequest("/logout", { method: "POST" });
  } finally {
    clearServerToken();
  }
}

export const cloudDataApi = {
  getStocks: (query = "") => apiRequest(`/stocks?q=${encodeURIComponent(query)}`, { timeoutMs: 5000 }),
  getStockResearch: (query = "") => apiRequest(`/stocks/research?q=${encodeURIComponent(query)}`, { timeoutMs: 8000 }),
  getResearchSourceStatus: () => apiRequest("/stocks/research/status"),
  getStockDetail: (query = "") => apiRequest(`/stocks/detail?q=${encodeURIComponent(query)}`, { timeoutMs: 5000 }),
  getMarketSnapshot: () => apiRequest("/market/snapshot", { timeoutMs: 7000 }),
  getWatchlist: () => apiRequest("/watchlist"),
  saveWatchlist: (payload) => apiRequest("/watchlist", { method: "POST", body: JSON.stringify(payload) }),
  deleteWatchlist: (idOrCode) => apiRequest(`/watchlist/${encodeURIComponent(idOrCode)}`, { method: "DELETE" }),
  getWatchlistGroups: () => apiRequest("/watchlist/groups/list"),
  saveWatchlistGroup: (payload) => apiRequest("/watchlist/groups", { method: "POST", body: JSON.stringify(payload) }),
  renameWatchlistGroup: (oldName, name) => apiRequest(`/watchlist/groups/${encodeURIComponent(oldName)}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteWatchlistGroup: (name) => apiRequest(`/watchlist/groups/${encodeURIComponent(name)}`, { method: "DELETE" }),
  moveWatchlistStock: (idOrCode, groupName) => apiRequest(`/watchlist/${encodeURIComponent(idOrCode)}/group`, { method: "PUT", body: JSON.stringify({ groupName }) }),
  getPortfolio: () => apiRequest("/portfolio"),
  savePortfolio: (payload) => apiRequest("/portfolio", { method: "POST", body: JSON.stringify(payload) }),
  deletePortfolio: (id) => apiRequest(`/portfolio/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getReports: () => apiRequest("/reports"),
  saveReport: (payload) => apiRequest("/reports", { method: "POST", body: JSON.stringify(payload) }),
  getSettings: () => apiRequest("/settings"),
  saveSettings: (payload) => apiRequest("/settings", { method: "POST", body: JSON.stringify(payload) }),
  getAiHistory: () => apiRequest("/ai-history"),
  saveAiHistory: (payload) => apiRequest("/ai-history", { method: "POST", body: JSON.stringify(payload) }),
  generateStockAiReport: (payload) => apiRequest("/ai/stock-report", { method: "POST", body: JSON.stringify(payload), timeoutMs: 12000 }),
  getAiProviderStatus: () => apiRequest("/ai/provider-status", { timeoutMs: 5000 }),
  generateAiReport: (payload) => apiRequest("/ai/report", { method: "POST", body: JSON.stringify(payload) }),
  askAi: (payload) => apiRequest("/ai/ask", { method: "POST", body: JSON.stringify(payload) }),
  getAiStatus: () => apiRequest("/ai/status"),
  getAiLogs: () => apiRequest("/ai/logs"),
  saveAiFeedback: (payload) => apiRequest("/ai/feedback", { method: "POST", body: JSON.stringify(payload) }),
  getAiFeedback: () => apiRequest("/ai/feedback"),
  getDbStatus: () => apiRequest("/db-status"),
  runResearchTeam: (payload) => apiRequest("/ai/research-team", { method: "POST", body: JSON.stringify(payload) }),
  getAiReviewStats: () => apiRequest("/ai-review/stats"),
  runAiReview: (payload = {}) => apiRequest("/ai-review/run", { method: "POST", body: JSON.stringify(payload) }),
  getKnowledge: () => apiRequest("/knowledge"),
  saveKnowledge: (payload) => apiRequest("/knowledge", { method: "POST", body: JSON.stringify(payload) }),
  getInvestmentJournal: () => apiRequest("/investment-journal"),
  saveInvestmentJournal: (payload) => apiRequest("/investment-journal", { method: "POST", body: JSON.stringify(payload) }),
  getSchedulerStatus: () => apiRequest("/scheduler/status"),
  runSchedulerTask: (type) => apiRequest(`/scheduler/run/${encodeURIComponent(type)}`, { method: "POST" }),
  analyzeAnnouncements: (events) => apiRequest("/announcements/analyze", { method: "POST", body: JSON.stringify({ events }) }),
};
