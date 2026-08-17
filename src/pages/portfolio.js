import { metricCard } from "../components/cards.js";
import { addPortfolioPosition, analyzeHoldingRisks, getPortfolioSummary, previewPortfolioPosition, removePortfolioPosition } from "../services/portfolioService.js";

let holdingRiskAnalysis = null;

export async function renderPortfolio() {
  const portfolio = await getPortfolioSummary();
  const sync = portfolio.syncStatus ?? { status: "尚未同步", lastSyncAt: "尚未同步", message: "" };

  return `
    <section class="wide-section">
      <div class="section-head">
        <div><h2>投资组合</h2><span>只做记录分析，不做交易；支持股票和ETF统一管理</span></div>
        <span class="notice">${sync.status} · ${sync.lastSyncAt} · ${sync.source ?? "云端/本地"}</span>
      </div>
      <div class="metrics">
        ${[
          { label: "账户总资产", value: `${money(portfolio.totalAsset)}元`, change: "现金+持仓" },
          { label: "现金余额", value: `${money(portfolio.cash)}元`, change: "账户" },
          { label: "股票资产", value: `${money(portfolio.stockAsset)}元`, change: "股票" },
          { label: "ETF资产", value: `${money(portfolio.etfAsset)}元`, change: "ETF" },
          { label: "今日盈亏", value: `${money(portfolio.todayPnl)}元`, change: portfolio.todayPnl >= 0 ? "盈利" : "亏损" },
          { label: "累计收益", value: `${money(portfolio.totalPnl)}元`, change: `${portfolio.returnRate.toFixed(2)}%` },
          { label: "风险集中度", value: `${portfolio.concentrationRisk.score}分`, change: portfolio.concentrationRisk.level },
        ].map(metricCard).join("")}
      </div>
      <p class="form-message">${portfolio.concentrationRisk.message}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>新增持仓</h2><span>输入代码自动识别名称、类型、价格和行业</span></div>
      <form class="stock-search portfolio-preview-form">
        <input name="code" placeholder="股票/ETF代码，例如 600176 或 512760" />
        <button type="submit">识别标的</button>
      </form>
      <p id="portfolio-preview-message" class="form-message">先输入代码识别，再填写买入价格和数量。</p>
      <form class="stock-search portfolio-form">
        <input name="code" placeholder="已识别代码" />
        <input name="cost" inputmode="decimal" placeholder="买入价格" />
        <input name="qty" inputmode="numeric" placeholder="买入数量" />
        <button type="submit">保存持仓</button>
      </form>
      <p id="portfolio-sync-message" class="form-message">${sync.message ?? ""}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>资产曲线</h2><span>近7天 / 近30天</span></div>
      <div class="split-section">
        <div class="sub-panel">
          <h2>近7天</h2>
          <div class="sparkline">${portfolio.sevenDayRecords.map((item) => `<span style="height:${barHeight(item.totalAsset, portfolio.sevenDayRecords)}%" title="${item.date} ${money(item.totalAsset)}"></span>`).join("")}</div>
        </div>
        <div class="sub-panel">
          <h2>近30天</h2>
          <div class="sparkline">${portfolio.thirtyDayRecords.map((item) => `<span style="height:${barHeight(item.totalAsset, portfolio.thirtyDayRecords)}%" title="${item.date} ${money(item.totalAsset)}"></span>`).join("")}</div>
        </div>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>持仓明细</h2><span>成本、数量、市值、盈亏和仓位占比</span></div>
      <div class="table">
        ${portfolio.positions.map((item) => `
          <div class="table-row account-row">
            <b>${item.name}<small>${item.code} · ${item.assetType} · ${item.industry}</small></b>
            <span>${item.qty}份/股</span>
            <span>成本 ${item.cost.toFixed(2)}</span>
            <span>现价 ${item.currentPrice.toFixed(2)}</span>
            <em>${money(item.pnl)}元｜${item.returnRate.toFixed(2)}%</em>
            <button class="danger-button" data-delete-position="${item.id}" type="button">删除</button>
          </div>
        `).join("") || `<div class="table-row"><b>暂无持仓</b><span>添加股票或ETF后显示</span><em>待记录</em></div>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>持仓比例</h2><span>单标的占比</span></div>
      <div class="detail-grid">
        ${portfolio.allocation.map((item) => `<article class="data-card"><strong>${item.name}</strong><p>${item.assetType} · ${item.industry} · 占比 ${item.weight.toFixed(2)}%</p><div class="mini-bar"><span style="width:${item.weight}%"></span></div></article>`).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>行业占比</h2><span>组合行业集中度</span></div>
      <div class="detail-grid">
        ${portfolio.industryAllocation.map((item) => `<article class="data-card"><strong>${item.industry}</strong><p>占比 ${item.weight.toFixed(2)}%</p><div class="mini-bar"><span style="width:${item.weight}%"></span></div></article>`).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI组合风险分析</h2><span>不输出买卖指令</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>当前组合评分</strong><p>${portfolio.aiAnalysis.score ?? 60}/100</p></article>
        <article class="data-card"><strong>行业集中度</strong><p>${portfolio.aiAnalysis.industryConcentration ?? "暂无持仓"}</p></article>
        <article class="data-card"><strong>风险等级</strong><p>${portfolio.aiAnalysis.riskLevel ?? "中"}</p></article>
        <article class="data-card"><strong>最大风险来源</strong><p>${portfolio.aiAnalysis.maxRiskSource ?? "暂无明确集中风险"}</p></article>
        <article class="data-card"><strong>仓位建议</strong><p>${portfolio.aiAnalysis.positionAdvice ?? "保持当前仓位并继续观察"}</p></article>
        <article class="data-card"><strong>调整方向</strong><p>${(portfolio.aiAnalysis.adjustmentDirections ?? []).join("；")}</p></article>
        <article class="data-card"><strong>组合优势</strong><p>${portfolio.aiAnalysis.strengths.join("；")}</p></article>
        <article class="data-card"><strong>风险点</strong><p>${portfolio.aiAnalysis.risks.join("；")}</p></article>
        <article class="data-card"><strong>观察建议</strong><p>${portfolio.aiAnalysis.suggestions.join("；")}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head">
        <div><h2>持仓风险分析</h2><span>结合持仓成本、现价、仓位、市场、新闻和个股行情</span></div>
        <button id="analyze-holding-risk-button" type="button">分析持仓风险</button>
      </div>
      <p id="holding-risk-message" class="form-message">${holdingRiskAnalysis ? `${holdingRiskAnalysis.source} · ${holdingRiskAnalysis.generatedAt}` : "点击后生成持仓风险分析；DeepSeek不可用时自动使用fallback。"}</p>
      <article class="data-card"><strong>整体判断</strong><p>${holdingRiskAnalysis?.overall ?? "尚未生成持仓风险分析。"}</p></article>
      <div class="detail-grid">
        ${(holdingRiskAnalysis?.holdings ?? []).map(holdingRiskCard).join("") || `<article class="data-card"><strong>暂无分析结果</strong><p>添加持仓后点击“分析持仓风险”。</p></article>`}
      </div>
    </section>`;
}

export function mountPortfolio({ rerender }) {
  const previewForm = document.querySelector(".portfolio-preview-form");
  const form = document.querySelector(".portfolio-form");
  const previewMessage = document.querySelector("#portfolio-preview-message");
  const message = document.querySelector("#portfolio-sync-message");

  previewForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(previewForm);
    const code = String(formData.get("code") ?? "").trim();
    if (previewMessage) previewMessage.textContent = "正在识别标的...";
    const result = await previewPortfolioPosition(code);
    if (!result.ok) {
      if (previewMessage) previewMessage.textContent = result.message;
      return;
    }
    form.querySelector("[name='code']").value = result.data.code;
    if (previewMessage) previewMessage.textContent = `${result.data.name} · ${result.data.assetType} · ${result.data.industry} · 当前价 ${result.data.priceText} · 来源 ${result.data.dataSource} · ${result.data.dataStatus}`;
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    if (message) message.textContent = "正在保存持仓...";
    const result = await addPortfolioPosition({
      code: String(formData.get("code") ?? ""),
      cost: String(formData.get("cost") ?? ""),
      qty: String(formData.get("qty") ?? ""),
    });
    if (message) message.textContent = result.message;
    if (result.ok) rerender();
  });

  document.querySelectorAll("[data-delete-position]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removePortfolioPosition(button.dataset.deletePosition);
      rerender();
    });
  });

  document.querySelector("#analyze-holding-risk-button")?.addEventListener("click", async () => {
    const riskMessage = document.querySelector("#holding-risk-message");
    if (riskMessage) riskMessage.textContent = "正在分析持仓风险...";
    const portfolio = await getPortfolioSummary();
    holdingRiskAnalysis = await analyzeHoldingRisks(portfolio);
    if (riskMessage) riskMessage.textContent = `${holdingRiskAnalysis.source} · ${holdingRiskAnalysis.generatedAt}`;
    rerender();
  });
}

function barHeight(value, records) {
  const values = records.map((item) => item.totalAsset);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 55;
  return 18 + ((value - min) / (max - min)) * 82;
}

function money(value) {
  return Number(value ?? 0).toFixed(2);
}

function holdingRiskCard(item = {}) {
  return `
    <article class="data-card">
      <div class="card-head"><strong>${item.name}</strong><span>${item.code} · ${item.assetType} · 风险${item.riskLevel}</span></div>
      <p><b>AI判断</b>${item.aiJudgment}</p>
      <p><b>风险原因</b>${(item.riskReasons ?? []).join("；")}</p>
      <p><b>关注价格</b>${item.watchPrice} · <b>风险价格</b>${item.riskPrice}</p>
      <p><b>需要观察</b>${(item.watchChanges ?? []).join("；")}</p>
      <p><b>继续持有条件</b>${(item.holdConditions ?? []).join("；")}</p>
      <p class="notice">只做持仓风险管理，不输出保证收益，不自动买卖。</p>
    </article>`;
}
