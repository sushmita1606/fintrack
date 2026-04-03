import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import * as txService from "../services/transaction.service.js";

export const transactionRouter = Router();
transactionRouter.use(requireAuth);

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  type: z.enum(["income", "expense"]).optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(["occurredAt", "amount", "createdAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

const createBody = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  occurredAt: z.string().optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).optional(),
  recurrenceEnd: z.string().nullable().optional(),
});

const patchBody = createBody.partial().extend({
  accountId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
});

transactionRouter.get(
  "/",
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const out = await txService.listTransactions(req.userId!, req.query as z.infer<typeof listQuery>);
    res.json(out);
  }),
);

transactionRouter.post(
  "/",
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    const row = await txService.createTransaction(req.userId!, req.body);
    res.status(201).json({ data: row });
  }),
);

transactionRouter.patch(
  "/:id",
  validate({ params: idParam, body: patchBody }),
  asyncHandler(async (req, res) => {
    const row = await txService.updateTransaction(req.userId!, req.params.id, req.body);
    res.json({ data: row });
  }),
);

transactionRouter.delete(
  "/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await txService.deleteTransaction(req.userId!, req.params.id);
    res.status(204).send();
  }),
);
