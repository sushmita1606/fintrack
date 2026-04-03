import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const SALT_ROUNDS = 12;

const DEFAULT_EXPENSE = [
  { name: "Food", color: "#f97316", icon: "utensils" },
  { name: "Transport", color: "#3b82f6", icon: "car" },
  { name: "Shopping", color: "#a855f7", icon: "bag" },
  { name: "Bills", color: "#ef4444", icon: "file" },
  { name: "Entertainment", color: "#ec4899", icon: "film" },
  { name: "Other", color: "#64748b", icon: "more" },
] as const;

const DEFAULT_INCOME = [
  { name: "Salary", color: "#22c55e", icon: "briefcase" },
  { name: "Freelance", color: "#14b8a6", icon: "laptop" },
  { name: "Other", color: "#84cc16", icon: "more" },
] as const;

export async function register(input: { email: string; password: string; name?: string }) {
  const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (exists) throw new AppError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
      },
    });

    await tx.account.create({
      data: {
        userId: u.id,
        name: "Cash",
        type: "cash",
        currency: "INR",
      },
    });

    await tx.category.createMany({
      data: [
        ...DEFAULT_EXPENSE.map((c) => ({
          userId: u.id,
          name: c.name,
          type: "expense" as const,
          color: c.color,
          icon: c.icon,
          isDefault: true,
        })),
        ...DEFAULT_INCOME.map((c) => ({
          userId: u.id,
          name: c.name,
          type: "income" as const,
          color: c.color,
          icon: c.icon,
          isDefault: true,
        })),
      ],
    });

    return u;
  });

  const token = signToken(user);
  return { user: toPublicUser(user), token };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (!user?.passwordHash) throw new AppError(401, "Invalid email or password");

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new AppError(401, "Invalid email or password");

  const token = signToken(user);
  return { user: toPublicUser(user), token };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");
  return toPublicUser(user);
}

function signToken(user: User) {
  return jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    themePref: user.themePref,
    createdAt: user.createdAt,
  };
}
