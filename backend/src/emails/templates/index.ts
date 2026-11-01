import {
  button,
  callout,
  codeBox,
  details,
  escapeHtml,
} from "../components.js";
import {
  type EmailAttachment,
  type EmailBranding,
  emailLayout,
  frontendUrl,
  getEmailBranding,
} from "../layout.js";

const timezone = "Asia/Manila";

export interface EmailPerson {
  firstname?: string;
  lastname?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

export interface EmailAppointment {
  _id?: unknown;
  id?: unknown;
  scheduledStart?: Date | string | null | undefined;
  scheduledEnd?: Date | string | null | undefined;
  requestedDate?: string | undefined;
  requestedTime?: string | undefined;
  service?: { name?: string; [key: string]: unknown } | null | undefined;
  serviceSnapshot?:
    | { name?: string; [key: string]: unknown }
    | null
    | undefined;
  patient?: EmailPerson | null | undefined;
  dependent?: EmailPerson | null | undefined;
  therapist?: EmailPerson | null | undefined;
  [key: string]: unknown;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: EmailAttachment[];
}

interface LayoutInput {
  recipientEmail: string;
  subject: string;
  preheader: string;
  title: string;
  intro: string;
  bodyHtml: string;
  text: string;
  primaryAction?: { href: string; html: string };
  secondaryHtml?: string;
  footerNote?: string;
  brand?: EmailBranding;
  attachments?: EmailAttachment[];
}

interface AppointmentEmailInput extends EmailAppointment {
  recipientEmail: string;
  appointment?: EmailAppointment | null | undefined;
  actionUrl?: string | undefined;
  previousSchedule?: string | undefined;
  reason?: string | undefined;
  leadHours?: number | undefined;
}

interface NotificationEmailInput {
  recipientEmail: string;
  title: string;
  message: string;
  appointment?: EmailAppointment | null | undefined;
  dependent?: EmailPerson | null | undefined;
  actionUrl?: string | undefined;
}

interface AppointmentTemplateInput extends AppointmentEmailInput {
  type: string;
  title: string;
  intro: string;
  reminder?: boolean;
  appointment?: EmailAppointment | null | undefined;
}

function dateTime(value: unknown): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value as string | Date));
}

async function finish(input: LayoutInput): Promise<EmailMessage> {
  const {
    subject,
    text,
    brand: suppliedBrand,
    attachments: extraAttachments = [],
    ...layout
  } = input;
  const brand = suppliedBrand || (await getEmailBranding());
  return {
    to: layout.recipientEmail,
    subject,
    text,
    html: emailLayout({ ...layout, brand }),
    attachments: [...brand.logo.attachments, ...extraAttachments],
  };
}

export async function resetPassword({
  email,
  token,
  staff = false,
}: {
  email: string;
  token: string;
  staff?: boolean;
}): Promise<EmailMessage> {
  const path = staff ? "/staff/reset-password" : "/reset-password";
  const href = frontendUrl(`${path}?token=${encodeURIComponent(token)}`);
  return finish({
    recipientEmail: email,
    subject: "Reset your AbsoluteCare password",
    preheader:
      "Use this secure link to reset your AbsoluteCare password within 30 minutes.",
    title: "Reset your password",
    intro:
      "We received a request to reset the password for your AbsoluteCare account.",
    bodyHtml: staff
      ? `<p style="margin:0 0 20px;">This link is for your AbsoluteCare Staff Portal account.</p>`
      : "",
    primaryAction: {
      href,
      html: button({ href, label: "Reset your password" }),
    },
    secondaryHtml:
      callout({
        children: "This link expires in 30 minutes and can be used once.",
      }) +
      `<p style="margin:20px 0 0;font-size:14px;line-height:22px;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>`,
    text: `Reset your password\n\nWe received a request to reset the password for your AbsoluteCare account.${staff ? " This link is for your Staff Portal account." : ""}\n\nReset your password: ${href}\n\nThis link expires in 30 minutes and can be used once.\n\nIf you didn't request this, you can safely ignore this email. Your password won't change.`,
  });
}

export async function setPassword({
  email,
  token,
  staff = false,
}: {
  email: string;
  token: string;
  staff?: boolean;
}): Promise<EmailMessage> {
  const href = frontendUrl(
    `${staff ? "/staff/reset-password" : "/reset-password"}?token=${encodeURIComponent(token)}`,
  );
  return finish({
    recipientEmail: email,
    subject: "Set your AbsoluteCare password",
    preheader:
      "Set a password for your AbsoluteCare account while keeping Google sign-in active.",
    title: "Set a password for your account",
    intro:
      "Choose a password so you can use email and password sign-in whenever you need it.",
    bodyHtml:
      '<p style="margin:0 0 20px;">Your Google sign-in will continue working after you set a password.</p>',
    primaryAction: { href, html: button({ href, label: "Set your password" }) },
    secondaryHtml: callout({
      children: "This link expires in 30 minutes and can be used once.",
    }),
    text: `Set a password for your account\n\nChoose a password while keeping Google sign-in active.\n\nSet your password: ${href}\n\nThis link expires in 30 minutes and can be used once.`,
  });
}

export async function passwordChanged({
  email,
  changedAt = new Date(),
  phone = "",
}: {
  email: string;
  changedAt?: Date | string;
  phone?: string;
}): Promise<EmailMessage> {
  const when = dateTime(changedAt);
  return finish({
    recipientEmail: email,
    subject: "Your AbsoluteCare password was changed",
    preheader:
      "Your AbsoluteCare password was changed. Contact the clinic if this wasn't you.",
    title: "Your password was changed",
    intro: `Your password was changed on ${when}.`,
    bodyHtml: callout({
      tone: "danger",
      children: `Wasn't you? Contact the clinic right away${phone ? ` at <a href="tel:${escapeHtml(phone)}" style="color:#8F1D2C;">${escapeHtml(phone)}</a>` : "."}`,
    }),
    secondaryHtml:
      '<p style="margin:20px 0 0;font-size:14px;">If you made this change, no further action is needed.</p>',
    text: `Your password was changed\n\nYour password was changed on ${when}.\n\nWasn't you? Contact the clinic right away${phone ? ` at ${phone}.` : "."}`,
  });
}

export async function verificationCode({
  email,
  code,
  action = "this settings change",
  adminName = "an administrator",
  requestedAt = new Date(),
}: {
  email: string;
  code: string;
  action?: string;
  adminName?: string;
  requestedAt?: Date | string;
}): Promise<EmailMessage> {
  const when = dateTime(requestedAt);
  return finish({
    recipientEmail: email,
    subject: "Your AbsoluteCare verification code",
    preheader:
      "Your six-digit AbsoluteCare settings verification code expires in 10 minutes.",
    title: "Your verification code",
    intro: `${adminName} requested confirmation for ${action}.`,
    bodyHtml: `${codeBox(code)}<p style="margin:16px 0 0;text-align:center;font-size:14px;">Requested by ${escapeHtml(adminName)} on ${escapeHtml(when)}.</p>`,
    secondaryHtml: callout({
      children:
        "This code expires in 10 minutes. If this wasn't you, change your password now.",
      tone: "warning",
    }),
    text: `Your verification code\n\n${adminName} requested confirmation for ${action}.\n\nCode: ${code}\n\nThis code expires in 10 minutes. Requested on ${when}. If this wasn't you, change your password now.`,
  });
}

export async function staffInvitation({
  email,
  firstname,
  lastname,
  role,
  temporaryPassword,
  actionUrl = "/staff/login",
}: {
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  temporaryPassword: string;
  actionUrl?: string;
}): Promise<EmailMessage> {
  const href = frontendUrl(actionUrl);
  return finish({
    recipientEmail: email,
    subject: "Your AbsoluteCare staff account is ready",
    preheader:
      "Your AbsoluteCare staff account is ready. Sign in and change your temporary password.",
    title: "Your staff account is ready",
    intro: `Welcome ${firstname}. Your Staff Portal account has been created.`,
    bodyHtml: `${details([
      { label: "Role", value: role },
      { label: "Email", value: email },
    ])}<p style="margin:20px 0 8px;font-size:14px;color:#64748B;">Temporary password</p>${codeBox(temporaryPassword)}`,
    primaryAction: { href, html: button({ href, label: "Open Staff Portal" }) },
    secondaryHtml: callout({
      tone: "warning",
      children:
        "Change this temporary password immediately after your first login.",
    }),
    text: `Your staff account is ready\n\nWelcome ${firstname} ${lastname}.\nRole: ${role}\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nOpen Staff Portal: ${href}\n\nChange this temporary password immediately after your first login.`,
  });
}

function appointmentData(appointment: EmailAppointment | null = {}): {
  service: string;
  dateTime: string;
  therapist: string;
  patient: string;
} {
  appointment = appointment ?? {};
  const service: { name?: string } =
    appointment.service || appointment.serviceSnapshot || {};
  const dependent: EmailPerson = appointment.dependent || {};
  const patient: EmailPerson = appointment.patient || {};
  return {
    service: service.name || "Physical therapy appointment",
    dateTime: dateTime(appointment.scheduledStart || appointment.requestedDate),
    therapist: [
      appointment.therapist?.firstname || appointment.therapist?.firstName,
      appointment.therapist?.lastname || appointment.therapist?.lastName,
    ]
      .filter(Boolean)
      .join(" "),
    patient: dependent.firstName
      ? `${dependent.firstName} ${dependent.lastName || ""} (dependent)`
      : [
          patient.firstname || patient.firstName,
          patient.lastname || patient.lastName,
        ]
          .filter(Boolean)
          .join(" "),
  };
}

function calendarAttachment(
  appointment: EmailAppointment | null | undefined,
  brand: EmailBranding,
): EmailAttachment | null {
  if (!appointment?.scheduledStart) return null;
  const start = new Date(appointment.scheduledStart);
  const end = new Date(
    appointment.scheduledEnd || start.getTime() + 60 * 60 * 1000,
  );
  const format = (value: Date): string =>
    value
      .toISOString()
      .replaceAll("-", "")
      .replaceAll(":", "")
      .replace(/\.\d{3}Z$/, "Z");
  const data = appointmentData(appointment);
  const summary = `${data.service} - ${brand.clinicName}`.replace(
    /[\r\n,;]/g,
    " ",
  );
  const description =
    `AbsoluteCare appointment${data.therapist ? ` with ${data.therapist}` : ""}`.replace(
      /[\r\n,;]/g,
      " ",
    );
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AbsoluteCare//Therapy Center//EN",
    "BEGIN:VEVENT",
    `UID:${String(appointment._id || appointment.id)}@absolutecare`,
    `DTSTAMP:${format(new Date())}`,
    `DTSTART:${format(start)}`,
    `DTEND:${format(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${String(brand.address).replace(/[\r\n,;]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return {
    filename: "absolutecare-appointment.ics",
    content: ics,
    contentType: "text/calendar; charset=utf-8; method=REQUEST",
  };
}

async function appointmentTemplate(
  input: AppointmentTemplateInput,
): Promise<EmailMessage> {
  const {
    type,
    recipientEmail,
    appointment,
    title,
    intro,
    actionUrl,
    previousSchedule = "",
    reason = "",
    reminder = false,
  } = input;
  const brand = await getEmailBranding();
  const data = appointmentData(appointment);
  const href = frontendUrl(
    actionUrl ||
      `/dashboard/appointments/${String(appointment?._id || appointment?.id || "")}`,
  );
  const rows = details([
    { label: "Service", value: data.service },
    {
      label: "Date and time",
      value: data.dateTime || appointment?.requestedTime,
    },
    { label: "Therapist", value: data.therapist },
    { label: "Patient", value: data.patient },
    { label: "Clinic", value: brand.address },
  ]);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(brand.address)}`;
  const old = previousSchedule
    ? `<p style="margin:0 0 12px;">Previous time: <s>${escapeHtml(previousSchedule)}</s></p>`
    : "";
  const reasonHtml = reason
    ? `<p style="margin:16px 0 0;">Reason: ${escapeHtml(reason)}</p>`
    : "";
  const text = `${title}\n\n${intro}\n\nService: ${data.service}\nDate and time: ${data.dateTime || appointment?.requestedTime || "To be confirmed"}${data.therapist ? `\nTherapist: ${data.therapist}` : ""}${data.patient ? `\nPatient: ${data.patient}` : ""}\nClinic: ${brand.address}${previousSchedule ? `\nPrevious time: ${previousSchedule}` : ""}${reason ? `\nReason: ${reason}` : ""}\n\nView appointment: ${href}\nDirections: ${directionsUrl}`;
  return finish({
    recipientEmail,
    subject:
      type === "appointment_confirmed"
        ? `Your appointment is confirmed${data.dateTime ? `: ${data.dateTime}` : ""}`
        : title,
    preheader: `${title}. Review your AbsoluteCare appointment details.`,
    title,
    intro,
    bodyHtml: `${old}${rows}${reasonHtml}${reminder ? `<p style="margin:20px 0 0;">Please bring your referral, relevant records, and arrive a few minutes early.</p><p style="margin:12px 0 0;"><a href="${directionsUrl}" style="color:#0F3D3A;font-weight:bold;">Get directions to the clinic</a></p>` : ""}`,
    primaryAction: {
      href,
      html: button({
        href,
        label:
          type === "appointment_cancelled" ? "Book again" : "View appointment",
      }),
    },
    secondaryHtml: callout({
      children:
        "Please contact the clinic if you need to cancel or reschedule. Changes are subject to the clinic's cutoff policy.",
    }),
    brand,
    attachments:
      type === "appointment_confirmed"
        ? [calendarAttachment(appointment, brand)].filter(
            (attachment): attachment is EmailAttachment => Boolean(attachment),
          )
        : [],
    text,
  });
}

export const appointmentConfirmed = (
  data: AppointmentEmailInput,
): Promise<EmailMessage> =>
  appointmentTemplate({
    ...data,
    type: "appointment_confirmed",
    title: "Appointment confirmed",
    intro: "Your AbsoluteCare appointment has been confirmed.",
  });
export const appointmentRescheduled = (
  data: AppointmentEmailInput,
): Promise<EmailMessage> =>
  appointmentTemplate({
    ...data,
    type: "appointment_rescheduled",
    title: "Appointment rescheduled",
    intro: "Your AbsoluteCare appointment has been moved to a new time.",
  });
export const appointmentCancelled = (
  data: AppointmentEmailInput,
): Promise<EmailMessage> =>
  appointmentTemplate({
    ...data,
    type: "appointment_cancelled",
    title: "Appointment cancelled",
    intro: "Your AbsoluteCare appointment has been cancelled.",
  });
export const appointmentReminder = (
  data: AppointmentEmailInput,
): Promise<EmailMessage> =>
  appointmentTemplate({
    ...data,
    type: "appointment_reminder",
    title: data.leadHours
      ? `Appointment reminder: ${data.leadHours} hours`
      : "Appointment reminder",
    intro: "This is a reminder about your upcoming AbsoluteCare appointment.",
    reminder: true,
  });

export async function testEmail({
  email,
  senderAddress,
  sentAt = new Date(),
}: {
  email: string;
  senderAddress: string;
  sentAt?: Date | string;
}): Promise<EmailMessage> {
  const when = dateTime(sentAt);
  return finish({
    recipientEmail: email,
    subject: "Your AbsoluteCare email is working",
    preheader:
      "This test confirms that AbsoluteCare email delivery is working.",
    title: "Email is working",
    intro:
      "This test message confirms that your AbsoluteCare email provider is working.",
    bodyHtml: details([
      { label: "Sender address", value: senderAddress },
      { label: "Sent", value: when },
    ]),
    text: `Email is working\n\nSender address: ${senderAddress}\nSent: ${when}`,
  });
}

export async function renderNotificationEmail(
  input: { type: string } & NotificationEmailInput,
): Promise<EmailMessage> {
  const { type, ...data } = input;
  if (type === "appointment_confirmed") return appointmentConfirmed(data);
  if (type === "appointment_rescheduled") return appointmentRescheduled(data);
  if (type === "appointment_cancelled") return appointmentCancelled(data);
  if (type === "appointment_reminder") return appointmentReminder(data);
  if (type === "appointment_notice")
    return appointmentTemplate({
      ...data,
      type,
      title: data.title,
      intro: data.message,
    });
  return finish({
    recipientEmail: data.recipientEmail,
    subject: data.title,
    preheader: data.message,
    title: data.title,
    intro: data.message,
    bodyHtml: "",
    text: `${data.title}\n\n${data.message}`,
  });
}
