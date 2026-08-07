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
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    writeApiLog(path, "network-failed", error.message);
    throw error;
  }

  const data = await response.json();
  if (!response.ok) {
    const message = data.message ?? `API HTTP ${response.status}`;
    writeApiLog(path, "api-failed", message);
    throw new Error(message);
  }
  return data;
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
