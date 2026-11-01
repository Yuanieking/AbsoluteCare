import mongoose, { type Types } from "mongoose";

export interface SettingsVerification {
  admin: Types.ObjectId;
  action: string;
  digest: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

const settingsVerificationSchema = new mongoose.Schema<SettingsVerification>(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: { type: String, required: true },
    digest: { type: String, default: "" },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

settingsVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<SettingsVerification>(
  "SettingsVerification",
  settingsVerificationSchema,
);
