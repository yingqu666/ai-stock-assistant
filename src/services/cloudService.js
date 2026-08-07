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
  getStocks: (query = "") => apiRequest(`/stocks?q=${encodeURIComponent(query)}`),
  getWatchlist: () => apiRequest("/watchlist"),
  saveWatchlist: (payload) => apiRequest("/watchlist", { method: "POST", body: JSON.stringify(payload) }),
  deleteWatchlist: (idOrCode) => apiRequest(`/watchlist/${encodeURIComponent(idOrCode)}`, { method: "DELETE" }),
  getPortfolio: () => apiRequest("/portfolio"),
  savePortfolio: (payload) => apiRequest("/portfolio", { method: "POST", body: JSON.stringify(payload) }),
  deletePortfolio: (id) => apiRequest(`/portfolio/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getReports: () => apiRequest("/reports"),
  saveReport: (payload) => apiRequest("/reports", { method: "POST", body: JSON.stringify(payload) }),
  getSettings: () => apiRequest("/settings"),
  saveSettings: (payload) => apiRequest("/settings", { method: "POST", body: JSON.stringify(payload) }),
  getAiHistory: () => apiRequest("/ai-history"),
  saveAiHistory: (payload) => apiRequest("/ai-history", { method: "POST", body: JSON.stringify(payload) }),
  generateAiReport: (payload) => apiRequest("/ai/report", { method: "POST", body: JSON.stringify(payload) }),
  askAi: (payload) => apiRequest("/ai/ask", { method: "POST", body: JSON.stringify(payload) }),
  getAiStatus: () => apiRequest("/ai/status"),
  getAiLogs: () => apiRequest("/ai/logs"),
  saveAiFeedback: (payload) => apiRequest("/ai/feedback", { method: "POST", body: JSON.stringify(payload) }),
  getAiFeedback: () => apiRequest("/ai/feedback"),
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
