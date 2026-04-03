import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import * as insight from "../services/insight.service.js";

export const insightRouter = Router();
insightRouter.use(requireAuth);

const q = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

insightRouter.get(
  "/",
  validate({ query: q }),
  asyncHandler(async (req, res) => {
    const { year, month } = req.query as z.infer<typeof q>;
    const insights = await insight.generateInsights(req.userId!, year, month);
    res.json({ insights });
  }),
);
