import { z } from "zod";

const boolean = z.boolean();
const bounded = (min, max) => z.number().int().min(min).max(max);
const sectionSchemas = {
  general: z
    .object({
      clinicName: z.string().trim().min(1).max(120),
      address: z.string().trim().max(300),
      phone: z.string().trim().max(30),
      email: z.string().trim().email(),
      timezone: z.literal("Asia/Manila"),
      currency: z.literal("PHP"),
      logoUrl: z.string().trim().max(500),
    })
    .strict(),
  auth: z
    .object({
      googleAuthEnabled: boolean,
      patientRegistrationEnabled: boolean,
      recaptchaEnabled: boolean,
      emailVerificationRequired: boolean,
      passwordMinLength: bounded(8, 32),
      sessionTimeoutMinutes: bounded(15, 1440),
      maxLoginAttempts: bounded(3, 10),
      lockoutMinutes: bounded(1, 1440),
      termsVersion: z.string().trim().min(1).max(30),
    })
    .strict(),
  booking: z
    .object({
      onlineBookingEnabled: boolean,
      minNoticeHours: bounded(0, 720),
      maxAdvanceDays: bounded(1, 365),
      slotIntervalMinutes: z.union([
        z.literal(15),
        z.literal(30),
        z.literal(60),
      ]),
      maxPendingRequestsPerPatient: bounded(1, 20),
      allowDependents: boolean,
      patientCancelCutoffHours: bounded(0, 720),
      rescheduleCutoffHours: bounded(0, 720),
      patientCanCancel: boolean,
    })
    .strict(),
  schedule: z
    .object({
      openDays: z
        .array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
        .min(1),
      openHours: z
        .object({
          start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        })
        .strict(),
      closedDates: z.array(
        z
          .object({
            date: z.string().date(),
            reason: z.string().trim().max(160),
          })
          .strict(),
      ),
    })
    .strict(),
  notifications: z
    .object({
      emailEnabled: boolean,
      inAppEnabled: boolean,
      remindersEnabled: boolean,
      reminderLeadHours: z.array(bounded(1, 720)).min(1),
      senderName: z.string().trim().min(1).max(120),
    })
    .strict(),
  payments: z
    .object({
      enabledMethods: z
        .array(z.enum(["Cash", "GCash", "Card", "Other"]))
        .min(1),
      requireReferenceForNonCash: boolean,
    })
    .strict(),
  integrations: z
    .object({
      googleAuthEnabled: boolean,
      recaptchaEnabled: boolean,
      googleCalendarEnabled: boolean,
    })
    .strict(),
  system: z
    .object({
      maintenanceMode: boolean,
      maintenanceMessage: z.string().trim().min(1).max(500),
      announcement: z
        .object({
          enabled: boolean,
          message: z.string().trim().max(500),
          type: z.enum(["info", "warning"]),
          expiresAt: z.string().datetime().nullable(),
        })
        .strict(),
    })
    .strict(),
};

export function validateSettingsSection(section, body) {
  const schema = sectionSchemas[section];
  if (!schema) throw new Error("Unknown settings section.");
  return schema.parse(body);
}

export const settingsSections = Object.keys(sectionSchemas);
