import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/AppError.js";

export const savingsGoalRouter = Router();
savingsGoalRouter.use(requireAuth);

const body = z.object({
  name: z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  currentAmount: z.number().nonnegative().optional(),
  accountId: z.string().uuid().nullable().optional(),
  deadline: z.string().nullable().optional(),
});

savingsGoalRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await prisma.savingsGoal.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      data: rows.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
        accountId: g.accountId,
        deadline: g.deadline,
        progress: Math.min(100, Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 1000) / 10),
      })),
    });
  }),
);

savingsGoalRouter.post(
  "/",
  validate({ body: body }),
  asyncHandler(async (req, res) => {
    if (req.body.accountId) {
      const acc = await prisma.account.findFirst({
        where: { id: req.body.accountId, userId: req.userId! },
      });
      if (!acc) throw new AppError(404, "Account not found");
    }

    const g = await prisma.savingsGoal.create({
      data: {
        userId: req.userId!,
        name: req.body.name,
        targetAmount: req.body.targetAmount,
        currentAmount: req.body.currentAmount ?? 0,
        accountId: req.body.accountId ?? null,
        deadline: req.body.deadline ? new Date(req.body.deadline) : null,
      },
    });
    res.status(201).json({
      data: {
        id: g.id,
        name: g.name,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
      },
    });
  }),
);

savingsGoalRouter.patch(
  "/:id",
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: body.partial(),
  }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.savingsGoal.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new AppError(404, "Goal not found");

    const g = await prisma.savingsGoal.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        targetAmount: req.body.targetAmount,
        currentAmount: req.body.currentAmount,
        deadline:
          req.body.deadline === undefined
            ? undefined
            : req.body.deadline
              ? new Date(req.body.deadline)
              : null,
      },
    });
    res.json({
      data: {
        id: g.id,
        name: g.name,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
      },
    });
  }),
);

savingsGoalRouter.delete(
  "/:id",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.savingsGoal.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new AppError(404, "Goal not found");
    await prisma.savingsGoal.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
