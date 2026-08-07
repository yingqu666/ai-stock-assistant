import { loginWithCode, requestLoginCode } from "../services/userService.js";

export function renderLogin() {
  return `
    <main class="login-page">
      <section class="login-panel">
        <div class="brand login-brand">
          <div class="brand-mark">AI</div>
          <div>
            <strong>AI投资研究助手</strong>
            <span>A股研究工作台</span>
          </div>
        </div>
        <h1>手机号登录</h1>
        <p>优先使用云端账号登录；后端不可用时自动回退本地模拟验证码。</p>
        <form class="login-form">
          <label>
            手机号
            <input name="phone" inputmode="tel" maxlength="11" placeholder="请输入 11 位手机号" />
          </label>
          <div class="code-row">
            <label>
              验证码
              <input name="code" inputmode="numeric" maxlength="6" placeholder="888888" />
            </label>
            <button class="secondary-button" data-send-code type="button">获取验证码</button>
          </div>
          <button type="submit">登录</button>
          <p class="form-message" id="login-message"></p>
        </form>
      </section>
    </main>
  `;
}

export function mountLogin({ onSuccess }) {
  const form = document.querySelector(".login-form");
  const message = document.querySelector("#login-message");
  const codeButton = document.querySelector("[data-send-code]");

  codeButton?.addEventListener("click", async () => {
    const formData = new FormData(form);
    if (message) message.textContent = "正在获取验证码...";
    const result = await requestLoginCode(formData.get("phone"));
    if (message) message.textContent = result.message;
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    if (message) message.textContent = "正在登录...";
    const result = await loginWithCode(formData.get("phone"), formData.get("code"));
    if (!result.ok && message) {
      message.textContent = result.message;
      return;
    }
    if (message) message.textContent = result.mode === "cloud" ? "云端登录成功" : "本地离线登录成功";
    onSuccess();
  });
}
