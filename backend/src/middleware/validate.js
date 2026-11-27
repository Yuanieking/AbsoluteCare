export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) {
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
