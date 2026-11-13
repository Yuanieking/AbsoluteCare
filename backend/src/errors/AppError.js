export class AppError extends Error {
  status;
  payload;

  constructor(status, payload) {
    super(String(payload.message ?? "Error"));
    this.status = status;
    this.payload = payload;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message) {
    super(401, { message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message) {
    super(403, { message });
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(404, { message });
  }
}

// ** Concurrency: thrown when a write carries an If-Match timestamp that no longer
// ** matches the record's updatedAt (someone else changed it first).
export class ConflictError extends AppError {
  constructor(
    message = "This record was changed by someone else. Reload and try again.",
  ) {
    super(409, { code: "STALE_RECORD", message });
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(400, { message });
  }
}
