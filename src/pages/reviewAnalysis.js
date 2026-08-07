import { metricCard } from "../components/cards.js";
import { getReviewChartData, runAiReview } from "../services/chartService.js";

function bar(value) {
  const width = Math.max(0, Math.min(100, Number(value || 0) * 100));
  return `<div class="mini-bar"><span style="width:${width}%"></span></div>`;
}

function accuracyCard(label, stat) {
  return metricCard({
    label,
    value: `${stat?.accuracy ?? 0}%`,
    change: `${stat?.count ?? 0}条样本`,
  });
}

export async function renderReviewAnalysis() {
  const data = await getReviewChartData();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>AI判断准确率复盘</h2>
          <span>来源：${data.source} · 样本：${data.stats.sampleSize}条</span>
        </div>
        <button id="run-ai-review-button" type="button">执行AI复盘</button>
      </div>
      <div class="metrics">
        ${[
          { label: "市场判断准确率", value: `${data.stats.marketAccuracy}%`, change: "综合样本" },
          { label: "风险提醒有效率", value: `${data.stats.riskAccuracy}%`, change: `${data.riskCount}次提醒` },
          { label: "AI综合可信度", value: `${data.stats.credibilityScore ?? 0}分`, change: `信心等级：${data.stats.confidenceLevel ?? "低"}` },
          { label: "历史样本数量", value: `${data.stats.sampleSize}条`, change: "AI判断记录" },
        ].map(metricCard).join("")}
      </div>
      <p id="ai-review-message" class="form-message">复盘结果优先使用东方财富真实行情，用于校准AI置信度，不代表未来表现。</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>市场判断周期统计</h2><span>30天 / 60天 / 90天</span></div>
      <div class="metrics">
        ${accuracyCard("30天市场判断", data.windows["30"])}
        ${accuracyCard("60天市场判断", data.windows["60"])}
        ${accuracyCard("90天市场判断", data.windows["90"])}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>行业判断准确率</h2><span>重点方向</span></div>
      <div class="metrics">
        ${accuracyCard("AI方向", data.byIndustry.AI)}
        ${accuracyCard("半导体", data.byIndustry["半导体"])}
        ${accuracyCard("新能源", data.byIndustry["新能源"])}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>近期复盘趋势</h2><span>最近30条AI判断</span></div>
      <div class="detail-grid">
        ${data.thirtyDays.map((item) => `
          <article class="data-card">
            <strong>${item.label}</strong>
            <p>市场判断得分：${Math.round(item.marketScore * 100)}%</p>
            ${bar(item.marketScore)}
            <p>风险提醒得分：${Math.round(item.riskScore * 100)}%</p>
            ${bar(item.riskScore)}
          </article>
        `).join("") || `<article class="data-card"><strong>暂无复盘样本</strong><p>生成AI日报后，系统会逐步积累判断记录。</p></article>`}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>热点判断结果</h2><span>用于后续AI反思</span></div>
      <div class="table">
        ${data.sectorResults.map((item) => `
          <div class="table-row">
            <b>${item.date}</b>
            <span>${item.sectors.join("、")}</span>
            <em>${item.result}</em>
          </div>
        `).join("") || `<div class="table-row"><b>暂无记录</b><span>等待AI日报生成</span><em>待复盘</em></div>`}
      </div>
    </section>`;
}

export function mountReviewAnalysis({ rerender }) {
  document.querySelector("#run-ai-review-button")?.addEventListener("click", async () => {
    const message = document.querySelector("#ai-review-message");
    if (message) message.textContent = "正在执行AI复盘...";
    const result = await runAiReview();
    if (message) message.textContent = `复盘完成：更新 ${result.reviewedCount ?? 0} 条判断记录。`;
    rerender();
  });
}
