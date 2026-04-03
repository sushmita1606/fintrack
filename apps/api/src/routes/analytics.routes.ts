import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import * as analytics from "../services/analytics.service.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const monthQuery = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

analyticsRouter.get(
  "/summary",
  validate({ query: monthQuery }),
  asyncHandler(async (req, res) => {
    const { year, month } = req.query as z.infer<typeof monthQuery>;
    const summary = await analytics.dashboardSummary(req.userId!, year, month);
    res.json(summary);
  }),
);

analyticsRouter.get(
  "/trend",
  validate({
    query: z.object({ months: z.coerce.number().min(1).max(24).optional() }),
  }),
  asyncHandler(async (req, res) => {
    const months = Number(req.query.months ?? 6);
    const trend = await analytics.monthlyTrend(req.userId!, months);
    res.json({ data: trend });
  }),
);
