import { clearServerToken } from "./apiClient.js";
import { cloudLogin, cloudLogout, cloudSendCode } from "./cloudService.js";

const authKey = "ai-investment-auth:current";
const verifyPrefix = "ai-investment-auth:verify:";
const sessionDays = 30;

export function getCurrentUser() {
  try {
    const user = JSON.parse(window.localStorage.getItem(authKey) ?? "null");
    if (!user?.id) return null;
    if (user.expiresAt && Date.now() > user.expiresAt) {
      logout();
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getCurrentUser()?.id);
}

export function getCurrentUserId() {
  return getCurrentUser()?.id ?? "guest";
}

export function getUserStoragePrefix() {
  return `user:${getCurrentUserId()}:`;
}

export async function requestLoginCode(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!isValidPhone(normalizedPhone)) return { ok: false, message: "请输入 11 位手机号" };

  try {
    const result = await cloudSendCode(normalizedPhone);
    setLoginSyncStatus("已同步", "验证码请求已发送到云端");
    return { ok: true, message: result.message ?? "验证码已发送" };
  } catch (error) {
    const result = requestLocalLoginCode(normalizedPhone);
    setLoginSyncStatus("离线模式", error.message);
    return { ...result, message: `${result.message}（云端不可用，已回退本地）` };
  }
}

export async function loginWithCode(phone, code) {
  const normalizedPhone = normalizePhone(phone);
  try {
    const result = await cloudLogin(normalizedPhone, String(code ?? "").trim());
    const user = saveCurrentUser({ ...result.user, loginMode: "cloud" });
    setLoginSyncStatus("已同步", "已使用云端账号登录");
    return { ok: true, user, mode: "cloud" };
  } catch (error) {
    const result = loginLocalWithCode(normalizedPhone, code);
    setLoginSyncStatus(result.ok ? "离线模式" : "同步失败", error.message);
    return result.ok ? { ...result, mode: "local" } : result;
  }
}

export async function logout() {
  try {
    await cloudLogout();
  } catch {
    // Logout remains local if the server is unavailable.
  }
  clearServerToken();
  window.localStorage.removeItem(authKey);
}

export function getUserSchema() {
  return {
    users: ["id", "phone", "createdTime"],
    portfolio: ["id", "userId", "stockCode", "stockName", "costPrice", "quantity", "createdTime"],
    reports: ["id", "userId", "date", "type", "score", "content", "sourceData"],
    watchlist: ["id", "userId", "stockCode", "stockName", "reason", "aiLevel", "createdTime"],
    settings: ["id", "userId", "refreshInterval", "industries", "riskLevel", "aiMode"],
  };
}

function requestLocalLoginCode(phone) {
  const code = "888888";
  window.localStorage.setItem(
    `${verifyPrefix}${phone}`,
    JSON.stringify({
      phone,
      code,
      createdTime: new Date().toISOString(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    }),
  );
  return { ok: true, message: `模拟验证码：${code}` };
}

function loginLocalWithCode(phone, code) {
  const record = getVerifyRecord(phone);
  if (!record || Date.now() > record.expiresAt) return { ok: false, message: "验证码已过期，请重新获取" };
  if (String(code).trim() !== record.code) return { ok: false, message: "验证码不正确" };

  const user = saveCurrentUser({
    id: `u_${phone}`,
    phone,
    createdTime: getExistingCreatedTime(phone) ?? new Date().toISOString(),
    loginMode: "local",
  });
  return { ok: true, user };
}

function saveCurrentUser(user) {
  const record = {
    ...user,
    expiresAt: Date.now() + sessionDays * 24 * 60 * 60 * 1000,
    sessionDays,
  };
  window.localStorage.setItem(authKey, JSON.stringify(record));
  window.localStorage.setItem(`ai-investment-user:${record.id}`, JSON.stringify(record));
  return record;
}

function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

function isValidPhone(phone) {
  return /^1\d{10}$/.test(phone);
}

function getVerifyRecord(phone) {
  try {
    return JSON.parse(window.localStorage.getItem(`${verifyPrefix}${phone}`) ?? "null");
  } catch {
    return null;
  }
}

function getExistingCreatedTime(phone) {
  try {
    const user = JSON.parse(window.localStorage.getItem(`ai-investment-user:u_${phone}`) ?? "null");
    return user?.createdTime;
  } catch {
    return null;
  }
}

function setLoginSyncStatus(status, message) {
  try {
    const key = "ai-investment-sync:status";
    const current = JSON.parse(window.localStorage.getItem(key) ?? "null") ?? {};
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...current,
        login: {
          status,
          message,
          lastSyncAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        },
      }),
    );
  } catch {
    // Sync status is informational only.
  }
}
