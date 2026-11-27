function isPlainObject(value) {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function strip(value) {
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

export function sanitizeInput(req, res, next) {
  strip(req.body);
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
