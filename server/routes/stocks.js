import { Router } from "express";
import { asyncHandler } from "../middleware/security.js";
import { getResearchData, getResearchSourceStatus } from "../services/researchDataService.js";
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
  "/research",
  asyncHandler(async (req, res) => {
    const query = String(req.query.q ?? req.query.code ?? "").trim();
    const result = await getResearchData(query);
    res.status(result.ok ? 200 : 404).json(result);
  }),
);

stockRouter.get(
  "/research/status",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, data: getResearchSourceStatus() });
  }),
);

stockRouter.get(
  "/detail",
  asyncHandler(async (req, res) => {
    const query = String(req.query.q ?? req.query.code ?? "").trim();
    try {
      const result = await getStockDetail(query);
      if (!result.ok) {
        res.status(200).json(normalizeStockDetailError(result, query));
        return;
      }
      res.json({ success: true, ...result });
    } catch (error) {
      console.warn("[stocks-detail] failed:", { query, error: error.message });
      res.status(200).json({
        ok: false,
        success: false,
        errorCategory: "market_data_error",
        message: "行情暂缺",
        failureReason: error.message,
        source: "股票行情服务",
        status: "数据不足",
        updatedAt: new Date().toISOString(),
        data: null,
      });
    }
  }),
);

function normalizeStockDetailError(result = {}, query = "") {
  return {
    ok: false,
    success: false,
    errorCategory: result.errorCategory ?? "market_data_error",
    message: result.message || "行情暂缺",
    failureReason: result.failureReason ?? result.message ?? `未能获取 ${query} 行情`,
    source: result.source ?? "股票行情服务",
    status: result.status ?? "数据不足",
    updatedAt: result.updatedAt ?? new Date().toISOString(),
    data: result.data ?? null,
  };
}
