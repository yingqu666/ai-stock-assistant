import { Router } from "express";
import { getAIHistory, saveAIHistory } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";

export const aiHistoryRouter = Router();

aiHistoryRouter.use(requireUser);

aiHistoryRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getAIHistory(req.user.id) });
}));

aiHistoryRouter.post("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await saveAIHistory(req.user.id, req.body ?? {}) });
}));
