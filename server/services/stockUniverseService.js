const eastmoneyListApi = "https://push2.eastmoney.com/api/qt/clist/get";

const STOCK_FS = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23";
const ETF_FS = "b:MK0021,b:MK0022,b:MK0023,b:MK0024";
const FIELDS = "f12,f14,f13,f100,f2,f3,f5,f6,f8,f20,f162,f167";
const PAGE_SIZE = 100;
const MAX_STOCK_PAGES = 90;
const MAX_ETF_PAGES = 35;

let universeCache = {
  dateKey: "",
  updatedAt: "",
  source: "",
  status: "idle",
  message: "尚未更新",
  data: [],
};

const etfKnowledge = {
  "512760": { aliases: ["AI", "芯片", "半导体", "CHIP"], trackingIndex: "中证芯片产业指数", components: ["芯片设计", "半导体设备", "材料", "封测"], industry: "半导体ETF" },
  "512480": { aliases: ["半导体", "芯片"], trackingIndex: "中证全指半导体产品与设备指数", components: ["芯片设计", "设备", "封测"], industry: "半导体ETF" },
  "515050": { aliases: ["5G", "通信", "通信ETF", "TXETF"], trackingIndex: "中证5G通信主题指数", components: ["通信设备", "光模块", "算力网络"], industry: "通信ETF" },
  "515980": { aliases: ["AI", "AIETF", "人工智能", "算力"], trackingIndex: "中证人工智能主题指数", components: ["算力", "软件", "光模块", "芯片"], industry: "AI主题ETF" },
  "159819": { aliases: ["AI", "AIETF", "人工智能", "算力"], trackingIndex: "中证人工智能主题指数", components: ["算力", "芯片", "应用软件"], industry: "AI主题ETF" },
  "588000": { aliases: ["科创", "科创50"], trackingIndex: "科创50指数", components: ["科创板核心公司"], industry: "科创ETF" },
  "510300": { aliases: ["沪深300", "300ETF"], trackingIndex: "沪深300指数", components: ["大盘蓝筹"], industry: "宽基ETF" },
  "510500": { aliases: ["中证500", "500ETF"], trackingIndex: "中证500指数", components: ["中盘成长"], industry: "宽基ETF" },
};

const knownStockAliases = [
  { code: "601088", name: "中国神华", pinyin: "ZGSH", shortName: "神华", industry: "煤炭", market: "沪市" },
  { code: "688008", name: "澜起科技", pinyin: "LQKJ", shortName: "澜起", industry: "半导体", market: "科创板" },
  { code: "688036", name: "传音控股", pinyin: "CYKG", shortName: "传音", industry: "消费电子", market: "科创板" },
];

export async function getSecurityUniverse({ force = false } = {}) {
  const dateKey = new Date().toISOString().slice(0, 10);
  if (!force && universeCache.dateKey === dateKey && universeCache.data.length) return universeCache;

  try {
    const [stocks, etfs] = await Promise.all([
      fetchPagedUniverse(STOCK_FS, MAX_STOCK_PAGES, "股票"),
      fetchPagedUniverse(ETF_FS, MAX_ETF_PAGES, "ETF"),
    ]);
    const data = dedupe([...stocks, ...etfs]).map(enrichSecurity);
    universeCache = {
      dateKey,
      updatedAt: nowText(),
      source: "东方财富证券列表",
      status: data.length ? "real" : "empty",
      message: data.length ? `已更新 ${data.length} 只证券` : "东方财富证券列表未返回数据",
      data,
    };
  } catch (error) {
    universeCache = {
      ...universeCache,
      updatedAt: nowText(),
      status: universeCache.data.length ? "stale" : "failed",
      message: error.message,
    };
  }
  return universeCache;
}

export async function searchSecurityUniverse(query, limit = 30) {
  const keyword = String(query ?? "").trim();
  const upper = keyword.toUpperCase();
  if (!universeCache.data.length) {
    void getSecurityUniverse().catch(() => {});
  }
  const cache = universeCache;
  const etfRows = buildKnownEtfRows();
  const source = dedupe([...knownStockAliases, ...cache.data, ...etfRows]);
  if (!keyword) return source.slice(0, limit);
  return source
    .filter((item) => item.code.includes(keyword)
      || String(item.name ?? "").includes(keyword)
      || String(item.shortName ?? "").includes(keyword)
      || String(item.pinyin ?? "").toUpperCase().includes(upper)
      || (item.aliases ?? []).some((alias) => String(alias).toUpperCase().includes(upper) || String(alias).includes(keyword))
      || String(item.industry ?? "").includes(keyword))
    .sort((a, b) => scoreSearchMatch(b, keyword, upper) - scoreSearchMatch(a, keyword, upper))
    .slice(0, limit);
}

export function getSecurityUniverseStatus() {
  return {
    status: universeCache.status,
    source: universeCache.source || "东方财富证券列表",
    updatedAt: universeCache.updatedAt,
    count: universeCache.data.length,
    message: universeCache.message,
  };
}

export function getEtfKnowledge(code) {
  return etfKnowledge[String(code)] ?? {};
}

async function fetchPagedUniverse(fs, maxPages, assetType) {
  const rows = [];
  let emptyPages = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      pn: String(page),
      pz: String(PAGE_SIZE),
      po: "1",
      np: "1",
      fltt: "2",
      invt: "2",
      fid: "f3",
      fs,
      fields: FIELDS,
    });
    let json;
    try {
      json = await fetchJson(`${eastmoneyListApi}?${params.toString()}`);
    } catch (error) {
      if (rows.length) {
        emptyPages += 1;
        if (emptyPages >= 3) break;
        continue;
      }
      throw error;
    }
    const pageRows = json?.data?.diff ?? [];
    if (!pageRows.length) {
      emptyPages += 1;
      if (emptyPages >= 2) break;
      continue;
    }
    emptyPages = 0;
    rows.push(...pageRows.map((row) => mapRow(row, assetType)));
    if (pageRows.length < PAGE_SIZE) break;
  }
  return rows;
}

function mapRow(row, assetType) {
  const code = String(row.f12 ?? "");
  return {
    code,
    name: row.f14 ?? code,
    assetType: assetType === "ETF" || isEtfCode(code) ? "ETF" : "股票",
    market: inferMarket(code, row.f13),
    industry: row.f100 || (isEtfCode(code) ? "ETF" : ""),
    price: row.f2,
    changePercent: row.f3,
    volume: row.f5,
    amount: row.f6,
    turnoverRate: row.f8,
    marketCap: row.f20,
    pe: row.f162,
    pb: row.f167,
    secid: `${row.f13}.${code}`,
    dataSource: "东方财富证券列表",
    updatedAt: nowText(),
  };
}

function enrichSecurity(item) {
  const etf = getEtfKnowledge(item.code);
  return {
    ...item,
    aliases: [...(item.aliases ?? []), ...(etf.aliases ?? [])],
    industry: etf.industry ?? item.industry,
    trackingIndex: etf.trackingIndex,
    components: etf.components,
    shortName: item.name,
    pinyin: item.pinyin ?? "",
  };
}

function buildKnownEtfRows() {
  return Object.entries(etfKnowledge).map(([code, info]) => ({
    code,
    name: info.name ?? knownEtfName(code),
    assetType: "ETF",
    market: inferMarket(code),
    industry: info.industry ?? "ETF",
    aliases: info.aliases ?? [],
    trackingIndex: info.trackingIndex,
    components: info.components ?? [],
    shortName: info.name ?? knownEtfName(code),
    pinyin: "",
    dataSource: "ETF基础资料",
    updatedAt: nowText(),
  }));
}

function knownEtfName(code) {
  const names = {
    "512760": "芯片ETF",
    "512480": "半导体ETF",
    "515050": "通信ETF",
    "515980": "人工智能ETF",
    "159819": "人工智能ETF",
    "588000": "科创50ETF",
    "510300": "沪深300ETF",
    "510500": "中证500ETF",
  };
  return names[code] ?? `${code}ETF`;
}

function scoreSearchMatch(item, keyword, upper) {
  const code = String(item.code ?? "");
  const name = String(item.name ?? "");
  const shortName = String(item.shortName ?? "");
  const pinyin = String(item.pinyin ?? "").toUpperCase();
  const aliases = (item.aliases ?? []).map((alias) => String(alias));
  let score = 0;
  if (code === keyword) score += 1000;
  else if (code.startsWith(keyword)) score += 650;
  else if (code.includes(keyword)) score += 300;
  if (name === keyword || shortName === keyword) score += 900;
  else if (name.startsWith(keyword) || shortName.startsWith(keyword)) score += 550;
  else if (name.includes(keyword) || shortName.includes(keyword)) score += 250;
  if (pinyin === upper) score += 850;
  else if (pinyin.startsWith(upper)) score += 500;
  else if (pinyin.includes(upper)) score += 180;
  for (const alias of aliases) {
    const aliasUpper = alias.toUpperCase();
    if (aliasUpper === upper || alias === keyword) score += 800;
    else if (aliasUpper.startsWith(upper) || alias.startsWith(keyword)) score += 450;
    else if (aliasUpper.includes(upper) || alias.includes(keyword)) score += 120;
  }
  if (item.assetType === "ETF" && /ETF$/i.test(upper)) score += 250;
  if (name.includes("指数") && !name.includes("ETF")) score -= 300;
  return score;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.code || seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
}

async function fetchJson(url) {
  const urls = [
    url,
    url.replace("https://push2.eastmoney.com", "https://push2his.eastmoney.com"),
    url.replace("https://push2.eastmoney.com", "http://push2.eastmoney.com"),
  ];
  let lastError;
  for (const target of [...new Set(urls)]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(target, {
        cache: "no-store",
        signal: controller.signal,
        headers: { Referer: "https://quote.eastmoney.com/" },
      });
      if (!response.ok) throw new Error(`东方财富证券列表 HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function inferMarket(code, marketId) {
  const text = String(code ?? "");
  if (isEtfCode(text)) return text.startsWith("5") ? "沪市ETF" : "深市ETF";
  if (text.startsWith("688") || text.startsWith("689")) return "科创板";
  if (text.startsWith("300") || text.startsWith("301")) return "创业板";
  if (String(marketId) === "1" || text.startsWith("6")) return "沪市";
  if (String(marketId) === "0" || text.startsWith("0") || text.startsWith("3")) return "深市";
  return "A股";
}

function isEtfCode(code) {
  return /^(?:5\d{5}|1[56]\d{4})$/.test(String(code ?? ""));
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
