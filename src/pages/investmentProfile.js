import { tagList } from "../components/cards.js";
import { getInvestmentProfileData } from "../services/mockService.js";

export function renderInvestmentProfile() {
  const profile = getInvestmentProfileData();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>我的投资档案</h2>
          <span>为未来AI个性化分析准备</span>
        </div>
      </div>
      <div class="detail-grid">
        <article class="data-card"><strong>投资偏好</strong><p>${profile.preference}</p></article>
        <article class="data-card"><strong>风险等级</strong><p>${profile.riskLevel}</p></article>
        <article class="data-card"><strong>当前关注方向</strong>${tagList(profile.focus)}</article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>关注行业</h2><span>模拟配置</span></div>
      <div class="card-grid">
        ${profile.industries.map((industry) => `<article class="data-card"><strong>${industry}</strong><p>后续用于生成个性化日报、风险提醒和自选股跟踪优先级。</p></article>`).join("")}
      </div>
    </section>`;
}
