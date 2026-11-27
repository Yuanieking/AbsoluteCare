import { ValidationError } from "../errors/AppError.js";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export const objectIdParam = (req, res, next, value) => {
  if (typeof value === "string" && OBJECT_ID.test(value)) {
    next();
    return;
  }
  next(new ValidationError("Invalid identifier."));
};

export function validateObjectIdParams(...names) {
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
