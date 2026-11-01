export class AppError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super(String(payload.message ?? "Error"));
    this.status = status;
    this.payload = payload;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(401, { message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, { message });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, { message });
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, { message });
  }
}
