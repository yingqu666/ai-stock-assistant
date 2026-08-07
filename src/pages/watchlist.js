import { riskCard, watchStockCard } from "../components/cards.js";
import { timelineList } from "../components/lists.js";
import { getWatchlistData, selectStockByCode } from "../services/mockService.js";
import { addSyncedStock, getSyncedWatchlist, removeSyncedStock } from "../services/watchlistSyncService.js";

const sortKey = "ai-investment-watchlist-sort";

function portfolioRow(stock) {
  return `
    <article class="data-card portfolio-row ${stock.isRisk ? "risk-row" : ""}">
      <div>
        <strong>${stock.name}</strong>
        <small>${stock.code} · 添加时间：${stock.addedAt}</small>
        <p>${stock.reason}</p>
        <p><b>今日涨跌：</b>${stock.changePercent ?? "暂无"} · <b>风险：</b>${stock.riskText ?? "常规跟踪"}</p>
      </div>
      <span>${stock.aiLevel}</span>
      <div class="row-actions">
        <button class="secondary-button" data-view-stock="${stock.code}" type="button">查看详情</button>
        <button class="danger-button" data-remove-stock="${stock.id ?? stock.code}" type="button">删除</button>
      </div>
    </article>`;
}

export async function renderWatchlist() {
  const [{ watchlist, stockNews, aiHistory, accuracyStats, riskSignals }, synced] = await Promise.all([
    getWatchlistData(),
    getSyncedWatchlist(),
  ]);
  const syncStatus = synced.syncStatus;
  const sortMode = getSortMode();
  const enrichedItems = sortStocks(enrichStocks(synced.items, watchlist, riskSignals), sortMode);

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>我的关注股票</h2>
          <span>云端优先同步，失败时自动使用本地缓存</span>
        </div>
        <span class="notice">${syncStatus.status} · ${syncStatus.lastSyncAt} · ${syncStatus.source ?? "云端/本地"}</span>
      </div>
      <form class="stock-search add-stock-form">
        <input name="stockQuery" placeholder="输入 600519 / 贵州茅台 / 宏景科技" />
        <button type="submit">添加关注</button>
      </form>
      <div class="driver-strip sort-strip">
        ${[
          ["risk", "风险置顶"],
          ["ai", "AI等级"],
          ["changeDesc", "涨幅优先"],
          ["changeAsc", "跌幅优先"],
          ["time", "添加时间"],
        ].map(([key, label]) => `<button class="secondary-button ${sortMode === key ? "active-sort" : ""}" data-sort="${key}" type="button">${label}</button>`).join("")}
      </div>
      <p id="portfolio-message" class="form-message">${syncStatus.message ?? ""}</p>
      <div class="portfolio-list">${enrichedItems.map(portfolioRow).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>股票详情卡</h2><span>来源：东方财富/stockService · 更新时间：${watchlist[0]?.updatedAt ?? "暂无"} · 状态：真实/部分回退</span></div>
      <div class="watch-grid">${watchlist.map(watchStockCard).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>最新新闻提醒</h2><span>来源：公告/新闻服务 · 状态：真实/部分回退/mock</span></div>
      <div class="card-grid">
        ${stockNews.slice(0, 4).map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.category}</strong><span>${item.impact}</span></div>
            <p>${item.title}</p>
            <small>${item.relatedStock} · ${item.source} · ${item.time}</small>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>异动提醒</h2><span>价格变化、成交变化、AI提醒</span></div>
      <div class="detail-grid">
        ${watchlist.map((stock) => `
          <article class="data-card">
            <div class="card-head"><strong>${stock.name}</strong><span>${stock.changePercent ?? stock.change}</span></div>
            ${timelineList(stock.tracking)}
          </article>
        `).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI历史判断</h2><span>用于未来统计AI判断准确率</span></div>
      <div class="metrics">
        ${[
          { label: "统计样本", value: `${accuracyStats.sampleSize}次`, change: "历史" },
          { label: "市场判断正确", value: `${accuracyStats.marketAccuracy}%`, change: "复盘" },
          { label: "风险提醒有效", value: `${accuracyStats.riskAccuracy}%`, change: "复盘" },
        ].map((item) => `<article class="metric-card"><span>${item.label}</span><strong>${item.value}</strong><em>${item.change}</em></article>`).join("")}
      </div>
      <div class="detail-grid">
        ${aiHistory.map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.date}</strong><span>${item.actualResult?.marketMove ?? "待记录"}</span></div>
            <p><b>市场判断：</b>${item.prediction?.marketDirection}</p>
            <p><b>热点板块：</b>${item.prediction?.sectors.join("、")}</p>
            <p><b>风险：</b>${item.prediction?.risks.join("、")}</p>
            <p><b>实际结果：</b>${item.actualResult?.sectorPerformance ?? "待记录"}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>风险提醒</h2><span>短期、行业、事件风险</span></div>
      <div class="detail-grid">
        ${riskSignals.map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.type}</strong><span>${item.level}</span></div>
            <p>${item.message}</p>
            <small>${item.target}</small>
          </article>
        `).join("")}
        ${watchlist.map((stock) => `
          <article class="data-card">
            <div class="card-head"><strong>${stock.name}</strong><span>${stock.code}</span></div>
            ${riskCard(`短期风险：${stock.risks.shortTerm}`)}
            ${riskCard(`行业风险：${stock.risks.industry}`)}
            ${riskCard(`事件风险：${stock.risks.event}`)}
          </article>
        `).join("")}
      </div>
    </section>`;
}

export function mountWatchlist({ navigate, rerender }) {
  const form = document.querySelector(".add-stock-form");
  const message = document.querySelector("#portfolio-message");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    if (message) message.textContent = "正在同步到云端...";
    const result = await addSyncedStock(formData.get("stockQuery"));
    if (!result.ok && message) message.textContent = result.message;
    if (result.ok) rerender();
  });

  document.querySelectorAll("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      window.localStorage.setItem(sortKey, button.dataset.sort);
      rerender();
    });
  });

  document.querySelectorAll("[data-remove-stock]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removeSyncedStock(button.dataset.removeStock);
      rerender();
    });
  });

  document.querySelectorAll("[data-view-stock]").forEach((button) => {
    button.addEventListener("click", () => {
      selectStockByCode(button.dataset.viewStock);
      navigate("stock");
    });
  });
}

function getSortMode() {
  return window.localStorage.getItem(sortKey) ?? "risk";
}

function enrichStocks(items, watchlist, riskSignals) {
  return items.map((item) => {
    const detail = watchlist.find((stock) => stock.code === item.code);
    const risk = riskSignals.find((signal) => signal.target === item.name || signal.target === item.code);
    return {
      ...item,
      changePercent: detail?.changePercent ?? detail?.change ?? "暂无",
      changeValue: parseChange(detail?.changePercent ?? detail?.change),
      isRisk: Boolean(risk) || String(item.aiLevel).includes("风险"),
      riskText: risk?.message,
      aiScore: aiLevelScore(item.aiLevel),
    };
  });
}

function sortStocks(items, mode) {
  const sorted = [...items];
  if (mode === "ai") return sorted.sort((a, b) => b.aiScore - a.aiScore);
  if (mode === "changeDesc") return sorted.sort((a, b) => b.changeValue - a.changeValue);
  if (mode === "changeAsc") return sorted.sort((a, b) => a.changeValue - b.changeValue);
  if (mode === "time") return sorted.sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
  return sorted.sort((a, b) => Number(b.isRisk) - Number(a.isRisk) || b.aiScore - a.aiScore);
}

function parseChange(value) {
  const number = Number(String(value ?? "").replace("%", "").replace("+", ""));
  return Number.isFinite(number) ? number : 0;
}

function aiLevelScore(level) {
  const text = String(level ?? "");
  if (text.includes("重点")) return 3;
  if (text.includes("观察")) return 2;
  if (text.includes("风险")) return 1;
  return 0;
}
