// Switch to "mock" for offline testing. The default is real data with automatic fallback.
export const DATA_MODE = "real";

// Keep the current deployment behavior. When no production config is injected, local API is used.
export const CLOUD_API_MODE = "local-first";
export const DEFAULT_API_BASE = "http://localhost:8787/api";

export const dataSources = {
  market: [
    { name: "\u4e1c\u65b9\u8d22\u5bcc push2", type: "\u6307\u6570/\u5e02\u573a\u5bbd\u5ea6/\u677f\u5757", status: "ready" },
    { name: "\u540c\u82b1\u987a", type: "\u884c\u60c5", status: "planned" },
  ],
  stocks: [
    { name: "\u4e1c\u65b9\u8d22\u5bcc\u641c\u7d22", type: "A\u80a1/ETF\u57fa\u7840\u8bc1\u5238\u5339\u914d", status: "ready" },
    { name: "\u4e1c\u65b9\u8d22\u5bcc push2", type: "\u4e2a\u80a1/ETF\u884c\u60c5", status: "ready" },
  ],
  news: [
    { name: "\u4e1c\u65b9\u8d22\u5bcc\u516c\u544a", type: "\u516c\u544a", status: "ready" },
    { name: "\u4e1c\u65b9\u8d22\u5bcc\u5feb\u8baf", type: "\u5e02\u573a\u65b0\u95fb", status: "ready" },
    { name: "\u5de8\u6f6e\u8d44\u8baf", type: "\u516c\u544a/\u8d22\u62a5", status: "planned" },
    { name: "\u8d22\u8054\u793e", type: "\u884c\u4e1a/\u5e02\u573a\u65b0\u95fb", status: "planned" },
    { name: "\u4e2d\u56fd\u65b0\u95fb\u7f51", type: "\u653f\u7b56\u65b0\u95fb", status: "planned" },
  ],
  cloud: [
    { name: "Express API", type: "\u7528\u6237/\u81ea\u9009/\u7ec4\u5408/\u62a5\u544a/\u8bbe\u7f6e", status: "ready" },
    { name: "PostgreSQL/Supabase", type: "\u4e91\u7aef\u6570\u636e\u5e93", status: "ready" },
  ],
  ai: [
    { name: "OpenAI-compatible API", type: "\u771f\u5b9e\u5927\u6a21\u578b", status: "configurable" },
    { name: "\u89c4\u5219 fallback", type: "\u79bb\u7ebf\u5206\u6790", status: "ready" },
  ],
};
