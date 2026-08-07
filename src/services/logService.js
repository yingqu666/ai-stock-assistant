const logKey = "ai-investment-refresh-logs";

export function addLog(entry) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    ...entry,
  };
  const logs = getLogs();
  try {
    window.localStorage.setItem(logKey, JSON.stringify([record, ...logs].slice(0, 80)));
  } catch {
    // Logs are best-effort in this static prototype.
  }
  return record;
}

export function getLogs() {
  try {
    return JSON.parse(window.localStorage.getItem(logKey) ?? "[]");
  } catch {
    return [];
  }
}

export function clearLogs() {
  try {
    window.localStorage.removeItem(logKey);
  } catch {
    // Ignore storage failures.
  }
}
