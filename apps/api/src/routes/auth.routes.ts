import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import * as authService from "../services/auth.service.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const authRouter = Router();

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(120).optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/register",
  validate({ body: registerBody }),
  asyncHandler(async (req, res) => {
    const out = await authService.register(req.body);
    res.status(201).json(out);
  }),
);

authRouter.post(
  "/login",
  validate({ body: loginBody }),
  asyncHandler(async (req, res) => {
    const out = await authService.login(req.body);
    res.json(out);
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.userId!);
    res.json({ user });
  }),
);
