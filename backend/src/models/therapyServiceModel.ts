import mongoose, { type HydratedDocument, type Types } from "mongoose";

export interface ServiceAuditEntry {
  action: string;
  by?: Types.ObjectId | null;
  at?: Date;
}

export interface TherapyService {
  name: string;
  description: string;
  duration: number;
  fee: number;
  category: string;
  isActive: boolean;
  auditLog: ServiceAuditEntry[];
}

export type TherapyServiceDoc = HydratedDocument<TherapyService>;

const therapyServiceSchema = new mongoose.Schema<TherapyService>(
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

const TherapyService = mongoose.model<TherapyService>(
  "TherapyService",
  therapyServiceSchema,
);

export default TherapyService;
