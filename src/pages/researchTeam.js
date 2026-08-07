import { tagList } from "../components/cards.js";
import { getResearchTeamData } from "../services/mockService.js";
import { getResearchTeamWorkflow } from "../services/researchTeamService.js";

export async function renderResearchTeam() {
  const { aiTeam } = getResearchTeamData();
  const workflow = await getResearchTeamWorkflow();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>AI研究团队</h2>
          <span>市场分析师 → 行业分析师 → 公司分析师 → 技术分析师 → 风险分析师 → 投资经理AI</span>
        </div>
        <span class="notice">${workflow.source ?? "fallback"}</span>
      </div>
      <div class="team-grid">
        ${aiTeam
          .map(
            (agent, index) => `
              <article class="data-card team-card">
                <div class="agent-index">${index + 1}</div>
                <strong>${agent.role}</strong>
                ${tagList(agent.focus)}
                <p>${agent.output}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>真实分析流程</h2><span>多Agent协作摘要</span></div>
      <div class="detail-grid">
        ${workflow.agents
          .map(
            (agent) => `
              <article class="data-card">
                <strong>${agent.name}</strong>
                <small>${agent.responsibility}</small>
                <p>${agent.output}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>投资经理AI总结</h2><span>完整研究报告摘要</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>今日市场</strong><p>${workflow.report.marketSummary}</p></article>
        <article class="data-card"><strong>核心逻辑</strong><p>${workflow.report.coreLogic ?? workflow.report.marketSummary}</p></article>
        <article class="data-card"><strong>重点行业</strong><p>${workflow.report.industryAnalysis ?? workflow.report.opportunities.join("、")}</p></article>
        <article class="data-card"><strong>关注股票</strong><p>${workflow.report.stockAnalysis}</p></article>
        <article class="data-card"><strong>风险因素</strong><p>${workflow.report.risks.join("；")}</p></article>
        <article class="data-card"><strong>明日观察</strong><p>${workflow.report.tomorrowPlan.join("；")}</p></article>
      </div>
    </section>`;
}
