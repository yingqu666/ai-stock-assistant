export const dailyReport = {
  morning: {
    date: "2026年8月4日",
    score: 72,
    marketState: "震荡偏强",
    strategy: "建议仓位 50%，优先观察科技成长和低位修复方向。",
    focus: ["AI算力", "半导体", "机器人", "电力设备"],
    risks: ["高位题材追涨风险", "成交额不足导致反弹持续性不强", "业绩预告不及预期风险"],
  },
  close: {
    performance: "主要指数震荡收涨，创业板相对更强。",
    breadth: "上涨 3126 家，下跌 1724 家，赚钱效应中等偏强。",
    hotSectors: ["AI算力", "半导体", "机器人"],
    events: ["科技制造公司业绩预告分化", "政策继续强调稳定资本市场预期", "AI硬件链条成交活跃"],
    summary: "市场情绪改善，但成交额仍未形成强趋势确认。明日重点观察科技主线是否继续放量，以及低位板块是否出现轮动承接。",
    nextFocus: ["科技主线成交量", "自选股公告变化", "高位板块回撤风险"],
  },
  history: [
    {
      date: "2026年8月4日",
      type: "收盘复盘",
      title: "科技方向带动情绪修复",
      score: 72,
      marketSummary: "指数震荡收涨，科技成长带动市场情绪改善，但成交额仍需进一步放大。",
      hotAnalysis: "AI算力、半导体和机器人方向资金活跃，低位电力设备出现修复。",
      risks: ["高位题材回撤", "成交额不足", "业绩预告分化"],
      nextStrategy: "明日观察科技主线成交延续性，仓位维持中性，不追高。",
    },
    {
      date: "2026年8月3日",
      type: "早盘分析",
      title: "关注海外科技映射和政策新闻",
      score: 68,
      marketSummary: "开盘前情绪中性偏强，海外科技股表现对A股科技方向有一定映射。",
      hotAnalysis: "重点观察AI硬件、半导体和国产软件。",
      risks: ["外盘波动传导", "政策预期落空", "热点切换过快"],
      nextStrategy: "先观察开盘量能，优先选择有业绩支撑的方向。",
    },
    {
      date: "2026年8月2日",
      type: "收盘复盘",
      title: "指数缩量震荡，等待主线确认",
      score: 61,
      marketSummary: "指数缩量震荡，市场缺少持续主线，短线资金偏谨慎。",
      hotAnalysis: "机器人和低空经济有局部活跃，但持续性一般。",
      risks: ["缩量反弹失败", "题材轮动过快", "个股业绩风险"],
      nextStrategy: "等待成交量放大和主线确认，降低追涨频率。",
    },
  ],
};

export const dailyReports = dailyReport.history;
