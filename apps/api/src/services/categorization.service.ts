import { prisma } from "../lib/prisma.js";

/** Picks category from user rules: higher priority first, first pattern match in description. */
export async function suggestCategoryId(
  userId: string,
  description: string | undefined,
  type: "income" | "expense",
): Promise<string | undefined> {
  if (!description?.trim()) return undefined;

  const rules = await prisma.categorizationRule.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { priority: "desc" },
  });

  const lower = description.toLowerCase();
  for (const r of rules) {
    if (r.category.type !== type) continue;
    if (lower.includes(r.pattern.toLowerCase())) return r.categoryId;
  }
  return undefined;
}
