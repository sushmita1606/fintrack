import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/AppError.js";

export const categoryRouter = Router();
categoryRouter.use(requireAuth);

const createBody = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["income", "expense"]),
  icon: z.string().max(64).optional(),
  color: z.string().max(16).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

categoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await prisma.category.findMany({
      where: { userId: req.userId! },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    res.json({ data: rows });
  }),
);

categoryRouter.post(
  "/",
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    try {
      const c = await prisma.category.create({
        data: {
          userId: req.userId!,
          name: req.body.name,
          type: req.body.type,
          icon: req.body.icon,
          color: req.body.color,
        },
      });
      res.status(201).json({ data: c });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "Category with this name and type already exists");
      }
      throw e;
    }
  }),
);

categoryRouter.delete(
  "/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new AppError(404, "Category not found");
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
