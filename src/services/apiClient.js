const apiBaseUrl =
  window.__AI_INVESTMENT_API_BASE__ ??
  document.querySelector("meta[name='api-base']")?.content ??
  "http://localhost:8787/api";
const tokenKey = "ai-investment-auth:server-token";

export function saveServerToken(token) {
  if (token) window.localStorage.setItem(tokenKey, token);
}

export function clearServerToken() {
  window.localStorage.removeItem(tokenKey);
}

export async function apiRequest(path, options = {}) {
  const token = window.localStorage.getItem(tokenKey);
  const timeoutMs = options.timeoutMs ?? 20000;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...fetchOptions,
      signal: fetchOptions.signal ?? controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(fetchOptions.headers ?? {}),
      },
    });
  } catch (error) {
    const message = error.name === "AbortError" ? `请求超时：${timeoutMs}ms` : error.message;
    writeApiLog(path, "network-failed", message);
    throw new Error(message);
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    const message = isHtmlResponse(text)
      ? "行情数据暂缺，正在等待备用数据源"
      : `接口返回格式异常：${error.message}`;
    writeApiLog(path, "parse-failed", message);
    throw new Error(message);
  }

  if (!response.ok) {
    const message = data.message ?? `API HTTP ${response.status}`;
    writeApiLog(path, "api-failed", message);
    throw new Error(message);
  }
  return data;
}

function isHtmlResponse(text = "") {
  return /^\s*</.test(text) || /<\/?(html|body|pre|doctype)\b/i.test(text);
}

function writeApiLog(path, status, error) {
  try {
    const key = "ai-investment-refresh-logs";
    const current = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    window.localStorage.setItem(
      key,
      JSON.stringify([
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          time: new Date().toLocaleString("zh-CN", { hour12: false }),
          module: "api",
          source: path,
          mode: "cloud-first",
          status,
          error,
        },
        ...current,
      ].slice(0, 80)),
    );
  } catch {
    // API logs are best-effort only.
  }
}
