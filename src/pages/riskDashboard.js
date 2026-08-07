import { metricCard } from "../components/cards.js";
import { getRiskDashboardData } from "../services/riskDashboardService.js";

export async function renderRiskDashboard() {
  const data = await getRiskDashboardData();
  return `
    <section class="wide-section">
      <div class="section-head"><h2>风险看板</h2><span>市场、行业、个股、组合风险</span></div>
      <div class="metrics">
        ${[
          { label: "风险评分", value: `${data.score}分`, change: data.score > 70 ? "偏高" : "可控" },
          { label: "市场风险", value: data.currentRisks.market, change: "市场" },
          { label: "风险信号", value: `${data.signals.length}条`, change: "当前" },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="detail-grid">
        ${Object.entries(data.currentRisks).map(([key, value]) => `<article class="data-card"><strong>${key}</strong><p>${value}</p></article>`).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>历史变化曲线</h2><span>模拟趋势</span></div>
      <div class="detail-grid">
        ${data.trend.map((value, index) => `<article class="data-card"><strong>阶段 ${index + 1}</strong><p>${value}分</p><div class="mini-bar"><span style="width:${value}%"></span></div></article>`).join("")}
      </div>
    </section>`;
}
