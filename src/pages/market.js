import { metricCard, sectorCard } from "../components/cards.js";
import { getMarketData } from "../services/mockService.js";

export async function renderMarket() {
  const { marketOverview, marketSentiment, hotSectors, sectors } = await getMarketData();

  return `
    <section class="wide-section">
      <div class="section-head"><h2>市场分析</h2><span>指数、成交量、涨跌家数和情绪状态</span></div>
      <div class="metrics">${marketOverview.map(metricCard).join("")}</div>
      <p class="answer">${marketSentiment.summary}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>市场状态总结</h2><span>${marketSentiment.longShort}</span></div>
      <div class="metrics">
        ${[
          { label: "市场热度", value: `${marketSentiment.heat}分`, change: "改善" },
          { label: "上涨家数", value: marketSentiment.upCount, change: "偏强" },
          { label: "下跌家数", value: marketSentiment.downCount, change: marketSentiment.riskLevel },
        ].map(metricCard).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>热点板块排行</h2></div>
      <div class="table">${sectors.map((sector) => `<div class="table-row market-row"><b>${sector.name}</b><span>热度 ${sector.heat}</span><span>${sector.flow}</span><em>${sector.view}</em></div>`).join("")}</div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>重点板块解读</h2></div>
      <div class="card-grid">${hotSectors.map(sectorCard).join("")}</div>
    </section>`;
}
