import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/AppError.js";

export const categorizationRouter = Router();
categorizationRouter.use(requireAuth);

const createBody = z.object({
  categoryId: z.string().uuid(),
  pattern: z.string().min(1).max(255),
  priority: z.number().int().optional(),
});

categorizationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await prisma.categorizationRule.findMany({
      where: { userId: req.userId! },
      include: { category: { select: { id: true, name: true, type: true, color: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    res.json({ data: rows });
  }),
);

categorizationRouter.post(
  "/",
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    const cat = await prisma.category.findFirst({
      where: { id: req.body.categoryId, userId: req.userId! },
    });
    if (!cat) throw new AppError(404, "Category not found");

    const r = await prisma.categorizationRule.create({
      data: {
        userId: req.userId!,
        categoryId: req.body.categoryId,
        pattern: req.body.pattern,
        priority: req.body.priority ?? 0,
      },
      include: { category: true },
    });
    res.status(201).json({ data: r });
  }),
);

categorizationRouter.delete(
  "/:id",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const row = await prisma.categorizationRule.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!row) throw new AppError(404, "Rule not found");
    await prisma.categorizationRule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
