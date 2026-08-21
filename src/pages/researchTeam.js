import { tagList } from "../components/cards.js";
import { getResearchTeamWorkflow } from "../services/researchTeamService.js";

export async function renderResearchTeam() {
  const workflow = await getResearchTeamWorkflow();
  const report = workflow.report;

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>AI研究团队</h2>
          <span>市场分析师 -> 行业分析师 -> 公司分析师 -> 技术分析师 -> 风险分析师 -> 投资经理AI</span>
        </div>
        <span class="notice">AI来源：${workflow.source ?? "fallback"}${workflow.failureReason ? ` · 失败原因：${workflow.failureReason}` : ""}</span>
      </div>
      <div class="team-grid">
        ${workflow.agents.map((agent, index) => `
          <article class="data-card team-card">
            <div class="agent-index">${index + 1}</div>
            <strong>${agent.name}</strong>
            ${tagList([agent.responsibility])}
            <p>${agent.output}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>投资经理AI深度研究</h2><span>聚焦筛选逻辑和风险拆解，首页只保留摘要</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>行业筛选逻辑</strong><p>${report.marketEnvironment}</p></article>
        <article class="data-card"><strong>机会筛选逻辑</strong><p>${report.coreOpportunities}</p></article>
        <article class="data-card"><strong>股票选择原因</strong><p>${report.keyFocus}</p></article>
        <article class="data-card"><strong>风险拆解</strong><p>${(report.riskFactors ?? []).join("；") || "暂无明确风险信号"}</p></article>
        <article class="data-card"><strong>研究结论</strong><p>${report.observationAdvice}</p></article>
        <article class="data-card"><strong>数据依据</strong><p>${formatEvidence(report.evidence)}</p></article>
      </div>
    </section>`;
}

function formatEvidence(evidence = {}) {
  const values = Object.values(evidence).flat().filter(Boolean);
  return values.length ? values.slice(0, 8).join("；") : "行情、新闻、公告、财务和用户数据正在通过 service 层采集。";
}
