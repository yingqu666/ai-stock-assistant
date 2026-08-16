import { Router } from "express";
import { asyncHandler } from "../middleware/security.js";
import { collectNewsSnapshot } from "../services/newsService.js";

export const newsRouter = Router();

newsRouter.get(
  "/snapshot",
  asyncHandler(async (_req, res) => {
    const data = await collectNewsSnapshot();
    res.json({ ok: true, data });
  }),
);
