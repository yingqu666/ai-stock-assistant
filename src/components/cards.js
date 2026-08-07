export function toneClass(value) {
  return String(value).startsWith("-") || Number(value) < 0 ? "negative" : "positive";
}

export function metricCard(item) {
  return `
    <article class="metric-card">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <em class="${toneClass(item.change)}">${item.change}</em>
    </article>`;
}

export function tagList(items, className = "") {
  return `<ul class="tag-list ${className}">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

export function opportunityCard(item) {
  return `
    <article class="data-card opportunity-card">
      <div class="card-head">
        <div>
          <span>股票</span>
          <strong>${item.name}</strong>
          <small>${item.code}</small>
        </div>
        <b>${item.score}分</b>
      </div>
      <div class="opportunity-body">
        <div>
          <h3>关注原因</h3>
          ${tagList(item.reasons)}
        </div>
        <div>
          <h3>风险</h3>
          ${tagList(item.risks, "risk-tags")}
        </div>
      </div>
      <p class="notice">这是研究机会，不是保证买入。</p>
    </article>`;
}

export function sectorCard(sector) {
  return `
    <article class="data-card sector-card">
      <div class="card-head"><strong>${sector.name}</strong><span>${sector.status}</span></div>
      <p><b>关注原因</b>${sector.reason}</p>
      <p><b>风险</b>${sector.risk}</p>
    </article>`;
}

export function watchStockCard(stock) {
  return `
    <article class="data-card watch-card">
      <div class="card-head">
        <div><strong>${stock.name}</strong><span>${stock.code}</span></div>
        <em class="${toneClass(stock.changePercent ?? stock.change)}">${stock.changePercent ?? stock.change}</em>
      </div>
      <div class="watch-price"><span>当前价格</span><strong>${stock.price}</strong></div>
      <div class="watch-meta">
        <p><b>今日涨跌</b>${stock.change ?? stock.changePercent}</p>
        <p><b>成交变化</b>${stock.amount ?? "模拟成交"}</p>
        <p><b>持有逻辑</b>${stock.holdingLogic}</p>
        <p><b>AI关注等级</b>${stock.aiLevel}</p>
        <p><b>最新新闻</b>${stock.latestNews}</p>
      </div>
    </article>`;
}

export function riskCard(text) {
  return `<article class="list-row risk"><b>风险</b><span>${text}</span></article>`;
}
