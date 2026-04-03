import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/AppError.js";

export const budgetRouter = Router();
budgetRouter.use(requireAuth);

const body = z.object({
  categoryId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amountLimit: z.number().nonnegative(),
  alertThresholdPercent: z.number().int().min(0).max(100).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

budgetRouter.get(
  "/",
  validate({
    query: z.object({
      year: z.coerce.number().optional(),
      month: z.coerce.number().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const year = req.query.year as number | undefined;
    const month = req.query.month as number | undefined;
    const where: { userId: string; year?: number; month?: number } = { userId: req.userId! };
    if (year !== undefined) where.year = year;
    if (month !== undefined) where.month = month;

    const rows = await prisma.budget.findMany({
      where,
      include: { category: { select: { id: true, name: true, type: true, color: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    res.json({
      data: rows.map((b) => ({
        id: b.id,
        categoryId: b.categoryId,
        category: b.category,
        year: b.year,
        month: b.month,
        amountLimit: Number(b.amountLimit),
        alertThresholdPercent: b.alertThresholdPercent,
      })),
    });
  }),
);

budgetRouter.post(
  "/",
  validate({ body: body }),
  asyncHandler(async (req, res) => {
    const cat = await prisma.category.findFirst({
      where: { id: req.body.categoryId, userId: req.userId!, type: "expense" },
    });
    if (!cat) throw new AppError(422, "Budget category must be an expense category");

    try {
      const b = await prisma.budget.create({
        data: {
          userId: req.userId!,
          categoryId: req.body.categoryId,
          year: req.body.year,
          month: req.body.month,
          amountLimit: req.body.amountLimit,
          alertThresholdPercent: req.body.alertThresholdPercent ?? 80,
        },
        include: { category: true },
      });
      res.status(201).json({
        data: {
          id: b.id,
          categoryId: b.categoryId,
          category: b.category,
          year: b.year,
          month: b.month,
          amountLimit: Number(b.amountLimit),
          alertThresholdPercent: b.alertThresholdPercent,
        },
      });
    } catch {
      throw new AppError(409, "Budget already exists for this category and month");
    }
  }),
);

budgetRouter.patch(
  "/:id",
  validate({
    params: idParam,
    body: body.partial().omit({ categoryId: true, year: true, month: true }),
  }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new AppError(404, "Budget not found");

    const b = await prisma.budget.update({
      where: { id: req.params.id },
      data: {
        amountLimit: req.body.amountLimit,
        alertThresholdPercent: req.body.alertThresholdPercent,
      },
      include: { category: true },
    });
    res.json({
      data: {
        id: b.id,
        categoryId: b.categoryId,
        category: b.category,
        year: b.year,
        month: b.month,
        amountLimit: Number(b.amountLimit),
        alertThresholdPercent: b.alertThresholdPercent,
      },
    });
  }),
);

budgetRouter.delete(
  "/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new AppError(404, "Budget not found");
    await prisma.budget.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
