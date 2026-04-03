import { prisma } from "../lib/prisma.js";
import { NotificationKind } from "@prisma/client";

export async function runBudgetAlertsAfterExpense(input: {
  userId: string;
  categoryId: string | null;
  occurredAt: Date;
}): Promise<void> {
  if (!input.categoryId) return;

  const y = input.occurredAt.getUTCFullYear();
  const m = input.occurredAt.getUTCMonth() + 1;

  const budget = await prisma.budget.findFirst({
    where: {
      userId: input.userId,
      categoryId: input.categoryId,
      year: y,
      month: m,
    },
  });
  if (!budget) return;

  const agg = await prisma.transaction.aggregate({
    where: {
      userId: input.userId,
      categoryId: input.categoryId,
      type: "expense",
      occurredAt: {
        gte: new Date(Date.UTC(y, m - 1, 1)),
        lt: new Date(Date.UTC(y, m, 1)),
      },
    },
    _sum: { amount: true },
  });

  const spent = Number(agg._sum.amount ?? 0);
  const limit = Number(budget.amountLimit);
  if (limit <= 0) return;

  const ratio = spent / limit;
  const threshold = budget.alertThresholdPercent / 100;

  if (ratio >= 1) {
    await createIfFresh(input.userId, NotificationKind.budget_exceeded, budget.id, "Budget exceeded", {
      categoryId: input.categoryId,
      spent,
      limit,
    });
  } else if (ratio >= threshold) {
    await createIfFresh(input.userId, NotificationKind.budget_warning, budget.id, "Budget threshold reached", {
      categoryId: input.categoryId,
      spent,
      limit,
      thresholdPercent: budget.alertThresholdPercent,
    });
  }
}

async function createIfFresh(
  userId: string,
  type: NotificationKind,
  budgetId: string,
  title: string,
  metadata: Record<string, unknown>,
) {
  const dayKey = new Date().toISOString().slice(0, 10);
  const dedupeTitle = `${title} · ${budgetId} · ${dayKey}`;

  const recent = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      title: dedupeTitle,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recent) return;

  await prisma.notification.create({
    data: {
      userId,
      type,
      title: dedupeTitle,
      body:
        type === NotificationKind.budget_exceeded
          ? `You've passed the budget limit for this category.`
          : `You're approaching the budget limit for this category.`,
      metadata: metadata as object,
    },
  });
}
