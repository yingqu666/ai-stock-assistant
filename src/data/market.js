export const navItems = [
  { id: "dashboard", label: "首页" },
  { id: "market", label: "市场分析" },
  { id: "opportunities", label: "AI研究机会" },
  { id: "stock", label: "股票分析" },
  { id: "watchlist", label: "我的关注股票" },
  { id: "dailyReport", label: "AI日报" },
  { id: "reportCenter", label: "报告中心" },
  { id: "assistant", label: "AI助手" },
  { id: "portfolio", label: "投资组合" },
  { id: "review", label: "复盘分析" },
  { id: "riskDashboard", label: "风险看板" },
  { id: "industryResearch", label: "行业研究" },
  { id: "profile", label: "我的投资档案" },
  { id: "account", label: "我的账户" },
  { id: "team", label: "AI研究团队" },
  { id: "settings", label: "系统设置" },
];

export const strategy = {
  state: "震荡偏强",
  score: 72,
  position: "50%",
  risk: "中等",
  summary: "科技板块资金回流，但市场成交仍未显著放大，不建议追高。",
  drivers: ["科技成长方向活跃", "成交额温和放大", "高位题材波动加大"],
  action: "控制仓位，优先观察有业绩验证和资金承接的方向。",
};

export const marketOverview = [
  { label: "上证指数", value: "3,486.23", change: "+0.42%" },
  { label: "深证指数", value: "10,842.11", change: "+0.67%" },
  { label: "创业板指数", value: "2,176.45", change: "+1.08%" },
  { label: "成交额", value: "9,280亿", change: "+8.5%" },
  { label: "上涨数量", value: "3,126", change: "偏强" },
  { label: "下跌数量", value: "1,724", change: "可控" },
];

export const marketSentiment = {
  heat: 74,
  longShort: "多方略占优",
  upCount: 3126,
  downCount: 1724,
  riskLevel: "中等",
  summary: "市场情绪较昨日改善，但量能尚未达到强趋势状态，短线仍需关注追高风险。",
};

export const hotSectors = [
  {
    name: "AI算力",
    status: "强势延续",
    reason: "海外科技映射和服务器订单预期带动资金关注。",
    risk: "板块涨幅较大，业绩兑现前波动可能放大。",
  },
  {
    name: "半导体",
    status: "震荡走强",
    reason: "国产替代逻辑清晰，行业景气修复预期升温。",
    risk: "估值弹性较大，外部限制和订单节奏需跟踪。",
  },
  {
    name: "电力设备",
    status: "低位修复",
    reason: "估值处于低位，部分环节盈利预期改善。",
    risk: "行业价格竞争仍未完全缓和。",
  },
];

export const sectors = [
  { name: "半导体", heat: 92, flow: "+48亿", view: "景气修复与国产替代共振" },
  { name: "AI算力", heat: 89, flow: "+41亿", view: "海外科技映射增强" },
  { name: "机器人", heat: 78, flow: "+22亿", view: "政策和产业趋势推动" },
  { name: "新能源", heat: 63, flow: "-6亿", view: "估值低位但趋势仍需确认" },
];

export const news = [
  { type: "国内重要新闻", title: "多部门继续强调扩大内需与稳定资本市场预期。" },
  { type: "公司公告", title: "多家科技制造公司披露半年度业绩预告，业绩分化明显。" },
  { type: "行业消息", title: "AI算力、机器人、低空经济板块资金活跃度提升。" },
];

export const riskAlerts = [
  "指数反弹后短线获利盘可能增加。",
  "高位题材板块波动放大，不宜盲目追涨。",
  "个股公告、减持、业绩不及预期仍需重点跟踪。",
];

export const opportunities = [
  {
    name: "中芯国际",
    code: "688981",
    score: 85,
    reasons: ["半导体国产替代逻辑明确", "行业景气度有修复迹象", "科技主线资金关注度提升"],
    risks: ["估值弹性较大", "订单兑现需要持续观察", "外部限制可能扰动情绪"],
  },
  {
    name: "宁德时代",
    code: "300750",
    score: 82,
    reasons: ["动力电池龙头地位稳固", "储能业务提供第二增长曲线", "估值处于历史中低区间"],
    risks: ["价格竞争压制利润率", "海外政策变化不确定", "新能源板块整体趋势仍需确认"],
  },
  {
    name: "工业富联",
    code: "601138",
    score: 79,
    reasons: ["AI服务器产业链受益", "订单预期带动资金关注", "业绩验证方向清晰"],
    risks: ["短期涨幅较大", "估值受业绩节奏影响", "科技题材波动可能放大"],
  },
  {
    name: "迈瑞医疗",
    code: "300760",
    score: 76,
    reasons: ["医疗器械龙头基本面稳健", "海外业务保持扩张", "现金流和研发投入较好"],
    risks: ["医疗政策变化敏感", "板块弹性相对有限", "海外汇率和渠道变化需跟踪"],
  },
];

export const integrationPlan = [
  { name: "行情接口", sources: "东方财富、同花顺", status: "部分接入" },
  { name: "新闻公告", sources: "东方财富公告、东方财富快讯、巨潮资讯、财联社", status: "部分接入" },
  { name: "美股辅助", sources: "纳斯达克、标普500、科技板块", status: "预留" },
  { name: "AI分析", sources: "API模式可配置，fallback默认启用", status: "可配置" },
];
