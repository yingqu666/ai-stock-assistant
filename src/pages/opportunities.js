import { opportunityCard } from "../components/cards.js";
import { getOpportunityData } from "../services/mockService.js";

export function renderOpportunities() {
  const { opportunities } = getOpportunityData();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>AI研究机会</h2>
          <span>不是推荐股票，不保证买入收益</span>
        </div>
      </div>
      <div class="card-grid">${opportunities.map(opportunityCard).join("")}</div>
    </section>`;
}
