import { getIndustryOptions, getIndustryResearchData } from "../services/industryService.js";

let selectedIndustry = "AI";

export function renderIndustryResearch() {
  const data = getIndustryResearchData(selectedIndustry);
  const options = getIndustryOptions();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>行业研究</h2>
          <span>选择行业后查看产业链、新闻影响、受益方向和风险</span>
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
