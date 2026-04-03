import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export type AuthPayload = { sub: string };

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    next(new AppError(401, "Authentication required"));
    return;
  }

  try {
    const p = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.userId = p.sub;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
};
