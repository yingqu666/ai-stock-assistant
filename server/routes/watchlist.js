import { Router } from "express";
import {
  addWatchlist,
  deleteWatchlist,
  deleteWatchlistGroup,
  getWatchlist,
  getWatchlistGroups,
  moveWatchlistStock,
  renameWatchlistGroup,
  saveWatchlistGroup,
} from "../db/store.js";
import { requireUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/security.js";
import { cleanStockPayload, cleanString } from "../utils/validation.js";

export const watchlistRouter = Router();

watchlistRouter.use(requireUser);

watchlistRouter.get("/", asyncHandler(async (req, res) => {
  const [items, groups] = await Promise.all([getWatchlist(req.user.id), getWatchlistGroups(req.user.id)]);
  res.json({ ok: true, data: items, groups });
}));

watchlistRouter.post("/", asyncHandler(async (req, res) => {
  const item = await addWatchlist(req.user.id, cleanStockPayload(req.body));
  res.json({ ok: true, data: item });
}));

watchlistRouter.delete("/:idOrCode", asyncHandler(async (req, res) => {
  res.json(await deleteWatchlist(req.user.id, req.params.idOrCode));
}));

watchlistRouter.get("/groups/list", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await getWatchlistGroups(req.user.id) });
}));

watchlistRouter.post("/groups", asyncHandler(async (req, res) => {
  const name = cleanString(req.body?.name, 80);
  if (!name) {
    res.status(400).json({ ok: false, message: "分组名称不能为空" });
    return;
  }
  res.json({ ok: true, data: await saveWatchlistGroup(req.user.id, { name, sortOrder: req.body?.sortOrder }) });
}));

watchlistRouter.put("/groups/:name", asyncHandler(async (req, res) => {
  const newName = cleanString(req.body?.name, 80);
  if (!newName) {
    res.status(400).json({ ok: false, message: "新分组名称不能为空" });
    return;
  }
  res.json(await renameWatchlistGroup(req.user.id, req.params.name, newName));
}));

watchlistRouter.delete("/groups/:name", asyncHandler(async (req, res) => {
  res.json(await deleteWatchlistGroup(req.user.id, req.params.name));
}));

watchlistRouter.put("/:idOrCode/group", asyncHandler(async (req, res) => {
  const groupName = cleanString(req.body?.groupName ?? req.body?.group, 80);
  if (!groupName) {
    res.status(400).json({ ok: false, message: "目标分组不能为空" });
    return;
  }
  const item = await moveWatchlistStock(req.user.id, req.params.idOrCode, groupName);
  res.json({ ok: Boolean(item), data: item, message: item ? "" : "未找到要移动的股票" });
}));
