import { Router } from "express";
import { deletePortfolio, getPortfolio, savePortfolio } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";
import { cleanPortfolioPayload } from "../utils/validation.js";

export const portfolioRouter = Router();

portfolioRouter.use(requireUser);

portfolioRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getPortfolio(req.user.id) });
}));

portfolioRouter.post("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await savePortfolio(req.user.id, cleanPortfolioPayload(req.body)) });
}));

portfolioRouter.delete("/:id", asyncHandler(async (req, res) => {
  res.json(await deletePortfolio(req.user.id, req.params.id));
}));
