import type {
  NextFunction,
  Request,
  RequestHandler,
  RequestParamHandler,
  Response,
} from "express";
import { ValidationError } from "../errors/AppError.js";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * For `router.param("id", objectIdParam)`. Runs only when the matched route
 * declares that param, and only after earlier `router.use` auth layers.
 */
export const objectIdParam: RequestParamHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  value: unknown,
): void => {
  if (typeof value === "string" && OBJECT_ID.test(value)) {
    next();
    return;
  }
  next(new ValidationError("Invalid identifier."));
};

/**
 * Per-route variant for routers whose auth is attached route by route. Checks
 * only the named params that are present on the request.
 */
export function validateObjectIdParams(...names: string[]): RequestHandler {
  return (req, res, next) => {
    for (const name of names) {
      const value = req.params[name];
      if (value !== undefined && !OBJECT_ID.test(String(value))) {
        next(new ValidationError("Invalid identifier."));
        return;
      }
    }
    next();
  };
}
