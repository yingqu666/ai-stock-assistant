import { randomUUID } from "node:crypto";

const state = {
  users: new Map(),
  watchlists: new Map(),
  portfolio: new Map(),
  reports: new Map(),
  settings: new Map(),
  aiHistory: new Map(),
  aiFeedback: new Map(),
  knowledge: new Map(),
  investmentJournal: new Map(),
};

export async function createUser(phone) {
  const id = `u_${phone}`;
  const existing = state.users.get(id);
  if (existing) return existing;
  const user = { id, phone, createdAt: new Date().toISOString() };
  state.users.set(id, user);
  return user;
}

export async function getUser(userId) {
  return state.users.get(userId) ?? null;
}

export async function getUserByPhone(phone) {
  return [...state.users.values()].find((user) => user.phone === phone) ?? null;
}

export async function addWatchlist(userId, payload) {
  return saveListItem("watchlists", userId, {
    stockCode: payload.stockCode ?? payload.code,
    stockName: payload.stockName ?? payload.name,
    reason: payload.reason ?? "",
    aiLevel: payload.aiLevel ?? "观察",
  });
}

export async function getWatchlist(userId) {
  return getList("watchlists", userId);
}

export async function deleteWatchlist(userId, idOrCode) {
  const list = getList("watchlists", userId);
  const next = list.filter((item) => item.id !== idOrCode && item.stockCode !== idOrCode && item.code !== idOrCode);
  state.watchlists.set(userId, next);
  return { ok: true, deleted: list.length - next.length };
}

export async function savePortfolio(userId, payload) {
  return saveListItem("portfolio", userId, {
    stockCode: payload.stockCode ?? payload.code,
    stockName: payload.stockName ?? payload.name,
    costPrice: Number(payload.costPrice ?? 0),
    quantity: Number(payload.quantity ?? 0),
  });
}

export async function getPortfolio(userId) {
  return getList("portfolio", userId);
}

export async function deletePortfolio(userId, id) {
  const list = getList("portfolio", userId);
  const next = list.filter((item) => item.id !== id);
  state.portfolio.set(userId, next);
  return { ok: true, deleted: list.length - next.length };
}

export async function saveReport(userId, payload) {
  return saveListItem("reports", userId, {
    date: payload.date ?? today(),
    type: payload.type ?? "manual",
    score: payload.score ?? null,
    content: payload.content ?? {},
    sourceData: payload.sourceData ?? {},
  });
}

export async function getReports(userId) {
  return getList("reports", userId);
}

export async function getSettings(userId) {
  return state.settings.get(userId) ?? {
    userId,
    refreshInterval: 30,
    industries: ["AI", "半导体", "新能源"],
    riskLevel: "中",
    aiMode: "fallback",
  };
}

export async function saveSettings(userId, settings) {
  const next = { ...(await getSettings(userId)), ...settings, userId, updatedAt: new Date().toISOString() };
  state.settings.set(userId, next);
  return next;
}

export async function saveAIHistory(userId, payload) {
  return saveListItem("aiHistory", userId, {
    date: payload.date ?? today(),
    predictionType: payload.predictionType ?? payload.prediction_type ?? "market",
    predictionContent: payload.predictionContent ?? payload.prediction_content ?? {},
    targetDate: payload.targetDate ?? payload.target_date ?? nextDate(payload.date),
    marketPrediction: payload.marketPrediction ?? "",
    sectorPrediction: payload.sectorPrediction ?? {},
    stockPrediction: payload.stockPrediction ?? {},
    riskPrediction: payload.riskPrediction ?? {},
    actualResult: payload.actualResult ?? null,
    accuracyScore: payload.accuracyScore ?? payload.accuracy_score ?? null,
    reviewStatus: payload.reviewStatus ?? payload.review_status ?? "pending",
    reviewNote: payload.reviewNote ?? payload.review_note ?? "",
  });
}

export async function getAIHistory(userId) {
  return getList("aiHistory", userId);
}

export async function saveAIFeedback(userId, payload) {
  return saveListItem("aiFeedback", userId, {
    question: payload.question ?? "",
    answer: payload.answer ?? "",
    rating: payload.rating ?? null,
    feedback: payload.feedback ?? "",
    source: payload.source ?? "",
    context: payload.context ?? {},
  });
}

export async function getAIFeedback(userId) {
  return getList("aiFeedback", userId);
}

export async function saveKnowledge(userId, payload) {
  return saveListItem("knowledge", userId, {
    title: payload.title ?? "",
    category: payload.category ?? "general",
    content: payload.content ?? "",
    source: payload.source ?? "",
    date: payload.date ?? today(),
  });
}

export async function getKnowledge(userId) {
  return getList("knowledge", userId);
}

export async function saveInvestmentJournal(userId, payload) {
  return saveListItem("investmentJournal", userId, {
    stock: payload.stock ?? "",
    action: payload.action ?? "关注",
    reason: payload.reason ?? "",
    date: payload.date ?? today(),
    result: payload.result ?? "",
    review: payload.review ?? "",
  });
}

export async function getInvestmentJournal(userId) {
  return getList("investmentJournal", userId);
}

function getList(collection, userId) {
  return state[collection].get(userId) ?? [];
}

function saveListItem(collection, userId, payload) {
  const item = {
    ...payload,
    id: payload.id ?? randomUUID(),
    userId,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const list = getList(collection, userId);
  state[collection].set(userId, [item, ...list.filter((entry) => entry.id !== item.id)]);
  return item;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(date = today()) {
  const value = new Date(date);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}
