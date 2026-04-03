import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pino from 'pino-http';
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";

import { authRouter } from "./routes/auth.routes.js";
import { accountRouter } from "./routes/account.routes.js";
import { categoryRouter } from "./routes/category.routes.js";
import { categorizationRouter } from "./routes/categorization.routes.js";
import { transactionRouter } from "./routes/transaction.routes.js";
import { budgetRouter } from "./routes/budget.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { insightRouter } from "./routes/insight.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { savingsGoalRouter } from "./routes/savingsGoal.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use((pino as any)({ level: env.NODE_ENV === "development" ? "debug" : "info" }));
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "512kb" }));

  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: { message: "Too many attempts" } },
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/accounts", accountRouter);
  app.use("/api/categories", categoryRouter);
  app.use("/api/categorization-rules", categorizationRouter);
  app.use("/api/transactions", transactionRouter);
  app.use("/api/budgets", budgetRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/insights", insightRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/savings-goals", savingsGoalRouter);

  app.use(errorHandler);
  return app;
}
