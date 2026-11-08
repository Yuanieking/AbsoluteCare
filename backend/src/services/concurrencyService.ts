import { ConflictError, ValidationError } from "../errors/AppError.js";

// ** Timestamp concurrency control (optimistic, keyed on Mongoose `updatedAt`).
// ** Client flow: read a record, keep its `updatedAt`, send it back on the write as
// **   If-Match: "<updatedAt ISO string>"
// ** No header (or `*`) = unchecked write, so older clients keep working.

interface Guardable {
  updatedAt?: Date | null;
  $where?: Record<string, unknown>;
}

// Mongoose documents expose the EventEmitter API at runtime (document.js) and emit
// "save" after a successful write (model.js), but the typings omit it.
type SaveEmitter = { $once(event: "save", listener: () => void): unknown };

// ** Parses If-Match into the timestamp the client last saw. undefined = no check requested.
export function parseIfMatch(header: string | undefined): Date | undefined {
  const value = header?.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  if (!value || value === "*") return undefined;
  const at = new Date(value);
  if (Number.isNaN(at.getTime()))
    throw new ValidationError(
      "If-Match must be the record's updatedAt timestamp.",
    );
  return at;
}

// ** Two-step guard for load -> mutate -> save() writes:
// ** 1. Fail fast with 409 if the loaded record is already newer than what the client saw.
// ** 2. Pin `updatedAt` into the save() filter ($where) so the write is an atomic
// **    compare-and-swap; if another write lands in between, save() matches nothing,
// **    Mongoose throws DocumentNotFoundError and app.ts turns it into 409 STALE_RECORD.
// ** The pin is cleared after the first successful save so follow-up saves of the same
// ** document in this request (calendar sync, repopulate) are not rejected by our own write.
export function guardFresh(doc: Guardable, ifMatch: string | undefined): void {
  const expected = parseIfMatch(ifMatch);
  if (!expected) return;
  if (doc.updatedAt?.getTime() !== expected.getTime())
    throw new ConflictError();
  doc.$where = { ...doc.$where, updatedAt: doc.updatedAt };
  (doc as unknown as SaveEmitter).$once("save", () => {
    if (doc.$where) delete doc.$where.updatedAt;
  });
}

// ** Filter fragment for atomic single-statement writes (findOneAndUpdate / updateOne /
// ** deleteOne): spread into the filter; a null/0 result then means stale or missing.
export function freshFilter(ifMatch: string | undefined): { updatedAt?: Date } {
  const expected = parseIfMatch(ifMatch);
  return expected ? { updatedAt: expected } : {};
}

// ** After a freshFilter write matched nothing: if the record still exists the miss
// ** was a stale timestamp -> 409; otherwise return and let the caller send its 404.
export async function assertNotStale(
  ifMatch: string | undefined,
  exists: () => Promise<unknown>,
): Promise<void> {
  if (parseIfMatch(ifMatch) && (await exists())) throw new ConflictError();
}
