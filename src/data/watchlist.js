export const watchlist = [
  {
    name: "贵州茅台",
    code: "600519",
    price: "1,682.00",
    change: "+0.31%",
    holdingLogic: "高端白酒龙头，品牌壁垒和现金流质量较好，适合长期观察。",
    aiLevel: "稳健跟踪",
    aiStatus: "长期稳健观察",
    latestNews: "渠道价格保持平稳，旺季动销成为核心跟踪点。",
    risk: "消费复苏低于预期可能影响估值。",
    alerts: ["新闻变化：渠道价格稳定", "AI提醒：关注中秋旺季动销", "风险：消费预期波动"],
    tracking: [
      { date: "8月4日", event: "渠道价格保持平稳", analysis: "影响偏中性，继续观察旺季动销。" },
      { date: "8月3日", event: "消费板块成交回暖", analysis: "影响偏正面，但持续性仍需验证。" },
    ],
    risks: {
      shortTerm: "短线弹性有限，资金可能更偏向科技成长。",
      industry: "白酒行业受消费复苏节奏影响。",
      event: "关注渠道价格和旺季销售数据。",
    },
  },
  {
    name: "比亚迪",
    code: "002594",
    price: "248.60",
    change: "-0.84%",
    holdingLogic: "新能源车龙头，出口和技术平台具备长期竞争力。",
    aiLevel: "谨慎观察",
    aiStatus: "等待趋势企稳",
    latestNews: "新能源车价格竞争仍在延续，出口数据保持增长。",
    risk: "行业降价会压缩短期利润率。",
    alerts: ["新闻变化：出口数据增长", "AI提醒：等待价格战缓和", "风险：利润率承压"],
    tracking: [
      { date: "8月4日", event: "新能源车价格竞争延续", analysis: "影响偏负面，短期利润率承压。" },
      { date: "8月2日", event: "出口销量保持增长", analysis: "影响偏正面，海外业务提供支撑。" },
    ],
    risks: {
      shortTerm: "股价仍处震荡区间，趋势未完全确认。",
      industry: "新能源车行业价格竞争较激烈。",
      event: "关注月度销量和新车型订单。",
    },
  },
  {
    name: "中际旭创",
    code: "300308",
    price: "142.20",
    change: "+2.16%",
    holdingLogic: "高速光模块需求受 AI算力建设拉动，业绩弹性较高。",
    aiLevel: "重点跟踪",
    aiStatus: "趋势偏强跟踪",
    latestNews: "高速光模块订单预期继续受到市场关注。",
    risk: "涨幅较大，业绩验证前波动可能加剧。",
    alerts: ["今日异动：涨幅超过2%", "新闻变化：订单预期升温", "AI提醒：避免高位追涨"],
    tracking: [
      { date: "8月4日", event: "高速光模块订单预期升温", analysis: "影响偏正面，但短期涨幅较大。" },
      { date: "8月1日", event: "AI算力板块资金回流", analysis: "影响偏正面，趋势仍需成交配合。" },
    ],
    risks: {
      shortTerm: "短期涨幅较大，回撤波动可能上升。",
      industry: "AI硬件链条估值对订单兑现敏感。",
      event: "关注业绩预告和海外客户订单变化。",
    },
  },
];

export const account = {
  cash: 5000,
  total: 5286.5,
  profit: 286.5,
  positions: [
    { name: "工业富联", code: "601138", qty: 100, cost: 21.5, price: 23.1, buyFee: 1.08, sellFee: 0, stampTax: 0, otherFee: 0 },
    { name: "中芯国际", code: "688981", qty: 50, cost: 48.2, price: 50.9, buyFee: 1.21, sellFee: 0, stampTax: 0, otherFee: 0 },
  ],
};
