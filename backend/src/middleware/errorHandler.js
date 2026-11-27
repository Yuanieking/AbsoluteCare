import { AppError, ConflictError } from "../errors/AppError.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ message: "Route not found." });
}

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
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = Number(error?.status || error?.statusCode);
  if (status >= 400 && status < 500 && error?.expose) {
    res.status(status).json({ message: error.message });
    return;
  }
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
}
