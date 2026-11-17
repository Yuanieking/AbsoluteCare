import { randomUUID } from "node:crypto";
import { auditContext } from "../services/auditCapture.js";

export function auditRequest(req, res, next) {
  auditContext.run({ requestId: randomUUID() }, next);
}
