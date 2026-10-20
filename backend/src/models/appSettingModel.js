import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    clinicName: { type: String, default: "AbsoluteCare Physical Therapy" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    timezone: { type: String, default: "Asia/Manila" },
    currency: { type: String, default: "PHP" },
    logoUrl: { type: String, default: "" },
  },
  { _id: false },
);

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "singleton", unique: true, immutable: true },
    general: { type: settingSchema, default: () => ({}) },
    auth: {
      googleAuthEnabled: { type: Boolean, default: true },
      patientRegistrationEnabled: { type: Boolean, default: true },
      recaptchaEnabled: { type: Boolean, default: true },
      emailVerificationRequired: { type: Boolean, default: false },
      passwordMinLength: { type: Number, min: 8, max: 32, default: 8 },
      sessionTimeoutMinutes: { type: Number, min: 15, max: 1440, default: 480 },
      maxLoginAttempts: { type: Number, min: 3, max: 10, default: 5 },
      lockoutMinutes: { type: Number, min: 1, max: 1440, default: 15 },
      termsVersion: { type: String, default: "1.0" },
    },
    booking: {
      onlineBookingEnabled: { type: Boolean, default: true },
      minNoticeHours: { type: Number, min: 0, max: 720, default: 24 },
      maxAdvanceDays: { type: Number, min: 1, max: 365, default: 60 },
      slotIntervalMinutes: { type: Number, enum: [15, 30, 60], default: 30 },
      maxPendingRequestsPerPatient: {
        type: Number,
        min: 1,
        max: 20,
        default: 3,
      },
      allowDependents: { type: Boolean, default: true },
      patientCancelCutoffHours: { type: Number, min: 0, max: 720, default: 24 },
      rescheduleCutoffHours: { type: Number, min: 0, max: 720, default: 24 },
      patientCanCancel: { type: Boolean, default: true },
    },
    schedule: {
      openDays: {
        type: [String],
        default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      },
      openHours: {
        start: { type: String, default: "08:00" },
        end: { type: String, default: "17:00" },
      },
      closedDates: [{ date: String, reason: String }],
    },
    notifications: {
      emailEnabled: { type: Boolean, default: true },
      inAppEnabled: { type: Boolean, default: true },
      remindersEnabled: { type: Boolean, default: true },
      reminderLeadHours: { type: [Number], default: [24, 1] },
      senderName: { type: String, default: "AbsoluteCare Physical Therapy" },
    },
    payments: {
      enabledMethods: {
        type: [String],
        enum: ["Cash", "GCash", "Card", "Other"],
        default: ["Cash"],
      },
      requireReferenceForNonCash: { type: Boolean, default: false },
    },
    integrations: {
      googleAuthEnabled: { type: Boolean, default: true },
      recaptchaEnabled: { type: Boolean, default: true },
      googleCalendarEnabled: { type: Boolean, default: true },
      googleAuthLastTest: { type: mongoose.Schema.Types.Mixed, default: null },
      recaptchaLastTest: { type: mongoose.Schema.Types.Mixed, default: null },
      googleCalendarLastTest: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      emailLastTest: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    system: {
      maintenanceMode: { type: Boolean, default: false },
      maintenanceMessage: {
        type: String,
        default: "We are making a few improvements. Please check back soon.",
      },
      announcement: {
        enabled: { type: Boolean, default: false },
        message: { type: String, default: "" },
        type: { type: String, enum: ["info", "warning"], default: "info" },
        expiresAt: { type: Date, default: null },
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, minimize: false },
);

export default mongoose.model("AppSetting", appSettingSchema);
