import { getIndustryResearchData } from "../services/industryService.js";

export function renderIndustryResearch() {
  const data = getIndustryResearchData();

  return `
    <section class="wide-section">
      <div class="section-head">
        <h2>行业研究中心</h2>
        <span>${data.industry}产业链</span>
      </div>
      <div class="card-grid">
        ${data.chain
          .map(
            (item) => `
              <article class="data-card">
                <div class="card-head">
                  <strong>${item.name}</strong>
                  <span>产业节点</span>
                </div>
                <p>${item.logic}</p>
                <div class="mini-list">
                  <span>核心公司：${item.leaders.join("、")}</span>
                  <span>催化因素：${item.catalysts.join("、")}</span>
                  <span>风险因素：${item.risks.join("、")}</span>
                  <span>最新跟踪：${item.latestNews}</span>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>行业新闻</h2></div>
      <div class="card-grid">
        ${data.news
          .map(
            (item) => `
              <article class="data-card">
                <div class="card-head">
                  <strong>${item.category}</strong>
                  <span>${item.impact}</span>
                </div>
                <p>${item.title}</p>
                <small>${item.source} · ${item.time}</small>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}
