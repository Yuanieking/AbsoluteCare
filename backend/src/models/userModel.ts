import mongoose, { type HydratedDocument, type Model } from "mongoose";
import {
  emailPattern,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from "../utils/validators.js";

export interface NotificationChannelPrefs {
  inApp: boolean;
  email: boolean;
}

export interface NotificationPreferences extends NotificationChannelPrefs {
  appointmentUpdates: NotificationChannelPrefs;
  reminders: NotificationChannelPrefs;
  system: NotificationChannelPrefs;
}

export interface GoogleCalendarLink {
  connected: boolean;
  email: string;
  calendarId: string;
  refreshTokenEncrypted: string;
  connectedAt: Date | null;
  needsReconnect: boolean;
}

export interface WorkingHours {
  start: string;
  end: string;
}

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const WEEKDAYS: Weekday[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

/** One enabled working day with its own clinic-local (Asia/Manila) hours. */
export interface DayHours {
  day: Weekday;
  start: string;
  end: string;
}

export interface AccountAuditEntry {
  action: string;
  by: mongoose.Types.ObjectId | null;
  at: Date;
  details?: string;
}

export type UserRole = "user" | "therapist" | "admin" | "secretary";

export interface User {
  email: string;
  firstname: string;
  lastname: string;
  password: string;
  profilePicture: string;
  phone: string;
  acceptedTerms: boolean;
  termsAcceptedAt: Date | null;
  mustChangePassword: boolean;
  notificationPreferences: NotificationPreferences;
  resetPasswordTokenHash: string;
  resetPasswordExpiresAt: Date | null;
  dateOfBirth: string;
  address: string;
  specialization: string | string[];
  workingDays: string[];
  /** Authoritative per-day availability; read this, never `workingHours`. */
  workingHoursByDay: DayHours[];
  /** Derived outer bounds of `workingHoursByDay`, kept for display only. */
  workingHours: WorkingHours;
  googleCalendar: GoogleCalendarLink;
  authProvider: "local" | "google";
  isActive: boolean;
  isArchived: boolean;
  removedAt: Date | null;
  accountAudit: AccountAuditEntry[];
  role: UserRole;
}

export interface UserMethods {
  omitPassword(): Omit<User, "password">;
}

export type UserDoc = HydratedDocument<User, UserMethods>;
type UserModel = Model<User, Record<string, never>, UserMethods>;

const userSchema = new mongoose.Schema<User, UserModel, UserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [emailPattern, "Enter a valid email address."],
      set: normalizeEmail,
    },
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: "" },
    phone: {
      type: String,
      default: "",
      set: normalizePhone,
      validate: {
        validator: (value: string) => !value || isValidPhone(value),
        message: "Enter a valid mobile number (e.g. 09171234567)",
      },
    },
    acceptedTerms: { type: Boolean, default: false },
    termsAcceptedAt: { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },
    notificationPreferences: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      appointmentUpdates: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      reminders: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      system: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
    },
    resetPasswordTokenHash: { type: String, default: "" },
    resetPasswordExpiresAt: { type: Date, default: null },
    dateOfBirth: { type: String, default: "" },
    address: { type: String, default: "" },
    specialization: { type: mongoose.Schema.Types.Mixed, default: "" },
    workingDays: {
      type: [String],
      default: [],
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    workingHoursByDay: {
      type: [
        new mongoose.Schema<DayHours>(
          {
            day: {
              type: String,
              enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
              required: true,
            },
            start: { type: String, default: "08:00" },
            end: { type: String, default: "17:00" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    workingHours: {
      start: { type: String, default: "08:00" },
      end: { type: String, default: "17:00" },
    },
    googleCalendar: {
      connected: { type: Boolean, default: false },
      email: { type: String, default: "" },
      calendarId: { type: String, default: "primary" },
      refreshTokenEncrypted: { type: String, default: "" },
      connectedAt: { type: Date, default: null },
      needsReconnect: { type: Boolean, default: false },
    },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    removedAt: { type: Date, default: null },
    accountAudit: [
      {
        action: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
        details: { type: String, default: "" },
      },
    ],
    role: {
      type: String,
      enum: ["user", "therapist", "admin", "secretary"],
      default: "user",
    },
  },
  { timestamps: true },
);

userSchema.methods.omitPassword = function (this: UserDoc) {
  const user = this.toObject() as unknown as Record<string, unknown>;
  delete user.password;
  return user as Omit<User, "password">;
};

userSchema.virtual("fullname").get(function (this: UserDoc) {
  return `${this.firstname} ${this.lastname}`;
});

const User = mongoose.model<User, UserModel>("User", userSchema);

export default User;
