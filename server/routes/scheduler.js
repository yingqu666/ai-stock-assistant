import { Router } from "express";
import { getSchedulerStatus, runReviewTask, runScheduledReport } from "../scheduler/reportScheduler.js";
import { asyncHandler } from "../middleware/security.js";

export const schedulerRouter = Router();

schedulerRouter.get("/status", (_req, res) => {
  res.json({ ok: true, data: getSchedulerStatus() });
});

schedulerRouter.post(
  "/run/:type",
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    if (type === "review") {
      res.json({ ok: true, data: await runReviewTask() });
      return;
    }
    if (type !== "morning" && type !== "close") {
      res.status(400).json({ ok: false, message: "type must be morning, close, or review" });
      return;
    }
    runScheduledReport(type).catch((error) => {
      console.error("[scheduler-manual-run-error]", error);
    });
    res.json({ ok: true, data: { accepted: true, type, message: "报告生成任务已进入后台执行" } });
  }),
);
