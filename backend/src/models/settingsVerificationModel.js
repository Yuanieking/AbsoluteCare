import mongoose from "mongoose";

const settingsVerificationSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "disable_google_auth",
        "disable_recaptcha",
        "disableGoogleAuth",
        "disableRecaptcha",
      ],
      required: true,
    },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

settingsVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model(
  "SettingsVerification",
  settingsVerificationSchema,
);
