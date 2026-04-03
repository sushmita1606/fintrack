import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/AppError.js";

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get(
  "/",
  validate({
    query: z.object({
      unreadOnly: z.enum(["true", "false"]).optional(),
      limit: z.coerce.number().min(1).max(50).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = Number(req.query.limit ?? 20);

    const rows = await prisma.notification.findMany({
      where: {
        userId: req.userId!,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json({
      data: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.readAt,
        metadata: n.metadata,
        createdAt: n.createdAt,
      })),
    });
  }),
);

notificationRouter.patch(
  "/:id/read",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const row = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!row) throw new AppError(404, "Notification not found");

    const n = await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    res.json({
      data: { id: n.id, readAt: n.readAt },
    });
  }),
);
