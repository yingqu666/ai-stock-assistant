export function analyzeRisks({ watchlist = [], newsEvents = [], marketData }) {
  const risks = [];

  watchlist.forEach((stock) => {
    const changePercent = parsePercent(stock.changePercent ?? stock.change);
    if (changePercent >= 8) {
      risks.push({
        type: "股票异常上涨",
        target: stock.name,
        level: "高",
        message: `${stock.name} 短期涨幅较大，注意追高和回撤风险。`,
      });
    }

    if (changePercent <= -5) {
      risks.push({
        type: "股票异常下跌",
        target: stock.name,
        level: "中高",
        message: `${stock.name} 跌幅较大，需要检查公告、新闻和行业变化。`,
      });
    }

    if (stock.amount && String(stock.amount).includes("亿")) {
      risks.push({
        type: "成交量异常",
        target: stock.name,
        level: "中",
        message: `${stock.name} 成交额变化明显，关注资金持续性。`,
      });
    }
  });

  newsEvents.forEach((item) => {
    if (item.impact === "利空") {
      risks.push({
        type: "新闻利空",
        target: item.relatedStock,
        level: "高",
        message: `${item.title}，影响对象：${item.target}。`,
      });
    }
  });

  if (marketData?.marketSentiment?.riskLevel === "偏高") {
    risks.push({
      type: "市场风险",
      target: "A股",
      level: "高",
      message: "市场情绪偏弱，建议降低追涨频率。",
    });
  }

  return risks.length ? risks : [{
    type: "综合风险",
    target: "A股",
    level: "中",
    message: "暂无极端风险信号，但仍需关注高位回撤和新闻事件变化。",
  }];
}

function parsePercent(value) {
  const number = Number(String(value ?? "0").replace("%", ""));
  return Number.isFinite(number) ? number : 0;
}
