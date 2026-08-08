import { Router } from "express";
import { asyncHandler } from "../middleware/security.js";
import { getStockDetail, searchStockCandidates } from "../services/stockService.js";

export const stockRouter = Router();

stockRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = String(req.query.q ?? "").trim();
    const result = await searchStockCandidates(query);
    res.json(result);
  }),
);

stockRouter.get(
  "/detail",
  asyncHandler(async (req, res) => {
    const query = String(req.query.q ?? req.query.code ?? "").trim();
    const result = await getStockDetail(query);
    res.status(result.ok ? 200 : 404).json(result);
  }),
);
