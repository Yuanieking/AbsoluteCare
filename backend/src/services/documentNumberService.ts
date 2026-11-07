import DocumentCounter from "../models/documentCounterModel.js";
import type { DocumentType } from "../models/generatedDocumentModel.js";

const PREFIX: Record<DocumentType, string> = {
  clinic_report: "RPT",
  patient_summary: "PTS",
  visit_record: "VIS",
  receipt: "RCP",
};

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  clinic_report: "Clinic activity report",
  patient_summary: "Patient therapy summary",
  visit_record: "Visit record",
  receipt: "Payment receipt",
};

/** The tracking year follows the clinic's calendar, not UTC. */
export function clinicYear(timezone = "Asia/Manila"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
  }).format(new Date());
}

/**
 * One atomic upsert per number: safe under concurrent requests and restarts.
 * The counter is never reset, so a number is never reused.
 */
export async function allocateTrackingNumber(
  type: DocumentType,
): Promise<string> {
  const year = clinicYear();
  const counter = await DocumentCounter.findOneAndUpdate(
    { key: `${PREFIX[type]}-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  // padStart widens past six digits instead of wrapping.
  return `${PREFIX[type]}-${year}-${String(counter?.seq ?? 1).padStart(6, "0")}`;
}

export function verificationUrl(trackingNumber: string, frontendUrl: string): string {
  return `${frontendUrl.trim().replace(/\/+$/, "")}/verify/${trackingNumber}`;
}
