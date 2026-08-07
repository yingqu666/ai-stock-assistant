const eastmoneyApi = "https://push2.eastmoney.com/api/qt";
const indexSecids = "1.000001,0.399001,0.399006";
const boardFs = "m:90+t:2";
const requestTimeoutMs = 5000;

export async function collectReportSourceData({
  type,
  watchlist = [],
  portfolio = [],
  investmentProfile = {},
  historyReports = [],
  aiHistory = [],
  knowledge = [],
  journal = [],
} = {}) {
  const [marketData, newsData] = await Promise.all([
    collectMarketData().catch((error) => fallbackMarketData(error)),
    collectNewsData().catch(() => []),
  ]);

  return {
    type,
    generatedBy: "server-scheduler",
    generatedAt: new Date().toISOString(),
    marketData,
    newsData,
    stockData: {},
    watchlist,
    portfolio,
    investmentProfile,
    historyReports,
    aiHistory,
    knowledge,
    investmentJournal: journal,
    userProfileSignals: buildUserProfileSignals({ investmentProfile, journal, aiHistory }),
  };
}

export async function collectMarketData() {
  const [indexes, boards] = await Promise.all([fetchIndexes(), fetchHotBoards()]);
  const upCount = 0;
  const downCount = 0;
  const averageChange = indexes.length ? indexes.reduce((sum, item) => sum + item.changePercent, 0) / indexes.length : 0;
  const turnover = indexes.reduce((sum, item) => sum + item.turnover, 0);

  return {
    source: "东方财富",
    status: "真实",
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    marketOverview: [
      ...indexes.map((item) => ({ label: item.name, value: formatNumber(item.price), change: formatPercent(item.changePercent) })),
      { label: "成交额", value: formatAmount(turnover), change: "指数合计" },
      { label: "上涨家数", value: String(upCount), change: "待接全市场宽度" },
      { label: "下跌家数", value: String(downCount), change: "待接全市场宽度" },
    ],
    marketSentiment: {
      summary: `三大指数平均涨跌幅 ${formatPercent(averageChange)}，成交额约 ${formatAmount(turnover)}。`,
      upCount,
      downCount,
      riskLevel: averageChange >= 0 ? "中" : "偏高",
    },
    hotSectors: boards.slice(0, 6).map((item) => ({
      name: item.name,
      status: item.changePercent >= 0 ? "活跃" : "调整",
      flow: formatPercent(item.changePercent),
      reason: "东方财富板块涨幅靠前",
      risk: "热点轮动较快，需要结合成交延续性观察。",
    })),
  };
}

async function collectNewsData() {
  return [
    {
      title: "自动任务新闻采集占位：后续接入财联社、公告源和政策新闻",
      source: "system",
      category: "系统",
      impact: "中性",
      time: new Date().toISOString(),
    },
  ];
}

async function fetchIndexes() {
  const url = `${eastmoneyApi}/ulist.np/get?fltt=2&fields=f12,f14,f2,f3,f6&secids=${indexSecids}`;
  const rows = await fetchRows(url);
  return rows.map((row) => ({ code: row.f12, name: row.f14, price: toNumber(row.f2), changePercent: toNumber(row.f3), turnover: toNumber(row.f6) }));
}

async function fetchHotBoards() {
  const url = `${eastmoneyApi}/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(boardFs)}&fields=f14,f3`;
  const rows = await fetchRows(url);
  return rows.map((row) => ({ name: row.f14, changePercent: toNumber(row.f3) }));
}

async function fetchRows(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return json?.data?.diff ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackMarketData(error) {
  return {
    source: "fallback",
    status: "回退",
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    marketOverview: [],
    marketSentiment: {
      summary: `真实行情采集失败：${error.message}`,
      upCount: 0,
      downCount: 0,
      riskLevel: "未知",
    },
    hotSectors: [],
  };
}

function buildUserProfileSignals({ investmentProfile, journal, aiHistory }) {
  return {
    riskLevel: investmentProfile?.riskLevel ?? "中",
    focusIndustries: investmentProfile?.industries ?? [],
    journalCount: journal.length,
    aiHistoryCount: aiHistory.length,
    recentReasons: journal.slice(0, 5).map((item) => item.reason).filter(Boolean),
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return toNumber(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
  const number = toNumber(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatAmount(value) {
  const number = toNumber(value);
  if (number >= 1_0000_0000_0000) return `${(number / 1_0000_0000_0000).toFixed(2)}万亿`;
  if (number >= 1_0000_0000) return `${(number / 1_0000_0000).toFixed(2)}亿`;
  return `${Math.round(number / 10000)}万`;
}
