import type { Request, Response } from "express";
import { trackingNumberParamSchema } from "../schemas/documentSchema.js";
import { verifyDocument } from "../services/documentService.js";

export async function verifyDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const raw = String(req.params.trackingNumber ?? "").trim().toUpperCase();
  const parsed = trackingNumberParamSchema.safeParse(raw);
  res.set("Cache-Control", "no-store");
  if (!parsed.success) {
    // Unknown and malformed numbers answer identically: no format oracle.
    res.status(404).json({ status: "not_found" });
    return;
  }
  const result = await verifyDocument(parsed.data);
  res.status(result.status === "not_found" ? 404 : 200).json(result);
}
