import { Router } from "express";
import { asyncHandler } from "../middleware/security.js";
import { collectMarketData } from "../services/dataCollector.js";

export const marketRouter = Router();

marketRouter.get(
  "/snapshot",
  asyncHandler(async (_req, res) => {
    const data = await collectMarketData().catch((error) => ({
      source: "真实行情获取失败",
      status: "数据不足",
      dataStatus: "数据不足",
      updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      marketOverview: [],
      marketSentiment: {
        summary: `真实行情采集失败：${error.message}`,
        upCount: null,
        downCount: null,
        flatCount: null,
        limitUpCount: null,
        limitDownCount: null,
        totalCount: null,
        turnover: null,
        moneyEffect: "数据不足",
        moneyEffectBasis: "行情接口未返回，无法判断上涨比例、成交活跃度和热点集中程度。",
        riskLevel: "未知",
        failureReason: error.message,
      },
      hotSectors: [],
      sectors: [],
      failureReason: error.message,
    }));
    res.json({ ok: true, data });
  }),
);
