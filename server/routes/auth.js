import { Router } from "express";
import { createUser } from "../db/store.js";
import { asyncHandler } from "../middleware/security.js";
import { sendCode, verifyCode } from "../services/smsService.js";
import { signToken } from "../services/tokenService.js";
import { assertPhone } from "../utils/validation.js";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { phone, code, action } = req.body ?? {};
  assertPhone(phone);

  if (action === "sendCode") {
    res.json(await sendCode(phone));
    return;
  }

  const verification = await verifyCode(phone, code);
  if (!verification.ok) {
    res.status(401).json(verification);
    return;
  }

  const user = await createUser(phone);
  const token = signToken({ userId: user.id, phone: user.phone });
  res.json({ ok: true, user, token });
}));

authRouter.post("/logout", (_req, res) => {
  res.json({ ok: true });
});
