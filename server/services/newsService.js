const noticeApi = "https://np-anotice-stock.eastmoney.com/api/security/ann";
const fastNewsApi = "https://np-listapi.eastmoney.com/comm/web/getFastNews";
const trackedStocks = ["600176", "600519", "300750", "301396", "688981", "512760", "515050", "515980"];
const trackedStockIndustries = {
  "600176": ["玻璃纤维", "新材料"],
  "600519": ["白酒", "消费"],
  "300750": ["电池", "新能源"],
  "301396": ["软件服务", "AI应用"],
  "688981": ["半导体", "国产替代"],
  "512760": ["芯片ETF", "半导体"],
  "515050": ["通信ETF", "通信"],
  "515980": ["人工智能ETF", "AI算力"],
};

export const newsProviders = [
  { key: "eastmoney_notice", name: "东方财富公告", enabled: true, type: "公告" },
  { key: "eastmoney_fast", name: "东方财富快讯", enabled: true, type: "财经新闻" },
  { key: "cninfo", name: "巨潮资讯", enabled: false, type: "公告/财报接口预留" },
  { key: "cls", name: "财联社", enabled: false, type: "市场新闻接口预留" },
];

export async function collectNewsSnapshot() {
  const startedAt = formatNow();
  const diagnostics = [];
  const [announcements, fastNews] = await Promise.all([
    fetchAnnouncements(trackedStocks).catch((error) => {
      diagnostics.push(buildNewsDiagnostic("东方财富公告", error));
      return [];
    }),
    fetchFastNews().catch((error) => {
      diagnostics.push(buildNewsDiagnostic("东方财富快讯", error));
      return [];
    }),
  ]);
  const rows = dedupeNews([...announcements, ...fastNews]).map(enrichNewsAnalysis);
  return {
    news: rows.filter((item) => item.newsType !== "个股公告").slice(0, 12),
    stockNews: rows,
    riskAlerts: [],
    updatedAt: startedAt,
    source: buildNewsSource(announcements, fastNews),
    dataStatus: rows.length ? (announcements.length && fastNews.length ? "真实数据" : "部分真实") : "数据不足",
    providers: newsProviders,
    diagnostics,
  };
}

async function fetchAnnouncements(codes) {
  const url = `${noticeApi}?sr=-1&page_size=16&page_index=1&ann_type=A&client_source=web&stock_list=${codes.join(",")}`;
  const json = await fetchJson(url, "东方财富公告");
  const rows = json?.data?.list ?? [];
  return rows.map(normalizeAnnouncement);
}

async function fetchFastNews() {
  const url = `${fastNewsApi}?client=web&biz=web_724&fastColumn=102&sortEnd=0&pageSize=24&req_trace=${Date.now()}`;
  const json = await fetchJson(url, "东方财富快讯");
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(normalizeFastNews);
}

function normalizeAnnouncement(item = {}) {
  const firstCode = item.codes?.[0];
  const title = item.title ?? "公司公告";
  const analysis = analyzeNewsImpact(title);
  const relatedStock = firstCode?.stock_code ?? "A股";
  const stockIndustries = (item.codes ?? []).flatMap((code) => trackedStockIndustries[code.stock_code] ?? []);
  const relatedIndustries = [...new Set([...stockIndustries, ...analysis.sectors])];
  return {
    title,
    source: "东方财富公告",
    time: item.notice_date?.slice(0, 16) ?? formatNow(),
    link: item.art_code ? `https://data.eastmoney.com/notices/detail/${relatedStock}/${item.art_code}.html` : "",
    relatedStock,
    relatedStocks: (item.codes ?? []).map((code) => code.stock_code).filter(Boolean),
    relatedIndustry: relatedIndustries[0] ?? analysis.primarySector,
    relatedIndustries,
    category: "个股公告",
    newsType: "个股公告",
    detailType: classifyAnnouncement(title),
    impact: analysis.direction,
    direction: analysis.direction,
    target: "个股",
    summary: title,
    credibility: { level: analysis.credibility, reason: "公告标题规则分类，需结合正文复核" },
  };
}

function normalizeFastNews(item = {}) {
  const title = item.title ?? "财经新闻";
  const analysis = analyzeNewsImpact(title);
  return {
    title,
    source: item.mediaName ?? "东方财富快讯",
    time: item.showTime ?? formatNow(),
    link: item.url ?? item.shareUrl ?? "",
    relatedStock: "市场",
    relatedStocks: analysis.stocks,
    relatedIndustry: analysis.primarySector,
    relatedIndustries: analysis.sectors,
    category: classifyMarketNews(title),
    newsType: classifyNewsType(title),
    impact: analysis.direction,
    direction: analysis.direction,
    target: analysis.primarySector === "市场" ? "市场" : "行业",
    summary: normalizeSummary(item.summary ?? item.digest ?? item.content ?? title),
    credibility: { level: "中", reason: "快讯来源，需等待公告或权威报道验证" },
  };
}

function enrichNewsAnalysis(item = {}) {
  const impact = normalizeImpact(item.impact ?? item.direction ?? item.category);
  const sectors = [...new Set([...(item.relatedIndustries ?? []), item.relatedIndustry].filter(Boolean))].slice(0, 5);
  const stocks = [...new Set([...(item.relatedStocks ?? []), item.relatedStock].filter((value) => value && !["A股", "市场"].includes(value)))].slice(0, 8);
  const factSummary = buildFactSummary(item);
  const aiInterpretation = {
    factSummary,
    shortTermImpact: buildShortTermImpact(item, impact, sectors),
    longTermImpact: buildLongTermImpact(item, impact, sectors),
    riskWarning: buildNewsRiskWarning(item, impact, sectors),
  };
  return {
    ...item,
    impact,
    direction: impact,
    relatedIndustries: sectors,
    relatedIndustry: sectors[0] ?? "市场",
    relatedStocks: stocks,
    aiSummary: aiInterpretation.factSummary,
    factSummary: aiInterpretation.factSummary,
    shortTermImpact: aiInterpretation.shortTermImpact,
    longTermImpact: aiInterpretation.longTermImpact,
    riskWarning: aiInterpretation.riskWarning,
    aiInterpretation,
  };
}

function analyzeNewsImpact(title = "") {
  const text = String(title);
  const positiveWords = ["增长", "中标", "回购", "增持", "盈利", "突破", "利好", "需求", "上调", "扩产", "订单", "景气"];
  const negativeWords = ["减持", "亏损", "下滑", "处罚", "风险", "终止", "诉讼", "退市", "下降", "暴跌", "警示"];
  const sectors = inferRelatedIndustries(text);
  const stocks = inferRelatedStocks(text);
  const direction = positiveWords.some((word) => text.includes(word))
    ? "利好"
    : negativeWords.some((word) => text.includes(word))
      ? "利空"
      : "中性";
  return {
    direction,
    primarySector: sectors[0] ?? "市场",
    sectors: sectors.length ? sectors : ["市场"],
    stocks,
    credibility: "中",
  };
}

function classifyAnnouncement(title = "") {
  if (/财报|年度报告|季度报告|半年报|业绩|预告/.test(title)) return "财报";
  if (/股东|减持|增持/.test(title)) return "股东变化";
  if (/回购/.test(title)) return "回购";
  if (/重大|停牌|收购|重组|合同|中标/.test(title)) return "重大事项";
  return "公司公告";
}

function classifyMarketNews(title = "") {
  if (/政策|国务院|证监会|发改委|工信部|央行/.test(title)) return "政策新闻";
  if (/行业|产业|需求|订单|服务器|芯片|算力|半导体|光模块|储能|电力|机器人/.test(title)) return "行业新闻";
  return "市场热点";
}

function classifyNewsType(title = "") {
  if (/公告|财报|业绩|回购|增持|减持/.test(title)) return "个股公告";
  if (/行业|产业|需求|订单|服务器|芯片|算力|半导体|光模块|储能|电力|AI|人工智能|机器人/.test(title)) return "行业新闻";
  if (/政策|国务院|证监会|发改委|工信部|央行/.test(title)) return "政策新闻";
  return "市场新闻";
}

function inferRelatedIndustries(text = "") {
  const sectors = [];
  if (/AI|人工智能|算力|服务器|大模型/.test(text)) sectors.push("AI算力");
  if (/光模块|光通信|CPO/.test(text)) sectors.push("光模块");
  if (/半导体|芯片|晶圆|光刻机/.test(text)) sectors.push("半导体");
  if (/机器人|人形机器人/.test(text)) sectors.push("机器人");
  if (/新能源|光伏|储能|电力|电网/.test(text)) sectors.push("电力储能");
  if (/煤炭|有色|稀土|铜|铝|资源/.test(text)) sectors.push("资源");
  if (/消费|白酒|食品/.test(text)) sectors.push("消费");
  if (/医药|创新药|医疗/.test(text)) sectors.push("医药");
  return [...new Set(sectors)];
}

function inferRelatedStocks(text = "") {
  const pairs = [
    ["中芯国际", "688981"],
    ["宁德时代", "300750"],
    ["贵州茅台", "600519"],
    ["中国巨石", "600176"],
    ["中国神华", "601088"],
    ["宏景科技", "301396"],
    ["芯片ETF", "512760"],
    ["人工智能ETF", "515980"],
    ["通信ETF", "515050"],
  ];
  return pairs.filter(([name]) => text.includes(name)).map(([, code]) => code);
}

async function fetchJson(url, source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Referer: "https://www.eastmoney.com/",
        Accept: "application/json,text/plain,*/*",
      },
    });
    if (!response.ok) throw new Error(`${source} HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`${source} timeout`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildFactSummary(item = {}) {
  const text = normalizeSummary(item.summary ?? item.content ?? item.title ?? "新闻摘要未返回");
  return limitText(text, 120);
}

function buildShortTermImpact(item = {}, impact = "中性", sectors = []) {
  const target = sectors.join("、") || item.relatedIndustry || "相关方向";
  if (impact === "利好") return limitText(`${target}短期关注度可能提升，但需要观察板块涨幅、成交额和龙头股反馈是否同步放大。`, 100);
  if (impact === "利空") return limitText(`${target}短期可能承压，若资金流出和跌幅扩大，需要降低追高参与意愿。`, 100);
  return limitText(`${target}短期影响偏信息补充，单条新闻不足以形成方向判断，需要结合行情和后续公告。`, 100);
}

function buildLongTermImpact(item = {}, impact = "中性", sectors = []) {
  const target = sectors.join("、") || item.relatedIndustry || "相关方向";
  if (impact === "利好") return limitText(`中长期要看${target}能否转化为订单、利润率、现金流或产业趋势持续改善。`, 100);
  if (impact === "利空") return limitText(`中长期要观察${target}盈利预期、估值中枢或政策环境是否被实质削弱。`, 100);
  return limitText(`中长期影响仍需等待财报、公告和产业数据验证，不应单独放大新闻权重。`, 100);
}

function buildNewsRiskWarning(item = {}, impact = "中性", sectors = []) {
  const target = sectors.join("、") || item.relatedIndustry || "相关方向";
  if (impact === "利好") return `${target}若已经大幅上涨，需防止利好兑现后的回落。`;
  if (impact === "利空") return `${target}若叠加成交萎缩或资金流出，短期风险会扩大。`;
  return `${target}需要等待更多数据确认，避免把中性新闻解读成确定性机会。`;
}

function normalizeImpact(value = "") {
  const text = String(value);
  if (/利好|正面|上涨|提振|增长|受益/.test(text)) return "利好";
  if (/利空|负面|下跌|承压|下降|风险/.test(text)) return "利空";
  return "中性";
}

function normalizeSummary(value = "") {
  return String(value).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function dedupeNews(rows = []) {
  const seen = new Set();
  return rows.filter((item) => {
    const key = item?.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildNewsSource(announcements = [], fastNews = []) {
  const sources = [];
  if (announcements.length) sources.push("东方财富公告");
  if (fastNews.length) sources.push("东方财富快讯");
  return sources.length ? sources.join(" + ") : "新闻接口未返回";
}

function buildNewsDiagnostic(source, error) {
  return {
    source,
    status: "failed",
    error: error?.message ?? "unknown error",
    time: formatNow(),
  };
}

function limitText(text = "", max = 100) {
  const value = String(text).trim();
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function formatNow() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
