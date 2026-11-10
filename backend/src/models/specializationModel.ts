import mongoose, { type HydratedDocument } from "mongoose";

export interface Specialization {
  name: string;
  /** Lower-cased `name`; unique so "sports injury" and "Sports Injury" collapse. */
  nameKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SpecializationDoc = HydratedDocument<Specialization>;

const specializationSchema = new mongoose.Schema<Specialization>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

const Specialization = mongoose.model<Specialization>(
  "Specialization",
  specializationSchema,
);

export default Specialization;
