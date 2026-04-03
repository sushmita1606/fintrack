import type { RequestHandler } from "express";
import type { AnyZodObject } from "zod";
import { AppError } from "../utils/AppError.js";

type Schemas = { body?: AnyZodObject; query?: AnyZodObject; params?: AnyZodObject };

export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      next();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Validation failed";
      next(new AppError(422, msg));
    }
  };
}
