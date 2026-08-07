import { Router } from "express";
import { getInvestmentJournal, saveInvestmentJournal } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";

export const investmentJournalRouter = Router();

investmentJournalRouter.use(requireUser);

investmentJournalRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getInvestmentJournal(req.user.id) });
}));

investmentJournalRouter.post("/", asyncHandler(async (req, res) => {
  const saved = await saveInvestmentJournal(req.user.id, req.body ?? {});
  res.json({ ok: true, data: saved });
}));
