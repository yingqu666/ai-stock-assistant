// 可切换为 "mock" 做离线测试；默认使用真实数据，失败自动回退模拟数据。
export const DATA_MODE = "real";

// 第十三阶段预留：前端仍可本地运行，后续可逐步切到 server API。
export const CLOUD_API_MODE = "local-first";
export const DEFAULT_API_BASE = "http://localhost:8787/api";

export const dataSources = {
  market: [
    { name: "东方财富 push2", type: "指数/市场宽度/板块", status: "ready" },
    { name: "同花顺", type: "行情", status: "planned" },
  ],
  news: [
    { name: "东方财富公告", type: "公告", status: "ready" },
    { name: "东方财富快讯", type: "市场新闻", status: "ready" },
    { name: "巨潮资讯", type: "公告", status: "planned" },
    { name: "财联社", type: "市场新闻", status: "planned" },
  ],
  cloud: [
    { name: "Express API", type: "用户/自选/报告/设置", status: "ready" },
    { name: "PostgreSQL", type: "云端数据库", status: "schema-ready" },
  ],
  ai: [
    { name: "OpenAI兼容接口", type: "研究总结", status: "configurable" },
    { name: "规则fallback", type: "离线分析", status: "ready" },
  ],
};
