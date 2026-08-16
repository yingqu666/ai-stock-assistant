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
  const reasons = item.reasons ?? [];
  const risks = item.risks ?? [];
  const observation = item.priceObservation ?? {};
  return `
    <article class="data-card opportunity-card">
      <div class="card-head">
        <div>
          <span>股票</span>
          <strong>${item.name}</strong>
          <small>${item.code}</small>
        </div>
        <b>${item.currentJudgment ?? `${item.score ?? "--"}分`}</b>
      </div>
      <p><b>当前价格</b>${item.price ?? "数据源未返回"} · <b>涨跌幅</b>${item.changePercent ?? "数据源未返回"}</p>
      <p><b>入选原因</b>${reasons.slice(0, 4).join("；") || "数据不足，等待行情和新闻补充。"}</p>
      <p><b>当前判断</b>${item.currentJudgment ?? "等待机会"}。只作为观察池排序，不代表直接买入。</p>
      <details>
        <summary>展开详细原因、价格观察和风险</summary>
      <div class="opportunity-body">
        <div>
          <h3>入选原因</h3>
          ${tagList(reasons)}
        </div>
        <div>
          <h3>风险</h3>
          ${tagList(risks, "risk-tags")}
        </div>
      </div>
        <div class="opportunity-body">
          <div>
            <h3>价格观察</h3>
            ${tagList([
              `当前价格：${item.price ?? "数据不足"}`,
              `近期高点：${item.recentHigh ?? observation.recentHigh ?? "数据不足"}`,
              `近期低点：${item.recentLow ?? observation.recentLow ?? "数据不足"}`,
              `关注区域：${observation.watchRange ?? "数据不足"}`,
              `压力区域：${observation.pressureRange ?? "数据不足"}`,
              `风险区域：${observation.riskRange ?? "数据不足"}`,
            ])}
          </div>
          <div>
            <h3>观察逻辑</h3>
            <p>${observation.logic ?? "缺少价格、趋势或估值数据时不生成虚假区间。"}</p>
            <p><b>来源</b>${item.dataSource ?? "数据源未返回"} · ${item.updatedAt ?? "时间待更新"}</p>
          </div>
        </div>
      </details>
      <p class="notice">适合观察、等待价格确认；不满足条件时避免参与。</p>
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
