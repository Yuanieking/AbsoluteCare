import crypto from "node:crypto";
import { Types, type QueryFilter } from "mongoose";
import { FRONTEND_URL } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import GeneratedDocument, {
  type GeneratedDocument as DocumentData,
  type GeneratedDocumentDoc,
} from "../models/generatedDocumentModel.js";
import User from "../models/userModel.js";
import type {
  DocumentCreateInput,
  DocumentListQuery,
} from "../schemas/documentSchema.js";
import {
  buildDocumentPayload,
  type DocumentActor,
  type StaffRole,
} from "./documentDataService.js";
import {
  allocateTrackingNumber,
  DOCUMENT_LABELS,
  verificationUrl,
} from "./documentNumberService.js";
import { clinicIdentity, renderDocumentPdf } from "./documentPdfService.js";
import {
  DriveError,
  markConnectionError,
  reserveDriveFileId,
  uploadDocumentFile,
} from "./driveService.js";
import {
  effectiveIntegrationEnabled,
  getSettings,
  isReportGenerationEnabled,
} from "./settingsService.js";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_DRIVE_ATTEMPTS = 5;
/** Retry backoff after the 1st..5th failed attempt. */
const BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
];

const ROLE_VALUES: StaffRole[] = ["admin", "secretary", "therapist"];

export function isPublicVerificationUrl(url = FRONTEND_URL): boolean {
  try {
    const host = new URL(url).hostname;
    return !["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host);
  } catch {
    return false;
  }
}

function clinicDate(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function issuedLabel(value: Date, timezone: string): string {
  const formatted = new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
  const zone =
    new Intl.DateTimeFormat("en-PH", {
      timeZone: timezone,
      timeZoneName: "short",
    })
      .formatToParts(value)
      .find((part) => part.type === "timeZoneName")?.value ?? timezone;
  return `${formatted} (${zone})`;
}

export async function resolveActor(
  userId: string,
  role?: string,
): Promise<DocumentActor> {
  const user = await User.findById(userId).select("firstname lastname role");
  if (!user) throw new AppError(403, { message: "Account not found." });
  const resolved = (role || user.role) as StaffRole;
  if (!ROLE_VALUES.includes(resolved)) {
    throw new AppError(403, {
      message: "You do not have access to this workspace.",
    });
  }
  return {
    id: String(user._id),
    role: resolved,
    name: `${user.firstname} ${user.lastname}`.trim(),
  };
}

export interface DocumentView {
  id: string;
  trackingNumber: string;
  type: DocumentData["type"];
  title: string;
  subject: string;
  status: DocumentData["status"];
  issuedAt: Date;
  generatedBy: { name: string; role: string };
  sizeBytes: number;
  sha256: string;
  drive: {
    status: string;
    webViewLink: string;
    attempts: number;
    lastError: string;
  };
  verifyUrl: string;
}

export function documentView(doc: GeneratedDocumentDoc): DocumentView {
  return {
    id: String(doc._id),
    trackingNumber: doc.trackingNumber,
    type: doc.type,
    title: doc.title,
    subject: doc.subject,
    status: doc.status,
    issuedAt: doc.createdAt,
    generatedBy: { name: doc.generatedByName, role: doc.generatedByRole },
    sizeBytes: doc.sizeBytes,
    sha256: doc.sha256,
    drive: {
      status: doc.drive.status,
      webViewLink: doc.drive.webViewLink,
      attempts: doc.drive.attempts,
      lastError: doc.drive.lastError,
    },
    verifyUrl: verificationUrl(doc.trackingNumber, FRONTEND_URL),
  };
}

/**
 * One upload attempt. A failure never loses the document: the bytes, the
 * tracking number and the drive retry state all stay on the record.
 */
export async function attemptDriveUpload(
  candidate: GeneratedDocumentDoc,
  resetAttempts = false,
): Promise<GeneratedDocumentDoc> {
  const now = new Date();
  const lockToken = crypto.randomUUID();
  const doc = await GeneratedDocument.findOneAndUpdate(
    {
      _id: candidate._id,
      "drive.status": { $ne: "uploaded" },
      $or: [
        { "drive.lockExpiresAt": null },
        { "drive.lockExpiresAt": { $lte: now } },
      ],
    },
    {
      $set: {
        "drive.lockToken": lockToken,
        "drive.lockExpiresAt": new Date(now.getTime() + 5 * 60_000),
        ...(resetAttempts
          ? {
              "drive.attempts": 0,
              "drive.lastError": "",
              "drive.status": "pending",
            }
          : {}),
      },
    },
    { returnDocument: "after" },
  );
  if (!doc)
    return (await GeneratedDocument.findById(candidate._id)) ?? candidate;
  // A worker whose lease expired cannot save over a newer worker's state.
  doc.$where = { "drive.lockToken": lockToken };
  try {
    return await performDriveUpload(doc, lockToken);
  } finally {
    await GeneratedDocument.updateOne(
      { _id: doc._id, "drive.lockToken": lockToken },
      { $set: { "drive.lockToken": "", "drive.lockExpiresAt": null } },
    );
    doc.drive.lockToken = "";
    doc.drive.lockExpiresAt = null;
  }
}

async function performDriveUpload(
  doc: GeneratedDocumentDoc,
  lockToken: string,
): Promise<GeneratedDocumentDoc> {
  const now = new Date();
  try {
    const settings = await getSettings();
    if (!effectiveIntegrationEnabled(settings, "googleDrive")) {
      throw new DriveError(
        "disabled",
        "Google Drive filing is switched off in Settings, Integrations.",
        false,
      );
    }
    const withPdf = await GeneratedDocument.findById(doc._id).select("+pdf");
    if (!withPdf?.pdf)
      throw new DriveError("rejected", "The stored PDF is missing.", false);
    if (!doc.drive.fileId) {
      const fileId = await reserveDriveFileId();
      // Persist the remote ID before sending bytes: retries reuse it even if
      // Google accepts an upload but its response never reaches this process.
      const reserved = await GeneratedDocument.updateOne(
        { _id: doc._id, "drive.lockToken": lockToken },
        { $set: { "drive.fileId": fileId } },
      );
      if (!reserved.matchedCount) throw new Error("Upload lease was lost.");
      doc.drive.fileId = fileId;
    }
    const uploaded = await uploadDocumentFile({
      fileId: doc.drive.fileId,
      trackingNumber: doc.trackingNumber,
      type: doc.type,
      datedAt: doc.createdAt,
      buffer: withPdf.pdf,
    });
    doc.drive.status = "uploaded";
    doc.drive.fileId = uploaded.fileId;
    doc.drive.webViewLink = uploaded.webViewLink;
    doc.drive.folderId = uploaded.folderId;
    doc.drive.attempts += 1;
    doc.drive.lastAttemptAt = now;
    doc.drive.nextAttemptAt = null;
    doc.drive.uploadedAt = now;
    doc.drive.lastError = "";
    await doc.save();
    console.log(
      `documents: ${doc.trackingNumber} filed to Drive (attempt ${doc.drive.attempts})`,
    );
    return doc;
  } catch (error) {
    const driveError =
      error instanceof DriveError
        ? error
        : new DriveError(
            "transient",
            "Google Drive is temporarily unavailable. Retrying.",
            true,
          );
    doc.drive.attempts += 1;
    doc.drive.lastAttemptAt = now;
    doc.drive.lastError = driveError.message;
    const hopeless =
      ["quota", "permission", "rejected", "folder_missing"].includes(
        driveError.code,
      ) && !driveError.retryable;
    if (
      hopeless ||
      (driveError.retryable && doc.drive.attempts >= MAX_DRIVE_ATTEMPTS)
    ) {
      doc.drive.status = "failed";
      doc.drive.nextAttemptAt = null;
    } else {
      doc.drive.status = "pending";
      doc.drive.nextAttemptAt = driveError.retryable
        ? new Date(
            now.getTime() +
              (BACKOFF_MS[
                Math.min(doc.drive.attempts - 1, BACKOFF_MS.length - 1)
              ] ??
                BACKOFF_MS[0] ??
                60_000),
          )
        : null;
    }
    await doc.save();
    await markConnectionError(driveError);
    console.log(
      `documents: ${doc.trackingNumber} drive attempt ${doc.drive.attempts} failed (${driveError.code})`,
    );
    return doc;
  }
}

export async function createDocument(
  input: DocumentCreateInput,
  actor: DocumentActor,
): Promise<GeneratedDocumentDoc> {
  const settings = await getSettings();
  if (!isReportGenerationEnabled(settings)) {
    throw new AppError(403, {
      code: "REPORT_GENERATION_DISABLED",
      message: "Report generation is switched off in Settings, Integrations.",
    });
  }
  const payload = await buildDocumentPayload(input, actor);
  const trackingNumber = await allocateTrackingNumber(payload.type);
  const issuedAt = new Date();
  const clinic = clinicIdentity(settings.general);
  const verifyUrl = verificationUrl(trackingNumber, FRONTEND_URL);

  const pdf = await renderDocumentPdf({
    payload,
    trackingNumber,
    verificationUrl: verifyUrl,
    verifyIsPublic: isPublicVerificationUrl(),
    issuedLabel: issuedLabel(issuedAt, clinic.timezone),
    issuerLine: `Issued ${issuedLabel(issuedAt, clinic.timezone)} by ${actor.name} (${actor.role})`,
    clinic,
  });
  if (pdf.length > MAX_PDF_BYTES) {
    throw new AppError(422, {
      message: "This document is too large to store. Narrow the date range.",
    });
  }

  // Same type, same source ids, identical range: the new document replaces it.
  const previous = await GeneratedDocument.findOne({
    type: payload.type,
    patient: payload.patient,
    dependent: payload.dependent,
    appointment: payload.appointment,
    rangeFrom: payload.rangeFrom,
    rangeTo: payload.rangeTo,
    status: "issued",
  } as QueryFilter<DocumentData>);

  const doc = await GeneratedDocument.create({
    trackingNumber,
    type: payload.type,
    title: payload.title,
    subject: payload.subject,
    fileId: crypto.randomUUID(),
    fileName: `${trackingNumber}_${clinicDate(issuedAt, clinic.timezone)}.pdf`,
    sizeBytes: pdf.length,
    sha256: crypto.createHash("sha256").update(pdf).digest("hex"),
    pdf,
    patient: payload.patient,
    dependent: payload.dependent,
    appointment: payload.appointment,
    rangeFrom: payload.rangeFrom,
    rangeTo: payload.rangeTo,
    generatedBy: new Types.ObjectId(actor.id),
    generatedByRole: actor.role,
    generatedByName: actor.name,
    supersedes: previous?._id ?? null,
  });

  if (previous) {
    previous.status = "superseded";
    previous.supersededBy = doc._id;
    await previous.save();
  }

  if (effectiveIntegrationEnabled(settings, "googleDrive")) {
    await attemptDriveUpload(doc);
  }
  return doc;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listDocuments(
  query: DocumentListQuery,
  actor: DocumentActor,
): Promise<{
  documents: DocumentView[];
  pagination: { page: number; pages: number; total: number };
}> {
  const filter: Record<string, unknown> = {};
  if (query.type) filter.type = query.type;
  if (query.patientId) filter.patient = query.patientId;
  if (query.appointmentId) filter.appointment = query.appointmentId;
  if (query.driveStatus) filter["drive.status"] = query.driveStatus;
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ trackingNumber: pattern }, { subject: pattern }];
  }
  if (actor.role !== "admin") filter.generatedBy = actor.id;

  const skip = (query.page - 1) * query.limit;
  const [documents, total] = await Promise.all([
    GeneratedDocument.find(filter as QueryFilter<DocumentData>)
      .select("-pdf")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    GeneratedDocument.countDocuments(filter as QueryFilter<DocumentData>),
  ]);

  return {
    documents: documents.map(documentView),
    pagination: {
      page: query.page,
      pages: Math.max(Math.ceil(total / query.limit), 1),
      total,
    },
  };
}

export async function findDocumentForActor(
  id: string,
  actor: DocumentActor,
): Promise<GeneratedDocumentDoc> {
  const doc = await GeneratedDocument.findById(id).select("-pdf");
  // No existence oracle: another staff member's document is a plain 404.
  if (
    !doc ||
    (actor.role !== "admin" && String(doc.generatedBy) !== actor.id)
  ) {
    throw new AppError(404, { message: "Document not found." });
  }
  return doc;
}

export async function getDocumentPdf(
  id: string,
  actor: DocumentActor,
): Promise<{ doc: GeneratedDocumentDoc; pdf: Buffer }> {
  await findDocumentForActor(id, actor);
  const doc = await GeneratedDocument.findById(id).select("+pdf");
  if (!doc?.pdf) throw new AppError(404, { message: "Document not found." });
  return { doc, pdf: doc.pdf };
}

export async function retryDocument(
  id: string,
  actor: DocumentActor,
): Promise<GeneratedDocumentDoc> {
  if (actor.role === "therapist") {
    throw new AppError(403, { message: "Therapists cannot retry Drive sync." });
  }
  const doc = await findDocumentForActor(id, actor);
  if (doc.drive.status === "uploaded") {
    throw new AppError(409, {
      message: "This document is already filed in Google Drive.",
    });
  }
  return attemptDriveUpload(doc, true);
}

export async function revokeDocument(
  id: string,
  actorId: string,
  reason: string,
): Promise<GeneratedDocumentDoc> {
  const doc = await GeneratedDocument.findById(id).select("-pdf");
  if (!doc) throw new AppError(404, { message: "Document not found." });
  if (doc.status === "revoked") {
    throw new AppError(409, { message: "This document is already revoked." });
  }
  doc.status = "revoked";
  doc.revokedAt = new Date();
  doc.revokedBy = new Types.ObjectId(actorId);
  doc.revokeReason = reason;
  await doc.save();
  return doc;
}

export interface VerifyResult {
  status: "valid" | "superseded" | "revoked" | "not_found";
  documentType?: DocumentData["type"];
  documentLabel?: string;
  trackingNumber?: string;
  issuedAt?: Date;
  clinicName?: string;
  supersededBy?: string;
  supersededAt?: Date;
  revokedAt?: Date;
}

/** The public answer only: no patient, no amount, no issuer, no Drive link. */
export async function verifyDocument(
  trackingNumber: string,
): Promise<VerifyResult> {
  const doc = await GeneratedDocument.findOne({
    trackingNumber: trackingNumber.trim().toUpperCase(),
  }).select("trackingNumber type status createdAt revokedAt supersededBy");
  if (!doc) return { status: "not_found" };

  const settings = await getSettings();
  const result: VerifyResult = {
    status:
      doc.status === "revoked"
        ? "revoked"
        : doc.status === "superseded"
          ? "superseded"
          : "valid",
    documentType: doc.type,
    documentLabel: DOCUMENT_LABELS[doc.type],
    trackingNumber: doc.trackingNumber,
    issuedAt: doc.createdAt,
    clinicName: settings.general.clinicName || "AbsoluteCare Therapy Center",
  };

  if (doc.supersededBy) {
    const replacement = await GeneratedDocument.findById(
      doc.supersededBy,
    ).select("trackingNumber createdAt");
    if (replacement) {
      result.supersededBy = replacement.trackingNumber;
      result.supersededAt = replacement.createdAt;
    }
  }
  if (doc.revokedAt) result.revokedAt = doc.revokedAt;
  return result;
}
