import DocumentCounter from "../models/documentCounterModel.js";

const PREFIX = {
  clinic_report: "RPT",
  patient_summary: "PTS",
  visit_record: "VIS",
  receipt: "RCP",
};

export const DOCUMENT_LABELS = {
  clinic_report: "Clinic activity report",
  patient_summary: "Patient therapy summary",
  visit_record: "Visit record",
  receipt: "Payment receipt",
};

/** The tracking year follows the clinic's calendar, not UTC. */
export function clinicYear(timezone = "Asia/Manila") {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
  }).format(new Date());
}

/**
 * One atomic upsert per number: safe under concurrent requests and restarts.
 * The counter is never reset, so a number is never reused.
 */
export async function allocateTrackingNumber(type) {
  const year = clinicYear();
  const counter = await DocumentCounter.findOneAndUpdate(
    { key: `${PREFIX[type]}-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  // padStart widens past six digits instead of wrapping.
  return `${PREFIX[type]}-${year}-${String(counter?.seq ?? 1).padStart(6, "0")}`;
}

export function verificationUrl(trackingNumber, frontendUrl) {
  return `${frontendUrl.trim().replace(/\/+$/, "")}/verify/${trackingNumber}`;
}
