const codeStore = new Map();

export async function sendCode(phone) {
  const provider = process.env.SMS_PROVIDER ?? "mock";
  const code = createCode();

  codeStore.set(phone, {
    phone,
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    provider,
  });

  if (provider === "aliyun") return sendAliyunCode(phone, code);
  if (provider === "tencent") return sendTencentCode(phone, code);

  return {
    ok: true,
    phone,
    provider: "mock",
    message: `模拟验证码：${code}`,
  };
}

export async function verifyCode(phone, code) {
  const record = codeStore.get(phone);
  if (!record || Date.now() > record.expiresAt) {
    return { ok: false, message: "验证码已过期" };
  }
  if (String(code).trim() !== record.code) {
    return { ok: false, message: "验证码不正确" };
  }
  return { ok: true };
}

function createCode() {
  if ((process.env.SMS_PROVIDER ?? "mock") === "mock") return process.env.SMS_MOCK_CODE ?? "888888";
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendAliyunCode(phone, _code) {
  if (!process.env.ALIYUN_SMS_ACCESS_KEY_ID || !process.env.ALIYUN_SMS_ACCESS_KEY_SECRET) {
    return { ok: false, phone, provider: "aliyun", message: "阿里云短信配置不完整" };
  }
  return { ok: true, phone, provider: "aliyun", message: "阿里云短信接口位置已预留，待接入SDK" };
}

async function sendTencentCode(phone, _code) {
  if (!process.env.TENCENT_SMS_SECRET_ID || !process.env.TENCENT_SMS_SECRET_KEY) {
    return { ok: false, phone, provider: "tencent", message: "腾讯云短信配置不完整" };
  }
  return { ok: true, phone, provider: "tencent", message: "腾讯云短信接口位置已预留，待接入SDK" };
}
