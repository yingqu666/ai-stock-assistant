import { getIndustryAiResearchData, getIndustryOptions } from "../services/industryService.js";

let selectedIndustry = "AI";

export async function renderIndustryResearch() {
  const data = await getIndustryAiResearchData(selectedIndustry);
  const options = getIndustryOptions();
  const ai = data.aiAnalysis;
  const decision = ai?.investmentDecision ?? {};

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>行业研究</h2>
          <span>选择行业后查看产业链、新闻影响、受益方向、风险和AI分析</span>
        </div>
      </div>
      <form class="stock-search industry-select-form">
        <select name="industry">${options.map((item) => `<option value="${item}" ${item === selectedIndustry ? "selected" : ""}>${item}</option>`).join("")}</select>
        <button type="submit">查看行业</button>
      </form>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>${data.industry}行业概况</h2><span>${data.trend}</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>行业概况</strong><p>${data.overview}</p></article>
        <article class="data-card"><strong>产业链位置</strong><p>${data.chain.map((item) => item.name).join(" → ")}</p></article>
        <article class="data-card"><strong>可信度</strong><p>${data.credibility.level}：${data.credibility.reason}</p><small>${data.credibility.sources.join("、")}</small></article>
      </div>
    </section>

    ${ai ? `
      <section class="wide-section">
        <div class="section-head"><h2>AI行业分析</h2><span>${ai.source === "deepseek" ? "真实AI模型" : ai.source ?? "fallback"}</span></div>
        <div class="metrics">
          ${[
            { label: "行业评级", value: decision.score >= 70 ? "看多" : decision.score >= 50 ? "中性" : "看空", change: decision.rating ?? "中性观察" },
            { label: "行业评分", value: `${decision.score ?? 60}/100`, change: "0-100" },
            { label: "短期趋势", value: decision.shortTerm ?? "震荡观察", change: decision.marketTrend ?? "震荡" },
            { label: "中期趋势", value: decision.midTerm ?? "等待方向确认", change: decision.action ?? "等待" },
          ].map(metricCardSafe).join("")}
        </div>
        <div class="detail-grid">
          <article class="data-card"><strong>结论</strong><p>${ai.conclusion ?? ai.marketSummary ?? "当前仅作研究观察。"}</p></article>
          <article class="data-card"><strong>依据</strong><p>${asList(ai.basis ?? ai.evidence).slice(0, 5).join("；") || "行情、新闻、行业资料"}</p></article>
          <article class="data-card"><strong>风险</strong><p>${asList(ai.risks).join("；") || data.risks.join("；")}</p></article>
          <article class="data-card"><strong>观察建议</strong><p>${asList(ai.observationAdvice ?? ai.tomorrowPlan).join("；") || "关注成交、政策和新闻变化。"}</p></article>
          <article class="data-card"><strong>受益方向</strong><p>${data.chain.flatMap((item) => item.leaders).slice(0, 6).join("、")}</p></article>
        </div>
      </section>
    ` : ""}

    <section class="wide-section">
      <div class="section-head"><h2>产业链拆解</h2><span>${data.industry}</span></div>
      <div class="card-grid">
        ${data.chain.map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.name}</strong><span>产业节点</span></div>
            <p>${item.logic}</p>
            <div class="mini-list">
              <span>核心公司：${item.leaders.join("、")}</span>
              <span>催化因素：${item.catalysts.join("、")}</span>
              <span>风险因素：${item.risks.join("、")}</span>
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>近期新闻</h2><span>来源、日期、事件、影响和风险</span></div>
      <div class="card-grid">
        ${data.news.map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.date}</strong><span>${item.source}</span></div>
            <p><b>事件：</b>${item.event}</p>
            <p><b>影响：</b>${item.impact}</p>
            <p><b>受益方向：</b>${item.beneficiaries.join("、")}</p>
            <p><b>风险：</b>${item.risk}</p>
          </article>
        `).join("")}
      </div>
    </section>`;
}

export function mountIndustryResearch({ rerender }) {
  document.querySelector(".industry-select-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    selectedIndustry = String(formData.get("industry") ?? "AI");
    rerender();
  });
}

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : JSON.stringify(item));
  if (typeof value === "object" && value) return Object.values(value).flatMap(asList);
  if (!value) return [];
  return [String(value)];
}

function metricCardSafe(item) {
  return `<article class="metric-card"><span>${item.label}</span><strong>${item.value}</strong><small>${item.change ?? ""}</small></article>`;
}
