import type { NextFunction, Request, Response } from "express";
import { AppError, ConflictError } from "../errors/AppError.js";

/** Catch-all for requests that matched no route. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ message: "Route not found." });
}

/**
 * Maps known error types to JSON responses. Anything unrecognised is passed on
 * to Express's default handler, exactly as before.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.status).json(error.payload);
    return;
  }
  const named = error as { name?: string; issues?: unknown; errors?: unknown };
  // ** Concurrency: a guarded save() whose pinned updatedAt no longer matches
  // ** (see services/concurrencyService.ts guardFresh) surfaces here as a 409.
  if (named?.name === "DocumentNotFoundError") {
    const stale = new ConflictError();
    res.status(stale.status).json(stale.payload);
    return;
  }
  if (named?.name === "ZodError") {
    res.status(400).json({
      message: "Please correct the highlighted fields.",
      errors: named.issues || named.errors,
    });
    return;
  }
  next(error);
}
