import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dependent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dependent",
      default: null,
    },
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TherapyService",
      required: true,
    },
    sessionDate: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    patientVisibleNotes: { type: String, default: "" },
    clinicalNotes: { type: String, default: "" },
    editHistory: [
      {
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        editedAt: { type: Date, default: Date.now },
      },
    ],
    editedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;
