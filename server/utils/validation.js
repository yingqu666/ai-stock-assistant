export function assertPhone(phone) {
  if (!/^1\d{10}$/.test(String(phone ?? ""))) {
    const error = new Error("手机号格式不正确");
    error.statusCode = 400;
    throw error;
  }
}

export function cleanString(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

export function cleanStockPayload(payload = {}) {
  const stockCode = cleanString(payload.stockCode ?? payload.code, 16);
  const stockName = cleanString(payload.stockName ?? payload.name, 80);
  if (!stockCode || !stockName) {
    const error = new Error("股票代码和名称不能为空");
    error.statusCode = 400;
    throw error;
  }
  return {
    ...payload,
    stockCode,
    stockName,
    reason: cleanString(payload.reason, 300),
    aiLevel: cleanString(payload.aiLevel ?? "观察", 40),
    groupName: cleanString(payload.groupName ?? payload.group ?? "长期观察", 80),
  };
}

export function cleanSettingsPayload(payload = {}) {
  return {
    refreshInterval: clampNumber(payload.refreshInterval, 15, 1440, 30),
    industries: Array.isArray(payload.industries)
      ? payload.industries.map((item) => cleanString(item, 40)).filter(Boolean).slice(0, 20)
      : [],
    riskLevel: ["低", "中", "高"].includes(payload.riskLevel) ? payload.riskLevel : "中",
    aiMode: payload.aiMode === "api" ? "api" : "fallback",
  };
}

export function cleanPortfolioPayload(payload = {}) {
  return {
    ...cleanStockPayload(payload),
    costPrice: clampNumber(payload.costPrice, 0, 1_000_000, 0),
    quantity: clampNumber(payload.quantity, 0, 1_000_000_000, 0),
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
