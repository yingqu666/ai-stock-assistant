import { clearRefreshLogs, getSettingsData } from "../services/mockService.js";
import { getAiConfig, getAiStatus, saveAiConfig, testAiConnection } from "../services/aiService.js";
import { getInvestmentProfile, saveInvestmentProfile } from "../services/databaseService.js";
import { saveSyncedSettings, syncSettings } from "../services/syncService.js";

const modelOptions = [
  { value: "gpt-4.1-mini", label: "GPT 轻量模型" },
  { value: "gpt-4.1", label: "GPT 高质量模型" },
  { value: "qwen-plus", label: "国产模型：通义千问" },
  { value: "deepseek-chat", label: "国产模型：DeepSeek" },
  { value: "custom", label: "自定义 OpenAI 兼容接口" },
];

export async function renderSettings() {
  const { integrationPlan, logs } = getSettingsData();
  const aiConfig = getAiConfig();
  const aiStatus = await getAiStatus();
  const syncedSettings = await syncSettings({ localLoad: getInvestmentProfile, localSave: saveInvestmentProfile });
  const profile = syncedSettings.data ?? await getInvestmentProfile();
  const industriesText = Array.isArray(profile.industries) ? profile.industries.join("、") : "";

  return `
    <section class="wide-section">
      <div class="section-head"><h2>系统设置</h2><span>数据源、AI模型和运行状态</span></div>
      <div class="card-grid">
        ${integrationPlan.map((item) => `
          <article class="data-card">
            <div class="card-head"><strong>${item.name}</strong><b>${item.status}</b></div>
            <p>${item.sources}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>个性化设置</h2><span>影响AI分析偏好</span></div>
      <form class="settings-form profile-settings-form">
        <label>数据刷新频率
          <select name="refreshInterval">
            <option value="15" ${Number(profile.refreshInterval) === 15 ? "selected" : ""}>15分钟</option>
            <option value="30" ${Number(profile.refreshInterval ?? 30) === 30 ? "selected" : ""}>30分钟</option>
            <option value="60" ${Number(profile.refreshInterval) === 60 ? "selected" : ""}>60分钟</option>
          </select>
        </label>
        <label>关注行业<input name="industries" value="${industriesText}" placeholder="AI、半导体、新能源、电力" /></label>
        <label>风险偏好
          <select name="riskLevel">
            <option value="低" ${profile.riskLevel === "低" ? "selected" : ""}>低</option>
            <option value="中" ${profile.riskLevel === "中" || profile.riskLevel === "中等" ? "selected" : ""}>中</option>
            <option value="高" ${profile.riskLevel === "高" ? "selected" : ""}>高</option>
          </select>
        </label>
        <button type="submit">保存个性化设置</button>
      </form>
      <p id="profile-settings-message" class="form-message">当前关注行业：${industriesText || "未设置"}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>AI模型管理</h2><span>当前AI状态：${aiStatus.label}</span></div>
      <div class="metrics">
        ${[
          { label: "AI运行模式", value: aiStatus.mode === "api" ? "API模式" : "Fallback模式", change: aiStatus.provider },
          { label: "当前模型", value: aiStatus.model ?? aiConfig.model ?? "未配置", change: aiStatus.hasApiKey ? "Key已配置" : "Key未配置" },
          { label: "最近调用", value: aiStatus.lastCallAt ? new Date(aiStatus.lastCallAt).toLocaleString("zh-CN", { hour12: false }) : "暂无", change: aiStatus.lastDurationMs ? `${aiStatus.lastDurationMs}ms` : "未调用" },
          { label: "失败原因", value: aiStatus.lastFailureReason || "无", change: aiStatus.lastSuccessAt ? `最近成功：${new Date(aiStatus.lastSuccessAt).toLocaleString("zh-CN", { hour12: false })}` : "暂无成功记录" },
        ].map((item) => `<article class="metric-card"><span>${item.label}</span><strong>${item.value}</strong><em>${item.change}</em></article>`).join("")}
      </div>
      <form class="settings-form ai-config-form">
        <label>AI模式
          <select name="mode">
            <option value="fallback" ${aiConfig.mode !== "api" ? "selected" : ""}>fallback</option>
            <option value="api" ${aiConfig.mode === "api" ? "selected" : ""}>API模式</option>
          </select>
        </label>
        <label>模型类型
          <select name="provider">
            <option value="openai-compatible" ${aiConfig.provider !== "china-compatible" ? "selected" : ""}>OpenAI兼容</option>
            <option value="china-compatible" ${aiConfig.provider === "china-compatible" ? "selected" : ""}>国内模型接口</option>
            <option value="fallback" ${aiConfig.provider === "fallback" ? "selected" : ""}>fallback</option>
          </select>
        </label>
        <label>模型名称
          <select name="modelPreset">
            ${modelOptions.map((item) => `<option value="${item.value}" ${aiConfig.model === item.value ? "selected" : ""}>${item.label}</option>`).join("")}
          </select>
        </label>
        <label>自定义模型名称<input name="model" value="${aiConfig.model ?? ""}" placeholder="例如 gpt-4.1-mini、qwen-plus、deepseek-chat" /></label>
        <label>API地址<input name="endpoint" value="${aiConfig.endpoint ?? ""}" placeholder="OpenAI-compatible chat completions endpoint" /></label>
        <label>API Key<input name="apiKey" type="password" placeholder="${aiConfig.hasApiKey || aiConfig.apiKey ? "已保存，留空不修改" : "不要写入代码，只保存在浏览器本地"}" /></label>
        <div class="row-actions">
          <button type="submit">保存AI配置</button>
          <button id="test-ai-button" class="secondary-button" type="button">测试AI连接</button>
        </div>
      </form>
      <p id="ai-config-message" class="form-message">当前AI模式：${aiConfig.mode ?? "fallback"}</p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>数据运行日志</h2><button id="clear-log-button" class="secondary-button" type="button">清空日志</button></div>
      <div class="table">
        ${logs.slice(0, 20).map((log) => `<div class="table-row"><b>${log.module}</b><span>${log.status}</span><span>${log.mode}</span><em>${log.time} · ${log.source}</em></div>`).join("") || "<p class='form-message'>暂无日志，刷新数据后会自动记录。</p>"}
      </div>
    </section>`;
}

export function mountSettings({ rerender }) {
  const form = document.querySelector(".ai-config-form");
  const message = document.querySelector("#ai-config-message");

  function readConfig() {
    const formData = new FormData(form);
    const preset = String(formData.get("modelPreset") ?? "");
    const customModel = String(formData.get("model") ?? "").trim();
    return {
      mode: String(formData.get("mode") ?? "fallback"),
      provider: String(formData.get("provider") ?? "openai-compatible"),
      endpoint: String(formData.get("endpoint") ?? ""),
      model: customModel || (preset === "custom" ? "" : preset),
      apiKey: String(formData.get("apiKey") ?? ""),
    };
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = saveAiConfig(readConfig());
    if (message) message.textContent = `AI配置已保存，当前模式：${result.mode}，模型：${result.model || "未配置"}`;
  });

  document.querySelector("#test-ai-button")?.addEventListener("click", async () => {
    if (message) message.textContent = "正在测试AI连接...";
    const result = await testAiConnection(readConfig());
    if (message) message.textContent = result.message;
  });

  document.querySelector("#clear-log-button")?.addEventListener("click", () => {
    clearRefreshLogs();
    rerender();
  });

  document.querySelector(".profile-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const profile = {
      preference: "自定义偏好",
      industries: String(formData.get("industries") ?? "").split(/[、，,\s]+/).filter(Boolean),
      riskLevel: String(formData.get("riskLevel") ?? "中"),
      refreshInterval: Number(formData.get("refreshInterval") ?? 30),
    };
    await saveSyncedSettings({ ...profile, aiMode: readConfig().mode }, { localSave: saveInvestmentProfile });
    const profileMessage = document.querySelector("#profile-settings-message");
    if (profileMessage) profileMessage.textContent = `个性化设置已保存：${profile.industries.join("、")} · 风险偏好 ${profile.riskLevel}`;
  });
}
