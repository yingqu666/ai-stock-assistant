import { metricCard, riskCard } from "../components/cards.js";
import { timelineList } from "../components/lists.js";
import { getWatchlistData, selectStockByCode } from "../services/mockService.js";
import {
  addSyncedStock,
  createWatchlistGroup,
  deleteWatchlistGroup,
  getSyncedWatchlist,
  moveSyncedStockToGroup,
  removeSyncedStock,
  renameWatchlistGroup,
} from "../services/watchlistSyncService.js";

const sortKey = "ai-investment-watchlist-sort";

function portfolioRow(stock, groups) {
  return `
    <article class="data-card portfolio-row ${stock.isRisk ? "risk-row" : ""}">
      <div>
        <strong>${stock.name}</strong>
        <small>${stock.code} · ${stock.assetType ?? "股票"} · ${stock.groupName ?? "长期观察"} · ${stock.industry ?? "行业待补充"}</small>
        <p>${stock.reason || "已加入长期观察，等待行情、新闻和公告继续验证。"}</p>
        <p><b>价格：</b>${stock.price ?? "暂无"} · <b>涨跌幅：</b>${stock.changePercent ?? "暂无"} · <b>AI判断：</b>${stock.currentJudgment ?? stock.aiRating ?? stock.aiLevel ?? "观察"} · <b>风险：</b>${stock.riskLevel ?? stock.riskText ?? firstRisk(stock)}</p>
        <p><b>判断变化：</b>${stock.aiChange ?? "暂无明显变化，继续跟踪行情、新闻和公告。"}</p>
        <p><b>最新新闻影响：</b>${stock.newsImpact ?? stock.latestNews ?? "暂无强相关新闻，继续观察公告和行情变化。"}</p>
        <p><b>热点关联：</b>${stock.hotSectorRelation ?? "暂未匹配到强热点板块。"}</p>
      </div>
      <span>${stock.aiLevel}</span>
      <div class="row-actions">
        <select data-move-stock="${stock.id ?? stock.code}">
          ${groups.map((group) => `<option value="${group.name}" ${group.name === stock.groupName ? "selected" : ""}>${group.name}</option>`).join("")}
        </select>
        <button class="secondary-button" data-view-stock="${stock.code}" type="button">查看详情</button>
        <button class="danger-button" data-remove-stock="${stock.id ?? stock.code}" type="button">删除</button>
      </div>
    </article>`;
}

function stockDetailCard(stock) {
  return `
    <article class="data-card watch-card">
      <div class="card-head">
        <div><strong>${stock.name}</strong><span>${stock.code} · ${stock.assetType ?? "股票"}</span></div>
        <em class="${toneClass(stock.changePercent)}">${stock.changePercent ?? "暂无"}</em>
      </div>
      <div class="watch-price"><span>当前价格</span><strong>${stock.price ?? "暂无"}</strong></div>
      <div class="watch-meta">
        <p><b>行业</b>${stock.industry ?? "待补充"}</p>
        <p><b>成交额</b>${stock.amount ?? "暂无"}</p>
        <p><b>换手率</b>${stock.turnoverRate ?? "暂无"}</p>
        <p><b>AI评级</b>${stock.aiRating ?? stock.aiLevel ?? "观察"}</p>
        <p><b>AI当前判断变化</b>${stock.aiChange ?? "暂无明显变化"}</p>
        <p><b>风险等级</b>${stock.riskLevel ?? "中"}</p>
        <p><b>热点板块关联</b>${stock.hotSectorRelation ?? "暂未匹配到强热点板块。"}</p>
        <p><b>AI观点</b>${stock.aiOpinion ?? "等待AI结合行情、新闻和公告继续更新。"}</p>
        <p><b>最近新闻影响</b>${stock.newsImpact ?? stock.latestNews ?? "暂无强相关新闻。"}</p>
        <p><b>数据来源</b>${stock.dataSource ?? "云端/本地"} · ${stock.dataStatus ?? "部分真实"}</p>
      </div>
    </article>`;
}

export async function renderWatchlist() {
  const syncedPromise = getSyncedWatchlist();
  const dataPromise = syncedPromise.then((syncedWatchlist) => getWatchlistData(syncedWatchlist));
  const [{ stockNews, aiHistory, accuracyStats, riskSignals }, synced] = await Promise.all([dataPromise, syncedPromise]);
  const syncStatus = synced.syncStatus;
  const groups = synced.groups ?? [];
  const sortMode = getSortMode();
  const enrichedItems = sortStocks(enrichStocks(synced.items, riskSignals, stockNews), sortMode);
  const byGroup = groups.map((group) => ({ ...group, stocks: enrichedItems.filter((stock) => (stock.groupName ?? "长期观察") === group.name) }));

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>我的关注股票</h2>
          <span>支持股票和ETF，按代码、名称、简称或拼音搜索添加；支持分组、移动和删除</span>
        </div>
        <span class="notice">${syncStatus.status} · ${syncStatus.lastSyncAt} · ${syncStatus.source ?? "云端/本地"}</span>
      </div>
      <form class="stock-search add-stock-form">
        <input name="stockQuery" placeholder="输入 600176 / 512760 / AI / 贵州茅台" />
        <select name="groupName">${groups.map((group) => `<option value="${group.name}">${group.name}</option>`).join("")}</select>
        <button type="submit">添加关注</button>
      </form>
      <form class="stock-search group-form compact">
        <input name="groupName" placeholder="新分组名称" />
        <button type="submit">创建分组</button>
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
      <div class="detail-grid">
        ${groups.map((group) => `
          <article class="data-card">
            <div class="card-head"><strong>${group.name}</strong><span>${byGroup.find((item) => item.name === group.name)?.stocks.length ?? 0}只</span></div>
            <div class="row-actions">
              <button class="secondary-button" data-rename-group="${group.name}" type="button">改名</button>
              <button class="danger-button" data-delete-group="${group.name}" type="button">删除分组</button>
            </div>
          </article>
        `).join("")}
      </div>
      ${byGroup.map((group) => `
        <div class="section-head compact"><h2>${group.name}</h2><span>${group.stocks.length} 只标的</span></div>
        <div class="portfolio-list">${group.stocks.map((stock) => portfolioRow(stock, groups)).join("") || `<article class="data-card"><strong>暂无标的</strong><p>可通过上方搜索添加到该分组。</p></article>`}</div>
      `).join("")}
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>关注标的详情卡</h2><span>每张卡片来自当前关注列表，不再使用固定示例内容</span></div>
      <div class="watch-grid">${enrichedItems.map(stockDetailCard).join("") || `<article class="data-card"><strong>暂无关注</strong><p>先添加股票或ETF后，这里会显示独立详情卡。</p></article>`}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>关注组合摘要</h2><span>用于快速查看数量、风险和同步状态</span></div>
      <div class="metrics">
        ${[
          { label: "关注数量", value: `${enrichedItems.length}只`, change: "股票/ETF" },
          { label: "风险标的", value: `${enrichedItems.filter((item) => item.isRisk).length}只`, change: "置顶" },
          { label: "ETF数量", value: `${enrichedItems.filter((item) => item.assetType === "ETF").length}只`, change: "资产类型" },
          { label: "最后同步", value: syncStatus.lastSyncAt ?? "暂无", change: syncStatus.status ?? "状态" },
        ].map(metricCard).join("")}
      </div>
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
        ${enrichedItems.map((stock) => `
          <article class="data-card">
            <div class="card-head"><strong>${stock.name}</strong><span>${stock.changePercent ?? "暂无"}</span></div>
            ${timelineList([
              { date: "今日", title: `${stock.name} ${stock.changePercent ?? "暂无"}`, impact: `成交额 ${stock.amount ?? "暂无"}，AI提醒：关注变化但避免追高。` },
            ])}
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
        ].map(metricCard).join("")}
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
        ${enrichedItems.map((stock) => `
          <article class="data-card">
            <div class="card-head"><strong>${stock.name}</strong><span>${stock.code}</span></div>
            ${(stock.riskTips?.length ? stock.riskTips : ["短期波动风险", "行业景气变化风险", "事件落空风险"]).map(riskCard).join("")}
          </article>
        `).join("")}
      </div>
    </section>`;
}

export function mountWatchlist({ navigate, rerender }) {
  const form = document.querySelector(".add-stock-form");
  const groupForm = document.querySelector(".group-form");
  const message = document.querySelector("#portfolio-message");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    if (message) message.textContent = "正在同步到云端...";
    const result = await addSyncedStock(formData.get("stockQuery"), formData.get("groupName"));
    if (message) message.textContent = result.message;
    if (result.ok) rerender();
  });

  groupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(groupForm);
    const result = await createWatchlistGroup(formData.get("groupName"));
    if (message) message.textContent = result.message;
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

  document.querySelectorAll("[data-move-stock]").forEach((select) => {
    select.addEventListener("change", async () => {
      await moveSyncedStockToGroup(select.dataset.moveStock, select.value);
      rerender();
    });
  });

  document.querySelectorAll("[data-rename-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      const next = window.prompt("请输入新的分组名称", button.dataset.renameGroup);
      if (!next || next === button.dataset.renameGroup) return;
      await renameWatchlistGroup(button.dataset.renameGroup, next);
      rerender();
    });
  });

  document.querySelectorAll("[data-delete-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm(`删除分组“${button.dataset.deleteGroup}”？组内标的会移动到长期观察。`)) return;
      await deleteWatchlistGroup(button.dataset.deleteGroup);
      rerender();
    });
  });
}

function getSortMode() {
  return window.localStorage.getItem(sortKey) ?? "risk";
}

function enrichStocks(items, riskSignals, stockNews = []) {
  return items.map((item) => {
    const risk = riskSignals.find((signal) => signal.target === item.name || signal.target === item.code);
    const relatedNews = findRelatedNews(item, stockNews);
    const changeValue = parseChange(item.changePercent);
    const currentJudgment = buildCurrentJudgment(item, risk, relatedNews, changeValue);
    return {
      ...item,
      changeValue,
      currentJudgment,
      aiChange: buildAiChange(item, risk, relatedNews, changeValue),
      latestNews: relatedNews?.title ?? item.latestNews,
      newsImpact: buildNewsImpact(relatedNews),
      hotSectorRelation: buildHotSectorRelation(item, relatedNews),
      isRisk: Boolean(risk) || String(item.aiLevel).includes("风险"),
      riskText: risk?.message,
      aiScore: aiLevelScore(item.aiLevel),
    };
  });
}

function findRelatedNews(stock = {}, news = []) {
  return news.find((item) => {
    const text = `${item.title ?? ""}${item.relatedStock ?? ""}${(item.relatedStocks ?? []).join("")}${item.relatedIndustry ?? ""}${(item.relatedIndustries ?? []).join("")}`;
    return text.includes(stock.code) || text.includes(stock.name) || (stock.industry && text.includes(stock.industry));
  });
}

function buildCurrentJudgment(stock = {}, risk, news, changeValue = 0) {
  if (risk || Math.abs(changeValue) >= 5) return "风险优先观察";
  if (news?.impact === "利好" && changeValue >= 0) return "可以观察";
  if (news?.impact === "利空") return "等待风险释放";
  if (changeValue >= 2) return "关注强度提升";
  if (changeValue <= -2) return "等待企稳";
  return stock.aiRating ?? stock.aiLevel ?? "常规观察";
}

function buildAiChange(stock = {}, risk, news, changeValue = 0) {
  if (risk) return `风险信号触发：${risk.message}`;
  if (news?.title) return `新闻驱动变化：${news.title}，影响方向${news.impact ?? "中性"}。`;
  if (changeValue >= 2) return "价格表现转强，关注成交额是否同步放大。";
  if (changeValue <= -2) return "价格走弱，等待企稳和风险释放。";
  return "判断暂无明显变化，维持原观察等级。";
}

function buildNewsImpact(news) {
  if (!news) return "暂无强相关新闻，继续观察公告和行情变化。";
  return `${news.title}｜${news.source ?? "新闻"}｜${news.impact ?? "中性"}｜${news.shortTermImpact ?? news.aiSummary ?? "等待行情验证影响。"}`;
}

function buildHotSectorRelation(stock = {}, news) {
  const sectors = [...(news?.relatedIndustries ?? []), news?.relatedIndustry, stock.industry].filter(Boolean);
  if (!sectors.length) return "暂未匹配到强热点板块。";
  return `关联方向：${[...new Set(sectors)].slice(0, 3).join("、")}，需观察板块热度是否延续。`;
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

function firstRisk(stock) {
  return stock.riskTips?.[0] ?? "常规跟踪";
}

function toneClass(value) {
  return String(value).startsWith("-") || Number(value) < 0 ? "negative" : "positive";
}
