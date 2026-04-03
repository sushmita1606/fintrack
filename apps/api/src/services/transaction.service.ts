import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { suggestCategoryId } from "./categorization.service.js";
import { runBudgetAlertsAfterExpense } from "./budgetAlerts.service.js";

const MAX_PAGE = 100;

export async function listTransactions(
  userId: string,
  q: {
    page?: number;
    limit?: number;
    type?: "income" | "expense";
    accountId?: string;
    categoryId?: string;
    from?: string;
    to?: string;
    sort?: "occurredAt" | "amount" | "createdAt";
    order?: "asc" | "desc";
  },
) {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(MAX_PAGE, Math.max(1, q.limit ?? 20));
  const where: Prisma.TransactionWhereInput = { userId };
  if (q.type) where.type = q.type;
  if (q.accountId) where.accountId = q.accountId;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.from || q.to) {
    where.occurredAt = {};
    if (q.from) where.occurredAt.gte = new Date(q.from);
    if (q.to) where.occurredAt.lte = new Date(q.to);
  }

  const sortField = q.sort ?? "occurredAt";
  const order = q.order ?? "desc";

  const [total, rows] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
      include: { category: true, account: { select: { id: true, name: true, type: true } } },
    }),
  ]);

  return {
    data: rows.map(serializeTx),
    meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function createTransaction(
  userId: string,
  input: {
    accountId: string;
    type: "income" | "expense";
    amount: number;
    description?: string;
    notes?: string;
    categoryId?: string;
    occurredAt?: string;
    recurrence?: "none" | "daily" | "weekly" | "monthly" | "yearly";
    recurrenceEnd?: string | null;
  },
) {
  if (input.amount <= 0) throw new AppError(422, "Amount must be positive");

  let categoryId = input.categoryId ?? null;
  if (!categoryId) {
    const guess = await suggestCategoryId(userId, input.description, input.type);
    categoryId = guess ?? null;
  }

  if (categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, userId, type: input.type },
    });
    if (!cat) throw new AppError(422, "Invalid category for transaction type");
  }

  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId, isArchived: false },
  });
  if (!account) throw new AppError(404, "Account not found");

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const rec = input.recurrence ?? "none";
  const recurrenceEnd = input.recurrenceEnd ? new Date(input.recurrenceEnd) : null;

  const tx = await prisma.$transaction(async (db) => {
    const t = await db.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        categoryId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        notes: input.notes,
        occurredAt,
        recurrence: rec,
        recurrenceEnd,
      },
      include: { category: true, account: { select: { id: true, name: true, type: true } } },
    });

    const delta = input.type === "income" ? input.amount : -input.amount;
    await db.account.update({
      where: { id: input.accountId },
      data: { balance: { increment: delta } },
    });

    return t;
  });

  if (input.type === "expense" && categoryId) {
    await runBudgetAlertsAfterExpense({
      userId,
      categoryId,
      occurredAt,
    });
  }

  return serializeTx(tx);
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: Partial<{
    accountId: string;
    type: "income" | "expense";
    amount: number;
    description: string | null;
    notes: string | null;
    categoryId: string | null;
    occurredAt: string;
    recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
    recurrenceEnd: string | null;
  }>,
) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, "Transaction not found");

  if (input.amount !== undefined && input.amount <= 0) {
    throw new AppError(422, "Amount must be positive");
  }

  const nextType = input.type ?? existing.type;
  const nextAmount = input.amount ?? Number(existing.amount);
  const nextAccountId = input.accountId ?? existing.accountId;
  const nextCategoryId =
    input.categoryId === undefined ? existing.categoryId : input.categoryId;
  const nextOccurredAt =
    input.occurredAt !== undefined ? new Date(input.occurredAt) : existing.occurredAt;

  if (nextCategoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: nextCategoryId, userId, type: nextType },
    });
    if (!cat) throw new AppError(422, "Invalid category for transaction type");
  }

  const account = await prisma.account.findFirst({
    where: { id: nextAccountId, userId, isArchived: false },
  });
  if (!account) throw new AppError(404, "Account not found");

  const result = await prisma.$transaction(async (db) => {
    const oldSigned =
      existing.type === "income" ? Number(existing.amount) : -Number(existing.amount);
    const newSigned = nextType === "income" ? nextAmount : -nextAmount;

    if (existing.accountId === nextAccountId) {
      const diff = newSigned - oldSigned;
      if (diff !== 0) {
        await db.account.update({
          where: { id: nextAccountId },
          data: { balance: { increment: diff } },
        });
      }
    } else {
      await db.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: -oldSigned } },
      });
      await db.account.update({
        where: { id: nextAccountId },
        data: { balance: { increment: newSigned } },
      });
    }

    const t = await db.transaction.update({
      where: { id },
      data: {
        accountId: nextAccountId,
        type: nextType,
        amount: nextAmount,
        description: input.description === undefined ? undefined : input.description,
        notes: input.notes === undefined ? undefined : input.notes,
        categoryId: input.categoryId === undefined ? undefined : nextCategoryId,
        occurredAt: input.occurredAt === undefined ? undefined : nextOccurredAt,
        recurrence: input.recurrence,
        recurrenceEnd:
          input.recurrenceEnd === undefined
            ? undefined
            : input.recurrenceEnd
              ? new Date(input.recurrenceEnd)
              : null,
      },
      include: { category: true, account: { select: { id: true, name: true, type: true } } },
    });
    return t;
  });

  if (nextType === "expense" && nextCategoryId) {
    await runBudgetAlertsAfterExpense({
      userId,
      categoryId: nextCategoryId,
      occurredAt: nextOccurredAt,
    });
  }

  return serializeTx(result);
}

export async function deleteTransaction(userId: string, id: string) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, "Transaction not found");

  const signed = existing.type === "income" ? Number(existing.amount) : -Number(existing.amount);

  await prisma.$transaction([
    prisma.account.update({
      where: { id: existing.accountId },
      data: { balance: { increment: -signed } },
    }),
    prisma.transaction.delete({ where: { id } }),
  ]);
}

function serializeTx(t: {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: string;
  amount: unknown;
  description: string | null;
  notes: string | null;
  occurredAt: Date;
  recurrence: string;
  recurrenceEnd: Date | null;
  createdAt: Date;
  category: { id: string; name: string; type: string; color: string | null } | null;
  account: { id: string; name: string; type: string };
}) {
  return {
    id: t.id,
    accountId: t.accountId,
    categoryId: t.categoryId,
    type: t.type,
    amount: Number(t.amount),
    description: t.description,
    notes: t.notes,
    occurredAt: t.occurredAt.toISOString().slice(0, 10),
    recurrence: t.recurrence,
    recurrenceEnd: t.recurrenceEnd ? t.recurrenceEnd.toISOString().slice(0, 10) : null,
    createdAt: t.createdAt,
    category: t.category,
    account: t.account,
  };
}
