/**
 * Reusable Zod validation for a route. A failure is passed to the shared error
 * handler as a ZodError, so the 400 payload matches what controllers already
 * produce when they call `schema.parse` themselves.
 */
export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) {
        // Express 5 re-parses req.query on every read; pin the parsed value.
        Object.defineProperty(req, "query", {
          value: schemas.query.parse(req.query ?? {}),
          configurable: true,
          enumerable: true,
          writable: true,
        });
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
