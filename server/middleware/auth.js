import { getUser } from "../db/store.js";
import { verifyToken } from "../services/tokenService.js";

export async function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const payload = verifyToken(token);
  if (!payload?.userId) {
    res.status(401).json({ ok: false, message: "未登录或登录已过期" });
    return;
  }

  const user = await getUser(payload.userId);
  if (!user) {
    res.status(401).json({ ok: false, message: "用户不存在" });
    return;
  }

  req.user = user;
  next();
}
