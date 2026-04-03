import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { message: err.message, code: err.code },
    });
    return;
  }

  const message = env.NODE_ENV === "production" ? "Internal server error" : err.message;
  console.error(err);
  res.status(500).json({ error: { message } });
};
