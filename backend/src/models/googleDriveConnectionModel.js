import mongoose from "mongoose";

const googleDriveConnectionSchema = new mongoose.Schema(
  {
    key: { type: String, default: "clinic", unique: true, immutable: true },
    connected: { type: Boolean, default: false },
    email: { type: String, default: "" },
    refreshTokenEncrypted: { type: String, default: "" },
    rootFolderId: { type: String, default: "" },
    connectedAt: { type: Date, default: null },
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    needsReconnect: { type: Boolean, default: false },
    lastError: { type: String, default: "" },
  },
  { timestamps: true },
);

const GoogleDriveConnection = mongoose.model(
  "GoogleDriveConnection",
  googleDriveConnectionSchema,
);

export default GoogleDriveConnection;
