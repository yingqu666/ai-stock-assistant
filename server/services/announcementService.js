const announcementRules = [
  {
    category: "\u8d22\u62a5",
    keywords: ["\u5e74\u62a5", "\u5b63\u62a5", "\u534a\u5e74\u62a5", "\u51c0\u5229\u6da6", "\u8425\u6536", "\u4e1a\u7ee9"],
    positive: ["\u589e\u957f", "\u589e\u52a0", "\u626d\u4e8f", "\u8d85\u9884\u671f", "\u63d0\u5347"],
    negative: ["\u4e0b\u964d", "\u51cf\u5c11", "\u4e8f\u635f", "\u4f4e\u4e8e\u9884\u671f", "\u51cf\u503c"],
  },
  {
    category: "\u4e1a\u7ee9\u9884\u544a",
    keywords: ["\u4e1a\u7ee9\u9884\u544a", "\u9884\u589e", "\u9884\u51cf", "\u9884\u76c8", "\u9884\u4e8f"],
    positive: ["\u9884\u589e", "\u9884\u76c8", "\u589e\u957f"],
    negative: ["\u9884\u51cf", "\u9884\u4e8f", "\u4e0b\u964d"],
  },
  {
    category: "\u56de\u8d2d",
    keywords: ["\u56de\u8d2d", "\u80a1\u4efd\u56de\u8d2d"],
    positive: ["\u56de\u8d2d", "\u6ce8\u9500"],
    negative: [],
  },
  {
    category: "\u589e\u51cf\u6301",
    keywords: ["\u589e\u6301", "\u51cf\u6301", "\u80a1\u4e1c\u53d8\u5316"],
    positive: ["\u589e\u6301"],
    negative: ["\u51cf\u6301"],
  },
  {
    category: "\u91cd\u5927\u4e8b\u9879",
    keywords: ["\u91cd\u5927\u4e8b\u9879", "\u91cd\u7ec4", "\u5e76\u8d2d", "\u8bc9\u8bbc", "\u505c\u724c", "\u5408\u540c"],
    positive: ["\u4e2d\u6807", "\u7b7e\u8ba2", "\u5e76\u8d2d", "\u91cd\u7ec4"],
    negative: ["\u8bc9\u8bbc", "\u5904\u7f5a", "\u7ec8\u6b62", "\u505c\u724c"],
  },
];

export function analyzeAnnouncement(event = {}) {
  const text = `${event.title ?? ""} ${event.content ?? ""}`;
  const rule = announcementRules.find((item) => item.keywords.some((keyword) => text.includes(keyword))) ?? {
    category: event.category ?? "\u516c\u544a",
    positive: ["\u589e\u957f", "\u56de\u8d2d", "\u4e2d\u6807", "\u589e\u6301"],
    negative: ["\u4e0b\u964d", "\u51cf\u6301", "\u5904\u7f5a", "\u4e8f\u635f"],
  };

  const positiveKeywords = [...new Set(announcementRules.flatMap((item) => item.positive ?? []))];
  const negativeKeywords = [...new Set(announcementRules.flatMap((item) => item.negative ?? []))];
  const positiveHit = positiveKeywords.find((keyword) => text.includes(keyword));
  const negativeHit = negativeKeywords.find((keyword) => text.includes(keyword));
  const impact = positiveHit && !negativeHit ? "\u5229\u597d" : negativeHit && !positiveHit ? "\u5229\u7a7a" : "\u4e2d\u6027";

  return {
    title: event.title ?? "\u672a\u547d\u540d\u516c\u544a",
    stock: event.stock ?? event.relatedStock ?? "",
    source: event.source ?? "\u516c\u544a",
    time: event.time ?? new Date().toISOString(),
    event: rule.category,
    impact,
    affectedIndustry: event.industry ?? inferIndustry(text),
    reason: buildReason(rule.category, impact, positiveHit ?? negativeHit),
    risks: buildRisks(rule.category, impact),
  };
}

export function analyzeAnnouncements(events = []) {
  return events.map((event) => analyzeAnnouncement(event));
}

function inferIndustry(text) {
  if (text.includes("AI") || text.includes("\u7b97\u529b") || text.includes("\u670d\u52a1\u5668")) return "\u4eba\u5de5\u667a\u80fd/\u7b97\u529b";
  if (text.includes("\u534a\u5bfc\u4f53") || text.includes("\u82af\u7247")) return "\u534a\u5bfc\u4f53";
  if (text.includes("\u7535\u6c60") || text.includes("\u50a8\u80fd") || text.includes("\u65b0\u80fd\u6e90")) return "\u65b0\u80fd\u6e90/\u50a8\u80fd";
  if (text.includes("\u767d\u9152") || text.includes("\u6d88\u8d39")) return "\u6d88\u8d39";
  return "\u5f85\u4eba\u5de5\u786e\u8ba4";
}

function buildReason(category, impact, hit) {
  if (!hit) return `${category}\u516c\u544a\u6682\u672a\u51fa\u73b0\u660e\u786e\u65b9\u5411\u6027\u5173\u952e\u8bcd\uff0c\u6309\u4e2d\u6027\u4e8b\u4ef6\u8ddf\u8e2a\u3002`;
  return `${category}\u516c\u544a\u51fa\u73b0\u201c${hit}\u201d\u4fe1\u53f7\uff0c\u5f53\u524d\u521d\u6b65\u5224\u65ad\u4e3a${impact}\uff0c\u4ecd\u9700\u7ed3\u5408\u80a1\u4ef7\u4f4d\u7f6e\u548c\u6210\u4ea4\u786e\u8ba4\u3002`;
}

function buildRisks(category, impact) {
  if (impact === "\u5229\u597d") return [`${category}\u5229\u597d\u53ef\u80fd\u5df2\u88ab\u63d0\u524d\u4ea4\u6613`, "\u9700\u8981\u89c2\u5bdf\u540e\u7eed\u4e1a\u7ee9\u6216\u8ba2\u5355\u5151\u73b0"];
  if (impact === "\u5229\u7a7a") return [`${category}\u5229\u7a7a\u53ef\u80fd\u5f15\u53d1\u77ed\u671f\u6ce2\u52a8`, "\u9700\u8981\u5173\u6ce8\u7ba1\u7406\u5c42\u89e3\u91ca\u548c\u540e\u7eed\u516c\u544a"];
  return ["\u4fe1\u606f\u65b9\u5411\u4e0d\u591f\u660e\u786e", "\u9700\u8981\u7b49\u5f85\u66f4\u591a\u516c\u544a\u6216\u65b0\u95fb\u9a8c\u8bc1"];
}
