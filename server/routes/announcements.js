import express from "express";
import { analyzeAnnouncements } from "../services/announcementService.js";
import { requireUser } from "../middleware/auth.js";

export const announcementRouter = express.Router();

announcementRouter.post("/analyze", requireUser, (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  res.json({
    ok: true,
    count: events.length,
    items: analyzeAnnouncements(events),
  });
});
