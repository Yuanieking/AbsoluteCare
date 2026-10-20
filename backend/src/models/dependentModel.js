import mongoose from "mongoose";

const dependentSchema = new mongoose.Schema(
  {
    guardian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    sex: { type: String, trim: true, default: "" },
    relationship: { type: String, required: true, trim: true },
    medicalNotes: { type: String, trim: true, maxlength: 1000, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Dependent = mongoose.model("Dependent", dependentSchema);

export default Dependent;
