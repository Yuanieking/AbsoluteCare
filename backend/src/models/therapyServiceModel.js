import mongoose from "mongoose";

const therapyServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    duration: { type: Number, required: true, min: 1 },
    fee: { type: Number, required: true, min: 0 },
    category: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
    auditLog: [
      {
        action: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

const TherapyService = mongoose.model("TherapyService", therapyServiceSchema);

export default TherapyService;
