import { Router } from "express";
import { getSettings, saveSettings } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";
import { cleanSettingsPayload } from "../utils/validation.js";

export const settingsRouter = Router();

settingsRouter.use(requireUser);

settingsRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getSettings(req.user.id) });
}));

settingsRouter.post("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await saveSettings(req.user.id, cleanSettingsPayload(req.body)) });
}));
