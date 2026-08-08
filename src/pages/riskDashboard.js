import { metricCard } from "../components/cards.js";
import { getIndustryOptions } from "../services/industryService.js";
import { getRiskDashboardData } from "../services/riskDashboardService.js";

let targetType = "行业";
let target = "半导体";

export async function renderRiskDashboard() {
  const data = await getRiskDashboardData({ targetType, target });
  const industries = getIndustryOptions();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div><h2>风险看板</h2><span>可选择市场、行业、个股进行风险分析</span></div>
      </div>
      <form class="stock-search risk-target-form">
        <select name="targetType">
          ${["市场", "行业", "个股"].map((item) => `<option value="${item}" ${item === targetType ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <input name="target" value="${target}" placeholder="行业如 半导体；个股如 600176" />
        <button type="submit">分析风险</button>
      </form>
      <div class="metrics">
        ${[
          { label: "分析对象", value: data.target, change: data.targetType },
          { label: "趋势", value: data.trend, change: "上涨/下降/震荡" },
          { label: "风险评分", value: `${data.score}分`, change: data.scoreLevel },
          { label: "可信度", value: data.credibility.level, change: data.credibility.reason },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>风险分析</h2><span>${data.target}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>驱动因素</strong><p>${data.drivers.join("；")}</p></article>
        <article class="data-card"><strong>风险因素</strong><p>${data.risks.join("；")}</p></article>
        <article class="data-card"><strong>数据来源</strong><p>${data.credibility.sources.join("、")}</p><small>可信度：${data.credibility.level}</small></article>
        <article class="data-card"><strong>组合暴露</strong><p>${data.portfolioExposure !== undefined ? `${data.portfolioExposure.toFixed(2)}%` : "按当前对象不适用"}</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>历史风险变化</h2><span>简单趋势图</span></div>
      <div class="detail-grid">
        ${data.trendData.map((value, index) => `<article class="data-card"><strong>阶段 ${index + 1}</strong><p>${value}分</p><div class="mini-bar"><span style="width:${value}%"></span></div></article>`).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>当前风险信号</h2><span>来自riskService</span></div>
      <div class="detail-grid">
        ${data.signals.map((item) => `<article class="data-card"><strong>${item.type}</strong><p>${item.message}</p><small>${item.target} · ${item.level}</small></article>`).join("") || `<article class="data-card"><strong>暂无明显信号</strong><p>继续观察市场、行业和个股变化。</p></article>`}
      </div>
    </section>`;
}

export function mountRiskDashboard({ rerender }) {
  document.querySelector(".risk-target-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    targetType = String(formData.get("targetType") ?? "行业");
    const input = String(formData.get("target") ?? "").trim();
    if (targetType === "市场") target = "A股市场";
    else if (targetType === "行业") target = getIndustryOptions().includes(input) ? input : "半导体";
    else target = input || "600176";
    rerender();
  });
}
