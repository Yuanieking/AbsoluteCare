import mongoose, { type Types } from "mongoose";

export interface SettingsAuditLog {
  admin: Types.ObjectId;
  section: string;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip: string;
  meta: unknown;
}

const settingsAuditLogSchema = new mongoose.Schema<SettingsAuditLog>(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    section: { type: String, required: true },
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model<SettingsAuditLog>(
  "SettingsAuditLog",
  settingsAuditLogSchema,
);
