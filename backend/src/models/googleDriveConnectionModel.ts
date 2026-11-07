import mongoose, { type Types } from "mongoose";

export interface GoogleDriveConnection {
  /** The clinic owns one Drive connection, so this is a singleton. */
  key: "clinic";
  connected: boolean;
  email: string;
  refreshTokenEncrypted: string;
  rootFolderId: string;
  connectedAt: Date | null;
  connectedBy: Types.ObjectId | null;
  needsReconnect: boolean;
  lastError: string;
}

const googleDriveConnectionSchema =
  new mongoose.Schema<GoogleDriveConnection>(
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

const GoogleDriveConnection = mongoose.model<GoogleDriveConnection>(
  "GoogleDriveConnection",
  googleDriveConnectionSchema,
);

export default GoogleDriveConnection;
