import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/AppError.js";

export const accountRouter = Router();
accountRouter.use(requireAuth);

const createBody = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["cash", "bank", "credit", "upi", "wallet", "other"]),
  currency: z.string().max(8).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

const patchBody = z.object({
  name: z.string().min(1).max(100).optional(),
  isArchived: z.boolean().optional(),
});

accountRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await prisma.account.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      data: rows.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        balance: Number(a.balance),
        isArchived: a.isArchived,
        createdAt: a.createdAt,
      })),
    });
  }),
);

accountRouter.post(
  "/",
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    const a = await prisma.account.create({
      data: {
        userId: req.userId!,
        name: req.body.name,
        type: req.body.type,
        currency: req.body.currency ?? "INR",
      },
    });
    res.status(201).json({
      data: {
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        balance: Number(a.balance),
        isArchived: a.isArchived,
      },
    });
  }),
);

accountRouter.patch(
  "/:id",
  validate({ params: idParam, body: patchBody }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new AppError(404, "Account not found");

    const a = await prisma.account.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        isArchived: req.body.isArchived,
      },
    });
    res.json({
      data: {
        id: a.id,
        name: a.name,
        type: a.type,
        balance: Number(a.balance),
        isArchived: a.isArchived,
      },
    });
  }),
);
