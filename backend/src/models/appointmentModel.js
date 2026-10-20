import mongoose from "mongoose";

const rescheduleRequestSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["none", "requested", "approved", "declined"],
      default: "none",
    },
    proposedDate: { type: String, default: "" },
    proposedTime: { type: String, default: "" },
    reason: { type: String, default: "" },
    requestedBy: {
      type: String,
      enum: ["patient", "therapist"],
      default: "patient",
    },
    requestedAt: { type: Date, default: null },
  },
  { _id: false },
);

const appointmentSchema = new mongoose.Schema(
  {
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
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TherapyService",
      required: true,
    },
    serviceSnapshot: {
      name: { type: String, default: "" },
      duration: { type: Number, min: 1, default: 60 },
      fee: { type: Number, min: 0, default: 0 },
      category: { type: String, default: "" },
    },
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    requestedDate: { type: String, required: true },
    requestedTime: { type: String, required: true },
    scheduledStart: { type: Date, default: null },
    scheduledEnd: { type: Date, default: null },
    payment: {
      status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
      amount: { type: Number, default: 0, min: 0 },
      method: {
        type: String,
        enum: ["cash", "gcash", "card", "other"],
        default: "cash",
      },
      referenceNumber: { type: String, default: "" },
      recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      recordedAt: { type: Date, default: null },
      notes: { type: String, default: "" },
    },
    paymentAudit: [
      {
        action: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        details: { type: String, default: "" },
        at: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled", "no_show"],
      default: "pending",
    },
    rescheduleRequest: { type: rescheduleRequestSchema, default: () => ({}) },
    cancelReason: { type: String, default: "" },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    googleEventId: { type: String, default: "" },
    therapistGoogleEventId: { type: String, default: "" },
    googleEventLink: { type: String, default: "" },
    auditLog: [
      {
        action: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        fromStatus: { type: String, default: "" },
        toStatus: { type: String, default: "" },
        details: { type: String, default: "" },
        at: { type: Date, default: Date.now },
      },
    ],
    reminderSentAt: { type: Date, default: null },
    reminder24SentAt: { type: Date, default: null },
    reminder1SentAt: { type: Date, default: null },
    notes: { type: String, default: "", maxlength: 1000 },
    noShowMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    noShowMarkedRole: {
      type: String,
      enum: ["admin", "therapist"],
      default: null,
    },
    noShowMarkedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

appointmentSchema.index({ patient: 1, status: 1, scheduledStart: 1 });
appointmentSchema.index({ status: 1, scheduledStart: 1 });
appointmentSchema.index({ therapist: 1, scheduledStart: 1 });

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;
