import GeneratedDocument from "../models/generatedDocumentModel.js";
import { getConnection } from "../services/driveService.js";
import { attemptDriveUpload } from "../services/documentService.js";
import {
  effectiveIntegrationEnabled,
  getSettings,
} from "../services/settingsService.js";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;

/**
 * Persisted Drive retry queue. Runs on a 5-minute interval from app.ts; a
 * single Node process is assumed, exactly like the reminder job.
 */
export async function runDocumentSyncJob() {
  const settings = await getSettings();
  if (!effectiveIntegrationEnabled(settings, "googleDrive")) return;
  const connection = await getConnection();
  if (!connection?.connected || connection.needsReconnect) return;

  const now = new Date();
  // Legacy safety: a pending row with no due time becomes due immediately.
  await GeneratedDocument.updateMany(
    {
      "drive.status": "pending",
      "drive.nextAttemptAt": null,
      "drive.attempts": { $lt: MAX_ATTEMPTS },
    },
    { $set: { "drive.nextAttemptAt": now } },
  );

  const due = await GeneratedDocument.find({
    status: "issued",
    "drive.status": { $in: ["pending", "failed"] },
    "drive.attempts": { $lt: MAX_ATTEMPTS },
    "drive.nextAttemptAt": { $lte: now },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE);

  for (const doc of due) {
    await attemptDriveUpload(doc);
  }
}
