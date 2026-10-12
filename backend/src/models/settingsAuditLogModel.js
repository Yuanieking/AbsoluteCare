import mongoose from "mongoose";

const settingsAuditLogSchema = new mongoose.Schema(
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
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model("SettingsAuditLog", settingsAuditLogSchema);
