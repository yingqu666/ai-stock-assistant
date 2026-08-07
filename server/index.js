import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { initDatabase, getDatabaseMode, getDatabaseStatus } from "./db/store.js";
import { aiRouter } from "./routes/ai.js";
import { aiHistoryRouter } from "./routes/aiHistory.js";
import { aiReviewRouter } from "./routes/aiReview.js";
import { authRouter } from "./routes/auth.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { reportRouter } from "./routes/reports.js";
import { settingsRouter } from "./routes/settings.js";
import { stockRouter } from "./routes/stocks.js";
import { watchlistRouter } from "./routes/watchlist.js";
import { knowledgeRouter } from "./routes/knowledge.js";
import { investmentJournalRouter } from "./routes/investmentJournal.js";
import { schedulerRouter } from "./routes/scheduler.js";
import { announcementRouter } from "./routes/announcements.js";
import { startReportScheduler } from "./scheduler/reportScheduler.js";
import { errorHandler, notFound, rateLimit, securityHeaders } from "./middleware/security.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const rootDir = process.cwd();

app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(rateLimit({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000), max: Number(process.env.RATE_LIMIT_MAX ?? 120) }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ai-investment-workbench-api",
    database: getDatabaseMode(),
    time: new Date().toISOString(),
  });
});

app.get("/api/db-status", async (_req, res) => {
  const status = await getDatabaseStatus();
  res.json({
    mode: status.mode,
    connected: status.connected,
    tables: status.tables,
  });
});

app.use("/api", authRouter);
app.use("/api/stocks", stockRouter);
app.use("/api/watchlist", watchlistRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/reports", reportRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/investment-journal", investmentJournalRouter);
app.use("/api/scheduler", schedulerRouter);
app.use("/api/announcements", announcementRouter);
app.use("/api/ai-history", aiHistoryRouter);
app.use("/api/ai", aiRouter);
app.use("/api/ai-review", aiReviewRouter);

app.use("/api", notFound);
app.use(
  express.static(rootDir, {
    index: "index.html",
    extensions: ["html"],
  }),
);
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(rootDir, "index.html"));
});
app.use(errorHandler);

if (process.env.ENABLE_SCHEDULER !== "false") {
  startReportScheduler();
}

await initDatabase();

app.listen(port, () => {
  console.log(`AI investment backend listening on http://localhost:${port}`);
  console.log(`Database mode: ${getDatabaseMode()}`);
});
