import { Router } from "express";
import { addWatchlist, deleteWatchlist, getWatchlist } from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";
import { cleanStockPayload } from "../utils/validation.js";

export const watchlistRouter = Router();

watchlistRouter.use(requireUser);

watchlistRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getWatchlist(req.user.id) });
}));

watchlistRouter.post("/", asyncHandler(async (req, res) => {
  const item = await addWatchlist(req.user.id, cleanStockPayload(req.body));
  res.json({ ok: true, data: item });
}));

watchlistRouter.delete("/:idOrCode", asyncHandler(async (req, res) => {
  res.json(await deleteWatchlist(req.user.id, req.params.idOrCode));
}));
