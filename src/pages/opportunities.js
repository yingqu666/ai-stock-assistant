import { opportunityCard } from "../components/cards.js";
import { getAiOpportunityPool } from "../services/mockService.js";

export async function renderOpportunities() {
  const { opportunities, source, updatedAt, dataStatus } = await getAiOpportunityPool();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>今日AI机会池 TOP10</h2>
          <span>基于实时行情、热点板块、新闻公告和财务数据；不是推荐股票，不保证买入收益</span>
        </div>
      </div>
      <p class="form-message">数据来源：${source ?? "行情服务"} | 更新时间：${updatedAt ?? "时间待更新"} | 状态：${dataStatus ?? "部分真实"}</p>
      <div class="card-grid">${opportunities.map(opportunityCard).join("")}</div>
    </section>`;
}
