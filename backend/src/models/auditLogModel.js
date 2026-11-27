import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    at: { type: Date, required: true, default: Date.now, immutable: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorName: { type: String, default: "System" },
    actorRole: { type: String, default: "system" },
    category: { type: String, required: true },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: "" },
    result: { type: String, enum: ["success", "failure"], default: "success" },
    changes: [
      {
        _id: false,
        field: String,
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
      },
    ],
    subjects: [{ type: mongoose.Schema.Types.ObjectId }],
    requestId: { type: String, default: "" },
    source: {
      type: String,
      enum: ["live", "legacy", "system"],
      default: "live",
    },
  },
  { versionKey: false },
);

auditLogSchema.index({ at: -1, _id: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
auditLogSchema.index({ subjects: 1, at: -1 });
auditLogSchema.index({ category: 1, at: -1 });
export default mongoose.model("AuditLog", auditLogSchema);
