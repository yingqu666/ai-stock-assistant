import { createHmac, timingSafeEqual } from "node:crypto";

const tokenVersion = "v1";

export function signToken(payload) {
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    }),
  );
  const signature = sign(body);
  return `${tokenVersion}.${body}.${signature}`;
}

export function verifyToken(token) {
  const [version, body, signature] = String(token ?? "").split(".");
  if (version !== tokenVersion || !body || !signature) return null;
  const expected = sign(body);
  if (!safeEqual(signature, expected)) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function sign(body) {
  return createHmac("sha256", process.env.JWT_SECRET ?? "dev-only-secret")
    .update(body)
    .digest("base64url");
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
