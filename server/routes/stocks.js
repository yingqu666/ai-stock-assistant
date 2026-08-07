import { Router } from "express";
import { asyncHandler } from "../middleware/security.js";

export const stockRouter = Router();

const eastmoneyQuoteApi = "https://push2.eastmoney.com/api/qt";
const eastmoneySearchApi = "https://searchapi.eastmoney.com/api/suggest/get";

const fallbackStocks = [
  { code: "600519", name: "贵州茅台", price: "1688.50", changePercent: "+0.82%", industry: "白酒", amount: "82.40亿" },
  { code: "300750", name: "宁德时代", price: "214.20", changePercent: "+1.36%", industry: "新能源", amount: "96.10亿" },
  { code: "301396", name: "宏景科技", price: "28.64", changePercent: "-0.74%", industry: "软件服务", amount: "3.20亿" },
  { code: "688981", name: "中芯国际", price: "58.73", changePercent: "+2.18%", industry: "半导体", amount: "67.80亿" },
];

stockRouter.get("/", asyncHandler(async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    res.json({ ok: true, source: "fallback-list", updatedAt: new Date().toISOString(), data: fallbackStocks });
    return;
  }

  try {
    const candidates = await searchStocks(query);
    const limited = candidates.slice(0, 8);
    const data = await Promise.all(limited.map((stock) => fetchStockQuote(stock).catch(() => stock)));
    res.json({ ok: true, source: "东方财富", updatedAt: new Date().toISOString(), data });
  } catch (error) {
    const data = fallbackStocks.filter((stock) => stock.code.includes(query) || stock.name.includes(query));
    res.json({
      ok: true,
      source: "fallback",
      updatedAt: new Date().toISOString(),
      message: error.message,
      data: data.length ? data : fallbackStocks.slice(0, 1),
    });
  }
}));

async function searchStocks(query) {
  if (/^\d{6}$/.test(query)) return [{ code: query, name: query, market: marketFromCode(query), secid: toSecid(query) }];

  const url = `${eastmoneySearchApi}?input=${encodeURIComponent(query)}&type=14&token=`;
  const response = await fetchWithTimeout(url);
  const json = await response.json();
  const rows = json?.QuotationCodeTable?.Data ?? json?.data ?? [];
  const stocks = rows
    .map((item) => ({
      code: item.Code ?? item.code,
      name: item.Name ?? item.name,
      market: item.MktNum ?? item.market,
    }))
    .filter((item) => /^\d{6}$/.test(String(item.code ?? "")))
    .map((item) => ({ ...item, secid: toSecid(item.code, item.market) }));

  if (!stocks.length) throw new Error("未找到匹配股票");
  return stocks;
}

async function fetchStockQuote(stock) {
  const fields = "f12,f14,f2,f3,f4,f6,f20,f100";
  const url = `${eastmoneyQuoteApi}/ulist.np/get?fltt=2&fields=${fields}&secids=${stock.secid ?? toSecid(stock.code, stock.market)}`;
  const response = await fetchWithTimeout(url);
  const json = await response.json();
  const row = json?.data?.diff?.[0];
  if (!row) throw new Error("股票行情为空");

  return {
    code: row.f12 || stock.code,
    name: row.f14 || stock.name,
    price: formatPrice(row.f2),
    changePercent: formatPercent(row.f3),
    changeAmount: formatPrice(row.f4),
    amount: formatAmount(row.f6),
    marketCap: formatAmount(row.f20),
    industry: row.f100 || stock.industry || "待补充",
    quoteSource: "东方财富",
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    profile: `${row.f14 || stock.name}，A股上市公司。当前基础资料来自公开行情接口，后续可继续接入公告、财报和行业数据库完善公司介绍。`,
    riskTips: ["行情存在延迟，请结合公告、财报和市场环境观察。", "AI分析仅用于研究，不构成确定买卖建议。"],
  };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function toSecid(code, market) {
  if (String(market) === "1" || String(code).startsWith("6")) return `1.${code}`;
  return `0.${code}`;
}

function marketFromCode(code) {
  return String(code).startsWith("6") ? "1" : "0";
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  return normalizeNumber(value).toFixed(2);
}

function formatPercent(value) {
  const number = normalizeNumber(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatAmount(value) {
  const number = normalizeNumber(value);
  if (number >= 1000000000000) return `${(number / 1000000000000).toFixed(2)}万亿`;
  if (number >= 100000000) return `${(number / 100000000).toFixed(2)}亿`;
  if (number >= 10000) return `${(number / 10000).toFixed(2)}万`;
  return String(Math.round(number));
}
