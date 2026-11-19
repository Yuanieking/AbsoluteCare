import mongoose from "mongoose";

const recordEditorsSchema = new mongoose.Schema({
  _id: { type: String },
  activeEditors: [{
    _id: false,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: String, required: true },
    name: { type: String, required: true },
    lastSeenAt: { type: Date, required: true },
    joinedAt: { type: Date },
  }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export default mongoose.model("RecordEditors", recordEditorsSchema);
