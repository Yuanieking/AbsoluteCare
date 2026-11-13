import type { NextFunction, Request, Response } from "express";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Removes keys that can act as Mongo operators ("$...") or path selectors
 * ("a.b"), plus "__proto__", recursively. Returns true when anything was removed.
 */
function strip(value: unknown): boolean {
  let changed = false;
  if (Array.isArray(value)) {
    for (const item of value) changed = strip(item) || changed;
    return changed;
  }
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".") || key === "__proto__") {
      delete value[key];
      changed = true;
    } else {
      changed = strip(value[key]) || changed;
    }
  }
  return changed;
}

/** NoSQL-injection guard for request bodies and query strings. */
export function sanitizeInput(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  strip(req.body);
  // Express 5 re-parses req.query on every read, so a sanitized copy must be
  // pinned onto the request or the removal would be thrown away.
  const query = req.query;
  if (strip(query)) {
    Object.defineProperty(req, "query", {
      value: query,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }
  next();
}
