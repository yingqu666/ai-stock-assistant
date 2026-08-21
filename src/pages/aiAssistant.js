import { saveAiAnswerFeedback } from "../services/aiService.js";
import { askAiAssistant, getAiAssistantContext } from "../services/mockService.js";

const quickQuestions = [
  "现在AI板块怎么看？",
  "半导体趋势如何？",
  "宏景科技风险是什么？",
  "我的组合风险在哪里？",
  "明天关注方向？",
];

let lastAnswer = null;

export async function renderAiAssistant() {
  const context = await getAiAssistantContext();

  return `
    <section class="wide-section">
      <div class="section-head">
        <div>
          <h2>AI助手</h2>
          <span>定位：个人A股投资研究分析师。回答会结合市场、自选股、投资档案、行业热点和风险信息。</span>
        </div>
      </div>
      <div class="driver-strip quick-question-strip">${quickQuestions.map((item) => `<button class="secondary-button quick-question" data-question="${item}" type="button">${item}</button>`).join("")}</div>
      <form class="stock-search ai-chat-form compact">
        <input name="question" placeholder="例如：现在AI板块怎么看？分析贵州茅台。我的组合风险？" />
        <button type="submit">提问</button>
      </form>
      <p id="ai-chat-message" class="form-message"></p>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>当前上下文</h2><span>AI回答依据</span></div>
      <div class="detail-grid">
        <article class="data-card"><strong>市场</strong><p>${context.market.marketSentiment.summary}</p></article>
        <article class="data-card"><strong>行业热点</strong><p>${(context.market.hotSectors ?? []).map((item) => item.name).slice(0, 4).join("、")}</p></article>
        <article class="data-card"><strong>关注板块</strong><p>${context.profile.industries.join("、")}</p></article>
        <article class="data-card"><strong>自选股</strong><p>${(context.watchlist ?? []).map((item) => item.name).slice(0, 5).join("、") || "暂无"}</p></article>
        <article class="data-card"><strong>风险接受</strong><p>${context.profile.riskLevel} · ${context.profile.style} · ${context.profile.holdingPeriod}</p></article>
        <article class="data-card"><strong>历史报告</strong><p>${context.reports.length} 份已保存报告</p></article>
      </div>
    </section>

    <section class="wide-section">
      <div class="section-head"><h2>回答</h2><span>不构成投资建议</span></div>
      <pre id="ai-chat-answer" class="answer">请输入问题后生成回答。</pre>
      <div class="row-actions feedback-actions" style="display:none">
        <button id="feedback-good" class="secondary-button" type="button">有用 👍</button>
        <button id="feedback-bad" class="secondary-button" type="button">无帮助 👎</button>
      </div>
      <p id="ai-feedback-message" class="form-message"></p>
    </section>`;
}

export function mountAiAssistant() {
  const form = document.querySelector(".ai-chat-form");
  const input = form?.querySelector("input");
  const message = document.querySelector("#ai-chat-message");
  const answer = document.querySelector("#ai-chat-answer");
  const feedbackActions = document.querySelector(".feedback-actions");
  const feedbackMessage = document.querySelector("#ai-feedback-message");

  async function ask(question) {
    if (!question.trim()) {
      if (message) message.textContent = "请输入问题。";
      return;
    }
    if (message) message.textContent = "正在整合市场、自选股、行业热点、投资档案和风险信息...";
    const result = await askAiAssistant(question);
    lastAnswer = result;
    if (answer) answer.textContent = result.answer;
    if (message) message.textContent = formatAiSourceLine(result);
    if (feedbackActions) feedbackActions.style.display = "flex";
    if (feedbackMessage) feedbackMessage.textContent = "";
  }

  async function submitFeedback(rating) {
    if (!lastAnswer) return;
    if (feedbackMessage) feedbackMessage.textContent = "正在保存反馈...";
    const result = await saveAiAnswerFeedback({
      question: lastAnswer.question,
      answer: lastAnswer.answer,
      rating,
      feedback: rating > 0 ? "有用" : "无帮助",
      source: lastAnswer.source,
      context: lastAnswer.context ?? {},
    });
    if (feedbackMessage) feedbackMessage.textContent = result.ok === false ? `反馈保存失败：${result.message}` : "反馈已保存，用于后续优化。";
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    await ask(String(formData.get("question") ?? ""));
  });

  document.querySelectorAll(".quick-question").forEach((button) => {
    button.addEventListener("click", async () => {
      if (input) input.value = button.dataset.question;
      await ask(button.dataset.question);
    });
  });

  document.querySelector("#feedback-good")?.addEventListener("click", () => submitFeedback(1));
  document.querySelector("#feedback-bad")?.addEventListener("click", () => submitFeedback(-1));
}

function formatAiSourceLine(result = {}) {
  const source = result.source ?? (result.aiStatus?.source === "deepseek" ? "DeepSeek" : "fallback");
  const failure = result.failureReason ?? result.aiStatus?.errorMessage ?? "";
  const category = result.errorCategory ?? result.aiStatus?.errorCategory ?? "";
  const dataSource = result.context?.market?.source ?? result.context?.market?.dataSource ?? "市场/自选股/新闻上下文";
  return [
    `AI来源：${source}`,
    failure ? `失败原因：${failure}` : "",
    category ? `错误类型：${category}` : "",
    `数据来源：${dataSource}`,
  ].filter(Boolean).join(" · ");
}
