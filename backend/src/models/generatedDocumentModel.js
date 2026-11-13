import mongoose from "mongoose";

const driveStateSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "uploaded", "failed"],
      default: "pending",
    },
    fileId: { type: String, default: "" },
    webViewLink: { type: String, default: "" },
    folderId: { type: String, default: "" },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: "" },
    lastAttemptAt: { type: Date, default: null },
    nextAttemptAt: { type: Date, default: null },
    uploadedAt: { type: Date, default: null },
    lockToken: { type: String, default: "" },
    lockExpiresAt: { type: Date, default: null },
  },
  { _id: false },
);

const generatedDocumentSchema = new mongoose.Schema(
  {
    trackingNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: ["clinic_report", "patient_summary", "visit_record", "receipt"],
    },
    title: { type: String, required: true },
    subject: { type: String, default: "" },
    status: {
      type: String,
      enum: ["issued", "superseded", "revoked"],
      default: "issued",
    },
    fileId: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, default: "application/pdf" },
    sizeBytes: { type: Number, default: 0 },
    sha256: { type: String, default: "" },
    // Never selected by list queries; the download route asks for it explicitly.
    pdf: { type: Buffer, select: false },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dependent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dependent",
      default: null,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    rangeFrom: { type: Date, default: null },
    rangeTo: { type: Date, default: null },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    generatedByRole: {
      type: String,
      enum: ["admin", "secretary", "therapist"],
      required: true,
    },
    generatedByName: { type: String, default: "" },
    supersedes: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeneratedDocument",
      default: null,
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeneratedDocument",
      default: null,
    },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revokeReason: { type: String, default: "" },
    drive: { type: driveStateSchema, default: () => ({}) },
  },
  { timestamps: true },
);

generatedDocumentSchema.index({ type: 1, createdAt: -1 });
generatedDocumentSchema.index({ patient: 1, createdAt: -1 });
generatedDocumentSchema.index({ appointment: 1 });
generatedDocumentSchema.index({ "drive.status": 1, "drive.nextAttemptAt": 1 });

const GeneratedDocument = mongoose.model(
  "GeneratedDocument",
  generatedDocumentSchema,
);

export default GeneratedDocument;
