import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "appointment_requested",
        "appointment_confirmed",
        "appointment_assigned",
        "appointment_rescheduled",
        "appointment_cancelled",
        "appointment_reminder",
        "reschedule_requested",
        "reschedule_approved",
        "reschedule_declined",
        "session_recorded",
        "payment_recorded",
        "account_update",
        "system",
        "appointment_request",
        "appointment_completed",
        "appointment_no_show",
        "reschedule_request_update",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    dependent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dependent",
      default: null,
    },
    link: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
