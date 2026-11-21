import { AppError, ConflictError } from "../errors/AppError.js";

/** Catch-all for requests that matched no route. */
export function notFoundHandler(req, res) {
  res.status(404).json({ message: "Route not found." });
}

/**
 * Maps known error types to JSON responses. Anything unrecognised is logged and
 * answered with a generic 500 so internal details never reach the client.
 */
export function errorHandler(error, req, res, next) {
  if (error instanceof AppError) {
    res.status(error.status).json(error.payload);
    return;
  }
  const named = error;
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
  // A response already started can't be rewritten; let Express close it.
  if (res.headersSent) {
    next(error);
    return;
  }
  // Express/body-parser client errors (malformed JSON 400, oversized body 413)
  // keep their status and their safe-to-expose message.
  const status = Number(error?.status || error?.statusCode);
  if (status >= 400 && status < 500 && error?.expose) {
    res.status(status).json({ message: error.message });
    return;
  }
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
}
