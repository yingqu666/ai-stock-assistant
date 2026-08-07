const notificationLogKey = "investment_notification_log";

export const notificationChannels = [
  { id: "browser", name: "浏览器通知", status: "available" },
  { id: "wechat", name: "微信通知", status: "reserved" },
  { id: "email", name: "邮件通知", status: "reserved" },
  { id: "push", name: "手机推送", status: "reserved" },
];

export function getNotificationChannels() {
  return notificationChannels;
}

export async function notifyUser(title, body, options = {}) {
  const channel = options.channel ?? "browser";
  if (channel === "wechat") return sendWechatNotification(title, body, options);
  if (channel === "email") return sendEmailNotification(title, body, options);
  if (channel === "push") return sendPushNotification(title, body, options);
  return sendBrowserNotification(title, body, options);
}

export async function sendBrowserNotification(title, body, options = {}) {
  if (!("Notification" in window)) return { ok: false, reason: "浏览器不支持通知" };

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission !== "granted") {
    return { ok: false, reason: "通知权限未开启" };
  }

  const notification = new Notification(title, {
    body,
    tag: options.tag ?? "ai-investment-workbench",
    renotify: Boolean(options.renotify),
    icon: "./src/assets/icon-192.svg",
  });
  saveNotificationLog({
    title,
    body,
    channel: "browser",
    type: options.type ?? "manual",
    time: new Date().toISOString(),
    ok: true,
  });
  return { ok: true, notification };
}

export async function sendWechatNotification(title, body, options = {}) {
  const result = { ok: false, reason: "微信通知接口预留，尚未接入服务商" };
  saveNotificationLog({ title, body, channel: "wechat", type: options.type ?? "manual", time: new Date().toISOString(), ...result });
  return result;
}

export async function sendEmailNotification(title, body, options = {}) {
  const result = { ok: false, reason: "邮件通知接口预留，尚未配置邮件服务" };
  saveNotificationLog({ title, body, channel: "email", type: options.type ?? "manual", time: new Date().toISOString(), ...result });
  return result;
}

export async function sendPushNotification(title, body, options = {}) {
  const result = { ok: false, reason: "手机推送接口预留，尚未接入推送服务" };
  saveNotificationLog({ title, body, channel: "push", type: options.type ?? "manual", time: new Date().toISOString(), ...result });
  return result;
}

export async function notifyByType(type, extra = {}) {
  const text = buildNotificationText(type, extra);
  return notifyUser(text.title, text.body, { type, tag: text.tag, renotify: text.urgent, channel: extra.channel });
}

export function initNotificationSchedule() {
  scheduleDailyNotification("morning", 8, 0);
  scheduleDailyNotification("close", 20, 0);
  scheduleDailyNotification("ai-review", 21, 0);
}

export function notifyMajorRisk(risk) {
  return notifyByType("major-risk", {
    title: risk?.title,
    body: risk?.body ?? risk?.message,
  });
}

export function getNotificationLogs() {
  try {
    return JSON.parse(localStorage.getItem(notificationLogKey) ?? "[]");
  } catch {
    return [];
  }
}

export function buildNotificationText(type, extra = {}) {
  if (type === "morning") {
    return { title: "早盘报告已生成", body: "今日市场、关注方向和风险提醒已更新。", tag: "morning-report" };
  }
  if (type === "close") {
    return { title: "收盘复盘已完成", body: "今日行情总结、热点原因和明日观察已更新。", tag: "close-report" };
  }
  if (type === "ai-review") {
    return { title: "AI复盘已完成", body: "AI历史判断已根据真实行情更新准确率。", tag: "ai-review" };
  }
  if (type === "manual-report") {
    return { title: "今日报告已生成", body: "AI日报已经保存，可在报告中心查看。", tag: "manual-report" };
  }
  if (type === "major-risk") {
    return {
      title: extra.title ?? "重大风险提醒",
      body: extra.body ?? "检测到新闻或行情异常，请打开工作台查看。",
      tag: "major-risk",
      urgent: true,
    };
  }
  return { title: "AI投资助手提醒", body: "新的研究信息已更新。", tag: "general" };
}

function scheduleDailyNotification(type, hour, minute) {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  window.setTimeout(() => {
    notifyByType(type);
    window.setInterval(() => notifyByType(type), 24 * 60 * 60 * 1000);
  }, next.getTime() - now.getTime());
}

function saveNotificationLog(log) {
  const logs = getNotificationLogs();
  logs.unshift(log);
  localStorage.setItem(notificationLogKey, JSON.stringify(logs.slice(0, 100)));
}
