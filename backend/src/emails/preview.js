import {
  appointmentCancelled,
  appointmentConfirmed,
  appointmentReminder,
  appointmentRescheduled,
  passwordChanged,
  resetPassword,
  setPassword,
  staffInvitation,
  testEmail,
  verificationCode,
} from "./templates/index.js";

const sampleAppointment = {
  _id: "appointment-preview",
  scheduledStart: "2026-10-14T02:00:00.000Z",
  serviceSnapshot: { name: "Manual therapy", duration: 60 },
  therapist: { firstname: "Maria", lastname: "Santos" },
  patient: { firstname: "Alex", lastname: "Dela Cruz" },
};

export const templates = {
  reset: () =>
    resetPassword({ email: "patient@example.com", token: "preview-token" }),
  setPassword: () =>
    setPassword({ email: "patient@example.com", token: "preview-token" }),
  passwordChanged: () =>
    passwordChanged({
      email: "patient@example.com",
      phone: "+63 917 000 0000",
    }),
  verification: () =>
    verificationCode({
      email: "admin@example.com",
      code: "123456",
      action: "disabling reCAPTCHA",
      adminName: "Danziel Jean Lumactod",
    }),
  invitation: () =>
    staffInvitation({
      email: "staff@example.com",
      firstname: "Jamie",
      lastname: "Reyes",
      role: "therapist",
      temporaryPassword: "PreviewPassword123",
    }),
  confirmed: () =>
    appointmentConfirmed({
      recipientEmail: "patient@example.com",
      appointment: sampleAppointment,
      actionUrl: "/dashboard/appointments/appointment-preview",
    }),
  rescheduled: () =>
    appointmentRescheduled({
      recipientEmail: "patient@example.com",
      appointment: sampleAppointment,
      previousSchedule: "Oct 13, 2026 at 10:00 AM",
    }),
  cancelled: () =>
    appointmentCancelled({
      recipientEmail: "patient@example.com",
      appointment: sampleAppointment,
      reason: "Therapist unavailable",
    }),
  reminder: () =>
    appointmentReminder({
      recipientEmail: "patient@example.com",
      appointment: sampleAppointment,
      leadHours: 24,
    }),
  test: () =>
    testEmail({
      email: "admin@example.com",
      senderAddress: "AbsoluteCare Therapy Center <no-reply@example.com>",
    }),
};
