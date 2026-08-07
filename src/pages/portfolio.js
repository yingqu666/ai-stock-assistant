import { metricCard } from "../components/cards.js";
import { addPortfolioPosition, getPortfolioSummary, removePortfolioPosition } from "../services/portfolioService.js";

export async function renderPortfolio() {
  const portfolio = await getPortfolioSummary();
  const sync = portfolio.syncStatus ?? { status: "尚未同步", lastSyncAt: "尚未同步", message: "" };

  return `
    <section class="wide-section">
      <div class="section-head">
        <div><h2>投资组合</h2><span>云端优先同步，只做记录分析，不做交易</span></div>
        <span class="notice">${sync.status} · ${sync.lastSyncAt} · ${sync.source ?? "云端/本地"}</span>
      </div>
      <div class="metrics">
        ${[
          { label: "总资产", value: `${portfolio.totalAsset.toFixed(2)}元`, change: "记录" },
          { label: "今日盈亏", value: `${portfolio.todayPnl.toFixed(2)}元`, change: portfolio.todayPnl >= 0 ? "盈利" : "亏损" },
          { label: "累计收益", value: `${portfolio.totalPnl.toFixed(2)}元`, change: `${portfolio.returnRate.toFixed(2)}%` },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>添加持仓</h2><span>保存后自动同步云端，失败则进入本地缓存</span></div>
      <form class="stock-search portfolio-form">
        <input name="code" placeholder="股票代码 600519" />
        <input name="name" placeholder="股票名称 贵州茅台" />
        <input name="cost" inputmode="decimal" placeholder="成本价" />
        <input name="qty" inputmode="numeric" placeholder="数量" />
        <button type="submit">保存持仓</button>
      </form>
      <p id="portfolio-sync-message" class="form-message">${sync.message ?? ""}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>资产变化曲线</h2><span>最近30天记录</span></div>
      <div class="sparkline">${portfolio.dailyRecords.map((item) => `<span style="height:${barHeight(item.totalAsset, portfolio.dailyRecords)}%" title="${item.date} ${item.totalAsset.toFixed(2)}"></span>`).join("")}</div>
      <div class="detail-grid compact">
        ${portfolio.dailyRecords.slice(-6).map((item) => `<article class="data-card"><strong>${item.date}</strong><p>总资产 ${item.totalAsset.toFixed(2)} 元</p><p>当日收益 ${item.todayPnl.toFixed(2)} 元</p></article>`).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>持仓股票</h2><span>成本、数量、市值和盈亏</span></div>
      <div class="table">
        ${portfolio.positions.map((item) => `
          <div class="table-row account-row">
            <b>${item.name}<small>${item.code}</small></b>
            <span>${item.qty}股</span>
            <span>成本 ${item.cost}</span>
            <span>现价 ${item.currentPrice.toFixed(2)}</span>
            <em>${item.pnl.toFixed(2)}元｜${item.returnRate.toFixed(2)}%</em>
            <button class="danger-button" data-delete-position="${item.id}" type="button">删除</button>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>持仓比例图</h2><span>单股票占比</span></div>
      <div class="detail-grid">
        ${portfolio.allocation.map((item) => `<article class="data-card"><strong>${item.name}</strong><p>${item.industry} · 占比 ${item.weight.toFixed(2)}%</p><div class="mini-bar"><span style="width:${item.weight}%"></span></div></article>`).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>行业占比图</h2><span>组合行业集中度</span></div>
      <div class="detail-grid">
        ${portfolio.industryAllocation.map((item) => `<article class="data-card"><strong>${item.industry}</strong><p>占比 ${item.weight.toFixed(2)}%</p><div class="mini-bar"><span style="width:${item.weight}%"></span></div></article>`).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI组合风险分析</h2><span>不输出买卖指令</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>组合优势</strong><p>${portfolio.aiAnalysis.strengths.join("；")}</p></article>
        <article class="data-card"><strong>风险点</strong><p>${portfolio.aiAnalysis.risks.join("；")}</p></article>
        <article class="data-card"><strong>观察建议</strong><p>${portfolio.aiAnalysis.suggestions.join("；")}</p></article>
      </div>
    </section>`;
}

export function mountPortfolio({ rerender }) {
  const form = document.querySelector(".portfolio-form");
  const message = document.querySelector("#portfolio-sync-message");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    if (message) message.textContent = "正在保存持仓...";
    const result = await addPortfolioPosition({
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      cost: String(formData.get("cost") ?? ""),
      qty: String(formData.get("qty") ?? ""),
    });
    if (!result.ok && message) message.textContent = result.message;
    if (result.ok) rerender();
  });

  document.querySelectorAll("[data-delete-position]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removePortfolioPosition(button.dataset.deletePosition);
      rerender();
    });
  });
}

function barHeight(value, records) {
  const values = records.map((item) => item.totalAsset);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 55;
  return 18 + ((value - min) / (max - min)) * 82;
}
