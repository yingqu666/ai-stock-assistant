import { Router } from "express";
import { getKnowledge, saveKnowledge } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";

export const knowledgeRouter = Router();

knowledgeRouter.use(requireUser);

knowledgeRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getKnowledge(req.user.id) });
}));

knowledgeRouter.post("/", asyncHandler(async (req, res) => {
  const saved = await saveKnowledge(req.user.id, req.body ?? {});
  res.json({ ok: true, data: saved });
}));
