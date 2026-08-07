import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";
import { getAIReviewStats, reviewUserAIHistory } from "../services/aiReviewService.js";

export const aiReviewRouter = Router();

aiReviewRouter.use(requireUser);

aiReviewRouter.get("/stats", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getAIReviewStats(req.user.id) });
}));

aiReviewRouter.post("/run", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await reviewUserAIHistory(req.user.id, req.body ?? {}) });
}));
