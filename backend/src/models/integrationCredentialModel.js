import mongoose from "mongoose";

const integrationCredentialSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    group: { type: String, required: true, index: true },
    valueEncrypted: { type: String, default: "" },
    valueHash: { type: String, default: "" },
    previousEncrypted: { type: String, default: null },
    fingerprint: { type: String, default: "" },
    verifiedAt: { type: Date, default: null },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    clearedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model(
  "IntegrationCredential",
  integrationCredentialSchema,
);
