import { prisma } from "../lib/prisma.js";
import { pctChange } from "../utils/pct.js";

export async function dashboardSummary(userId: string, year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const [accounts, monthAgg, categoryAgg, prevAgg] = await prisma.$transaction([
    prisma.account.findMany({
      where: { userId, isArchived: false },
      select: { id: true, name: true, type: true, balance: true, currency: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId, occurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
      orderBy: { type: 'asc' }, // Added this
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "expense", occurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
      orderBy: { categoryId: 'asc' }, // Added this
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        userId,
        occurredAt: {
          gte: new Date(Date.UTC(year, month - 2, 1)),
          lt: start,
        },
      },
      _sum: { amount: true },
      orderBy: { type: 'asc' }, // Added this
    }),
  ]);

  const income = Number(monthAgg.find((x) => x.type === "income")?._sum?.amount ?? 0);
  const expense = Number(monthAgg.find((x) => x.type === "expense")?._sum?.amount ?? 0);
  const prevIncome = Number(prevAgg.find((x) => x.type === "income")?._sum?.amount ?? 0);
  const prevExpense = Number(prevAgg.find((x) => x.type === "expense")?._sum?.amount ?? 0);

  const categoryIds = categoryAgg.map((c) => c.categoryId).filter(Boolean) as string[];
  const cats = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const byCategory = categoryAgg
    .filter((c) => c.categoryId)
    .map((c) => ({
      categoryId: c.categoryId as string,
      name: catMap.get(c.categoryId as string)?.name ?? "Unknown",
      color: catMap.get(c.categoryId as string)?.color ?? null,
      total: Number(c._sum?.amount ?? 0),
    }))
    .sort((a, b) => b.total - a.total);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return {
    totalBalance,
    month: { year, month, income, expense, net: income - expense },
    comparison: {
      incomeChangePct: pctChange(prevIncome, income),
      expenseChangePct: pctChange(prevExpense, expense),
    },
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: Number(a.balance),
    })),
    expenseByCategory: byCategory,
  };
}

export async function monthlyTrend(userId: string, monthsBack: number) {
  const safe = Math.min(24, Math.max(1, monthsBack));
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - safe + 1, 1));

  const txs = await prisma.transaction.findMany({
    where: { userId, occurredAt: { gte: start } },
    select: { occurredAt: true, type: true, amount: true },
  });

  const buckets = new Map<string, { income: number; expense: number }>();
  for (const t of txs) {
    const d = t.occurredAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { income: 0, expense: 0 };
    if (t.type === "income") b.income += Number(t.amount);
    else b.expense += Number(t.amount);
    buckets.set(key, b);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({
      period,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
}
