import type { Request, Response } from "express";
import {
  documentCreateSchema,
  documentRevokeSchema,
} from "../schemas/documentSchema.js";
import {
  createDocument,
  documentView,
  findDocumentForActor,
  getDocumentPdf,
  listDocuments,
  resolveActor,
  retryDocument,
  revokeDocument,
} from "../services/documentService.js";
import { documentListQuerySchema } from "../schemas/documentSchema.js";

function actorOf(req: Request) {
  return resolveActor(req.user.userId, req.user.role);
}

export async function createDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = await actorOf(req);
  const input = documentCreateSchema.parse(req.body ?? {});
  const doc = await createDocument(input, actor);
  res.status(201).json({ document: documentView(doc) });
}

export async function listDocumentsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = await actorOf(req);
  const query = documentListQuerySchema.parse(req.query ?? {});
  res.json(await listDocuments(query, actor));
}

export async function getDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = await actorOf(req);
  const doc = await findDocumentForActor(String(req.params.id), actor);
  res.json({ document: documentView(doc) });
}

export async function downloadDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = await actorOf(req);
  const { doc, pdf } = await getDocumentPdf(String(req.params.id), actor);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${doc.fileName}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(pdf);
}

export async function retryDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = await actorOf(req);
  if (actor.role === "therapist") {
    res.status(403).json({ message: "Therapists cannot retry Drive sync." });
    return;
  }
  const doc = await retryDocument(String(req.params.id), actor);
  res.json({ document: documentView(doc) });
}

export async function revokeDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = await actorOf(req);
  if (actor.role !== "admin") {
    res
      .status(403)
      .json({ message: "Only an administrator can revoke a document." });
    return;
  }
  const { reason } = documentRevokeSchema.parse(req.body ?? {});
  const doc = await revokeDocument(String(req.params.id), actor.id, reason);
  res.json({ document: documentView(doc) });
}
