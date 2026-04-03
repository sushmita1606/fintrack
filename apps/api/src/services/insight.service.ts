import { prisma } from "../lib/prisma.js";
import { dashboardSummary } from "./analytics.service.js";

export type InsightItem = { title: string; detail: string; severity: "info" | "warning" | "positive" };

export async function generateInsights(userId: string, year: number, month: number): Promise<InsightItem[]> {
  const summary = await dashboardSummary(userId, year, month);
  const insights: InsightItem[] = [];

  const { income, expense, net } = summary.month;
  if (net < 0) {
    insights.push({
      title: "Spending exceeded income",
      detail: `This month your expenses (${fmt(expense)}) were higher than income (${fmt(income)}). Consider trimming discretionary categories.`,
      severity: "warning",
    });
  } else if (net > 0) {
    insights.push({
      title: "Positive cash flow",
      detail: `You saved about ${fmt(net)} this month after income vs expenses.`,
      severity: "positive",
    });
  }

  const expCmp = summary.comparison.expenseChangePct;
  if (expCmp !== null && expCmp >= 15) {
    insights.push({
      title: "Expenses trending up",
      detail: `Overall spending is about ${expCmp}% higher than last month.`,
      severity: "warning",
    });
  } else if (expCmp !== null && expCmp <= -10) {
    insights.push({
      title: "Spending improved",
      detail: `Overall spending is about ${Math.abs(expCmp)}% lower than last month.`,
      severity: "positive",
    });
  }

  const top = summary.expenseByCategory[0];
  if (top && expense > 0) {
    const share = Math.round((top.total / expense) * 100);
    if (share >= 35) {
      insights.push({
        title: `${top.name} dominates spending`,
        detail: `About ${share}% of expenses went to ${top.name} (${fmt(top.total)}).`,
        severity: "info",
      });
    }
  }

  // Month-over-month top category swing
  const prevStart = new Date(Date.UTC(year, month - 2, 1));
  const prevEnd = new Date(Date.UTC(year, month - 1, 1));
  const currStart = new Date(Date.UTC(year, month - 1, 1));
  const currEnd = new Date(Date.UTC(year, month, 1));

  const [prevCat, currCat] = await prisma.$transaction([
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "expense", occurredAt: { gte: prevStart, lt: prevEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "expense", occurredAt: { gte: currStart, lt: currEnd } },
      _sum: { amount: true },
    }),
  ]);

  const catIds = [...new Set([...prevCat, ...currCat].map((c) => c.categoryId).filter(Boolean))] as string[];
  const cats = await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true },
  });
  const names = new Map(cats.map((c) => [c.id, c.name]));

  for (const c of currCat) {
    if (!c.categoryId) continue;
    const prev = prevCat.find((p) => p.categoryId === c.categoryId);
    const prevAmt = Number(prev?._sum.amount ?? 0);
    const currAmt = Number(c._sum.amount ?? 0);
    if (prevAmt === 0 && currAmt > 0) continue;
    if (prevAmt === 0) continue;
    const pct = Math.round(((currAmt - prevAmt) / prevAmt) * 100);
    if (pct >= 25) {
      insights.push({
        title: `Spending on ${names.get(c.categoryId) ?? "a category"} rose sharply`,
        detail: `About ${pct}% more than last month (${fmt(prevAmt)} → ${fmt(currAmt)}).`,
        severity: "warning",
      });
      break;
    }
  }

  if (insights.length === 0) {
    insights.push({
      title: "Steady month",
      detail: "No major anomalies detected. Keep logging transactions for richer insights.",
      severity: "info",
    });
  }

  return insights;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
