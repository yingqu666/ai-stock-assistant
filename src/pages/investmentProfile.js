import { tagList } from "../components/cards.js";
import {
  capitalOptions,
  getInvestmentProfile,
  holdingPeriodOptions,
  industryOptions,
  riskOptions,
  saveInvestmentProfile,
  styleOptions,
} from "../services/investmentProfileService.js";

export function renderInvestmentProfile() {
  const profile = getInvestmentProfile();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>我的投资档案</h2>
          <span>用于AI日报、AI助手、风险看板的个性化分析</span>
        </div>
      </div>
      <div class="detail-grid">
        <article class="data-card"><strong>投资画像</strong><p>${profile.preference}</p></article>
        <article class="data-card"><strong>风险接受</strong><p>${profile.riskLevel}</p></article>
        <article class="data-card"><strong>当前关注板块</strong>${tagList(profile.industries)}</article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>修改投资画像</h2><span>保存后立即影响AI日报和AI助手</span></div>
      <form class="settings-form investment-profile-form">
        <label>关注板块
          <div class="driver-strip">
            ${industryOptions.map((item) => `
              <label class="check-pill">
                <input type="checkbox" name="industries" value="${item}" ${profile.industries.includes(item) ? "checked" : ""} />
                <span>${item}</span>
              </label>
            `).join("")}
          </div>
        </label>
        <label>投资风格
          <select name="style">${styleOptions.map((item) => `<option value="${item}" ${item === profile.style ? "selected" : ""}>${item}</option>`).join("")}</select>
        </label>
        <label>资金规模
          <select name="capitalSize">${capitalOptions.map((item) => `<option value="${item}" ${item === profile.capitalSize ? "selected" : ""}>${item}</option>`).join("")}</select>
        </label>
        <label>持仓周期
          <select name="holdingPeriod">${holdingPeriodOptions.map((item) => `<option value="${item}" ${item === profile.holdingPeriod ? "selected" : ""}>${item}</option>`).join("")}</select>
        </label>
        <label>风险接受
          <select name="riskLevel">${riskOptions.map((item) => `<option value="${item}" ${item === profile.riskLevel ? "selected" : ""}>${item}</option>`).join("")}</select>
        </label>
        <button type="submit">保存投资档案</button>
      </form>
      <p id="investment-profile-message" class="form-message">更新时间：${profile.updatedAt ?? "暂无"}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>个性化影响</h2><span>AI分析如何使用这些信息</span></div>
      <div class="card-grid">
        ${profile.industries.map((industry) => `<article class="data-card"><strong>${industry}</strong><p>AI日报会优先关注${industry}相关行情、新闻、风险和自选股变化。</p></article>`).join("")}
      </div>
    </section>`;
}

export function mountInvestmentProfile({ rerender }) {
  document.querySelector(".investment-profile-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = saveInvestmentProfile({
      industries: formData.getAll("industries"),
      style: formData.get("style"),
      capitalSize: formData.get("capitalSize"),
      holdingPeriod: formData.get("holdingPeriod"),
      riskLevel: formData.get("riskLevel"),
    });
    const message = document.querySelector("#investment-profile-message");
    if (message) message.textContent = result.message;
    rerender();
  });
}
