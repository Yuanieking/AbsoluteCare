import mongoose, { type Types } from "mongoose";

export interface IntegrationCredential {
  key: string;
  group: string;
  valueEncrypted: string;
  valueHash: string;
  previousEncrypted: string | null;
  fingerprint: string;
  verifiedAt: Date | null;
  updatedBy: Types.ObjectId | null;
  clearedAt: Date | null;
}

const integrationCredentialSchema = new mongoose.Schema<IntegrationCredential>(
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

export default mongoose.model<IntegrationCredential>(
  "IntegrationCredential",
  integrationCredentialSchema,
);
