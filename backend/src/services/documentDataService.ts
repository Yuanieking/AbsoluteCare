import { Types, type QueryFilter } from "mongoose";
import Appointment, {
  type Appointment as AppointmentData,
} from "../models/appointmentModel.js";
import Dependent from "../models/dependentModel.js";
import type { DocumentType } from "../models/generatedDocumentModel.js";
import Session, { type Session as SessionData } from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { AppError } from "../errors/AppError.js";
import type { DocumentCreateInput } from "../schemas/documentSchema.js";
import { getReportData } from "./adminMonitoringService.js";
import { getSettings } from "./settingsService.js";

export type StaffRole = "admin" | "secretary" | "therapist";

export interface DocumentActor {
  id: string;
  role: StaffRole;
  name: string;
}

export interface DocumentTable {
  columns: string[];
  rows: string[][];
  emptyText?: string | undefined;
}

export interface DocumentSection {
  heading?: string | undefined;
  paragraphs?: string[] | undefined;
  facts?: Array<[string, string]> | undefined;
  tables?: DocumentTable[] | undefined;
  note?: string | undefined;
}

export interface DocumentPayload {
  type: DocumentType;
  title: string;
  subject: string;
  sections: DocumentSection[];
  patient: Types.ObjectId | null;
  dependent: Types.ObjectId | null;
  appointment: Types.ObjectId | null;
  rangeFrom: Date | null;
  rangeTo: Date | null;
}

interface GeneralSettings {
  timezone: string;
  currency: string;
}

function dateFormatter(general: GeneralSettings, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: general.timezone || "Asia/Manila",
    ...options,
  });
}

function dateLabel(value: Date, general: GeneralSettings): string {
  return dateFormatter(general, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value);
}

function monthLabel(value: Date, general: GeneralSettings): string {
  return dateFormatter(general, { year: "numeric", month: "long" }).format(value);
}

function dateTimeLabel(value: Date, general: GeneralSettings): string {
  return dateFormatter(general, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function timeZoneLabel(general: GeneralSettings): string {
  const parts = dateFormatter(general, { timeZoneName: "short" }).formatToParts(
    new Date(),
  );
  return parts.find((part) => part.type === "timeZoneName")?.value ?? general.timezone;
}

function storedDateLabel(value: string | Date | null | undefined, general: GeneralSettings): string {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : dateLabel(parsed, general);
}

function moneyLabel(amount: number, general: GeneralSettings): string {
  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${general.currency || "PHP"} ${formatted}`;
}

function minutesLabel(minutes: number): string {
  const total = Math.max(Math.round(minutes || 0), 0);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  card: "Card",
  other: "Other",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function truncate(text: string, limit = 2000): string {
  const clean = String(text || "").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function refId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return String(value);
  const id = (value as { _id?: unknown })._id;
  return id ? String(id) : "";
}

function personName(
  person: { firstname?: string; lastname?: string } | null | undefined,
): string {
  return `${person?.firstname || ""} ${person?.lastname || ""}`.trim();
}

interface PatientIdentity {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
}

interface DependentIdentity {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  sex: string;
  relationship: string;
}

interface AppointmentView {
  _id: Types.ObjectId;
  patient: PatientIdentity | null;
  dependent: DependentIdentity | null;
  therapist: { firstname: string; lastname: string } | null;
  service: { name: string; duration: number; fee: number } | null;
  serviceSnapshot: { name: string; duration: number; fee: number };
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  requestedDate: string;
  requestedTime: string;
  status: string;
  payment: {
    status: string;
    amount: number;
    method: string;
    referenceNumber: string;
    recordedBy: { firstname: string; lastname: string } | null;
    recordedAt: Date | null;
  };
  notes: string;
  auditLog: Array<{ action: string; at?: Date }>;
  createdAt: Date;
}

const APPOINTMENT_POPULATION = [
  { path: "patient", select: "firstname lastname email phone address dateOfBirth" },
  {
    path: "dependent",
    select: "firstName lastName dateOfBirth sex relationship",
  },
  { path: "therapist", select: "firstname lastname" },
  { path: "service", select: "name duration fee" },
  { path: "payment.recordedBy", select: "firstname lastname" },
];

async function loadAppointment(id: string): Promise<AppointmentView> {
  const appointment = await Appointment.findById(id).populate(
    APPOINTMENT_POPULATION,
  );
  if (!appointment) throw new AppError(404, { message: "Appointment not found." });
  return appointment as unknown as AppointmentView;
}

function appointmentSubject(view: AppointmentView): string {
  return view.dependent
    ? `${view.dependent.firstName} ${view.dependent.lastName}`.trim()
    : personName(view.patient);
}

async function clinicReportPayload(
  from: Date,
  to: Date,
  general: GeneralSettings,
): Promise<DocumentPayload> {
  const report = await getReportData(from, to);
  const totalAppointments = report.appointments.reduce(
    (total, row) => total + row.count,
    0,
  );
  const completed =
    report.appointments.find((row) => row._id === "completed")?.count ?? 0;
  const completionRate = totalAppointments
    ? `${Math.round((completed / totalAppointments) * 100)}%`
    : "0%";
  const sessionsTotal = report.sessions.reduce(
    (total, row) => total + (row.count || 0),
    0,
  );
  const therapyMinutes = report.sessions.reduce(
    (total, row) => total + (row.duration || 0),
    0,
  );
  const revenue = report.payments.reduce((total, row) => total + (row.total || 0), 0);
  const unpaid = report.unpaid[0] ?? { total: 0, count: 0 };

  return {
    type: "clinic_report",
    title: `Clinic activity report · ${monthLabel(to, general)}`,
    subject: `${dateLabel(from, general)} – ${dateLabel(to, general)}`,
    patient: null,
    dependent: null,
    appointment: null,
    rangeFrom: from,
    rangeTo: to,
    sections: [
      {
        paragraphs: [
          `Period covered: ${dateLabel(from, general)} to ${dateLabel(to, general)}.`,
        ],
      },
      {
        heading: "Clinic summary",
        facts: [
          ["Registered patients", String(report.patientCount)],
          ["New patients in this period", String(report.newPatients)],
          ["Patients with a recorded session", String(report.completedPatients)],
          ["Appointments booked", String(totalAppointments)],
          ["Appointment completion rate", completionRate],
          ["Sessions recorded", String(sessionsTotal)],
          ["Therapy time", minutesLabel(therapyMinutes)],
          ["Payments collected", moneyLabel(revenue, general)],
          ["Open balances", `${moneyLabel(unpaid.total, general)} across ${unpaid.count} unsettled visits`],
        ],
      },
      {
        heading: "Appointments by status",
        tables: [
          {
            columns: ["Status", "Count"],
            rows: report.appointments.map((row) => [
              statusLabel(row._id),
              String(row.count),
            ]),
            emptyText: "No appointments in this period.",
          },
        ],
      },
      {
        heading: "Therapist workload",
        tables: [
          {
            columns: ["Therapist", "Assigned", "Completed"],
            rows: report.therapistWorkload.map((row) => [
              row.name,
              String(row.assigned),
              String(row.completed),
            ]),
            emptyText: "No therapist assignments in this period.",
          },
        ],
      },
      {
        heading: "Sessions by service",
        tables: [
          {
            columns: ["Service", "Sessions", "Therapy time"],
            rows: report.sessions.map((row) => [
              row._id ?? "Unassigned",
              String(row.count),
              minutesLabel(row.duration),
            ]),
            emptyText: "No sessions recorded in this period.",
          },
        ],
      },
      {
        heading: "Payments by method",
        tables: [
          {
            columns: ["Method", "Visits", "Collected"],
            rows: report.payments.map((row) => [
              METHOD_LABELS[row._id ?? ""] ?? row._id ?? "Unspecified",
              String(row.count),
              moneyLabel(row.total, general),
            ]),
            emptyText: "No payments collected in this period.",
          },
        ],
      },
      {
        note: `Figures are drawn from the patient, appointment, session and payment records in the clinic database for ${timeZoneLabel(general)}. Open balances are visits whose payment is not marked paid.`,
      },
    ],
  };
}

async function patientSummaryPayload(
  input: Extract<DocumentCreateInput, { type: "patient_summary" }>,
  actor: DocumentActor,
  general: GeneralSettings,
): Promise<DocumentPayload> {
  const patient = await User.findById(input.patientId).select(
    "firstname lastname email phone address dateOfBirth role removedAt",
  );
  if (!patient || patient.role !== "user" || patient.removedAt) {
    throw new AppError(404, { message: "Patient not found." });
  }

  let dependent: DependentIdentity | null = null;
  if (input.dependentId) {
    const record = await Dependent.findById(input.dependentId);
    if (!record || String(record.guardian) !== String(patient._id)) {
      throw new AppError(400, {
        message: "That dependent does not belong to this patient.",
      });
    }
    dependent = record as unknown as DependentIdentity;
  }

  if (actor.role === "therapist") {
    const [session, appointment] = await Promise.all([
      Session.exists({ patient: patient._id, therapist: actor.id }),
      Appointment.exists({ patient: patient._id, therapist: actor.id }),
    ]);
    if (!session && !appointment) {
      throw new AppError(403, {
        message: "This patient is not on your caseload.",
      });
    }
  }

  // patientVisibleNotes is projected explicitly: clinicalNotes must never be read.
  const sessions = await Session.find({
    patient: patient._id,
    dependent: dependent ? new Types.ObjectId(input.dependentId) : null,
    sessionDate: { $gte: input.from, $lte: input.to },
  } as unknown as QueryFilter<SessionData>)
    .select(
      "sessionDate therapist durationMinutes patientVisibleNotes service",
    )
    .populate("therapist", "firstname lastname")
    .populate("service", "name")
    .sort({ sessionDate: 1 });

  const rows = sessions as unknown as Array<{
    sessionDate: Date;
    durationMinutes: number;
    patientVisibleNotes: string;
    therapist: { firstname: string; lastname: string } | null;
    service: { name: string } | null;
  }>;

  const adherence = await Appointment.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        patient: patient._id,
        dependent: dependent ? new Types.ObjectId(input.dependentId) : null,
        scheduledStart: { $gte: input.from, $lte: input.to },
      },
    },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const totalMinutes = rows.reduce(
    (total, row) => total + (row.durationMinutes || 0),
    0,
  );
  const therapists = [
    ...new Set(rows.map((row) => personName(row.therapist)).filter(Boolean)),
  ];
  const countOf = (status: string) =>
    String(adherence.find((row) => row._id === status)?.count ?? 0);
  const identity: Array<[string, string]> = dependent
    ? [
        ["Patient", personName(patient)],
        ["Dependent", `${dependent.firstName} ${dependent.lastName}`.trim()],
        ["Relationship", dependent.relationship || "—"],
        [
          "Date of birth",
          storedDateLabel(dependent.dateOfBirth, general) || "—",
        ],
      ]
    : [
        ["Patient", personName(patient)],
        ["Date of birth", storedDateLabel(patient.dateOfBirth, general) || "—"],
      ];
  const contact: Array<[string, string]> = dependent
    ? []
    : [
        ["Phone", patient.phone || ""],
        ["Email", patient.email || ""],
        ["Address", patient.address || ""],
      ];

  return {
    type: "patient_summary",
    title: `Patient therapy summary · ${monthLabel(input.to, general)}`,
    subject: dependent
      ? `${dependent.firstName} ${dependent.lastName}`.trim()
      : personName(patient),
    patient: patient._id as Types.ObjectId,
    dependent: dependent ? new Types.ObjectId(input.dependentId) : null,
    appointment: null,
    rangeFrom: input.from,
    rangeTo: input.to,
    sections: [
      {
        heading: "Patient",
        facts: [...identity, ...contact.filter(([, value]) => Boolean(value))],
      },
      {
        heading: "Care period",
        paragraphs: [
          `${dateLabel(input.from, general)} to ${dateLabel(input.to, general)} · ${rows.length} session${rows.length === 1 ? "" : "s"} · ${minutesLabel(totalMinutes)} of therapy.`,
        ],
        facts: [
          ["Treating therapists", therapists.length ? therapists.join(", ") : "None recorded"],
        ],
      },
      {
        heading: "Sessions",
        tables: [
          {
            columns: ["Date", "Therapist", "Service", "Duration", "Notes"],
            rows: rows.map((row) => [
              dateLabel(row.sessionDate, general),
              personName(row.therapist) || "Unassigned",
              row.service?.name || "Unassigned",
              minutesLabel(row.durationMinutes),
              truncate(row.patientVisibleNotes) || "—",
            ]),
            emptyText: "No sessions recorded in this period.",
          },
        ],
      },
      {
        heading: "Appointment adherence",
        tables: [
          {
            columns: ["Outcome", "Appointments"],
            rows: [
              ["Booked", String(adherence.reduce((total, row) => total + row.count, 0))],
              ["Completed", countOf("completed")],
              ["Cancelled", countOf("cancelled")],
              ["No-show", countOf("no_show")],
            ],
          },
        ],
      },
      {
        note: "This summary lists patient-visible session notes only. Clinical notes stay in the internal record.",
      },
    ],
  };
}

function visitRecordPayload(
  view: AppointmentView,
  general: GeneralSettings,
): DocumentPayload {
  const when = view.scheduledStart ?? view.createdAt;
  const service = view.service ?? view.serviceSnapshot;
  const start = view.scheduledStart
    ? dateTimeLabel(view.scheduledStart, general)
    : `${storedDateLabel(view.requestedDate, general)} ${view.requestedTime}`.trim();
  const patientFacts: Array<[string, string]> = view.dependent
    ? [
        ["Patient", personName(view.patient)],
        ["Dependent", `${view.dependent.firstName} ${view.dependent.lastName}`.trim()],
        ["Relationship", view.dependent.relationship || "—"],
        [
          "Date of birth",
          storedDateLabel(view.dependent.dateOfBirth, general) || "—",
        ],
      ]
    : [
        ["Patient", personName(view.patient)],
        ["Date of birth", storedDateLabel(view.patient?.dateOfBirth, general) || "—"],
        ["Phone", view.patient?.phone || ""],
        ["Email", view.patient?.email || ""],
      ];

  return {
    type: "visit_record",
    title: `Visit record · ${dateLabel(when, general)}`,
    subject: appointmentSubject(view),
    patient: (view.patient as unknown as { _id?: Types.ObjectId })?._id ?? null,
    dependent: view.dependent
      ? ((view.dependent as unknown as { _id?: Types.ObjectId })._id ?? null)
      : null,
    appointment: view._id,
    rangeFrom: null,
    rangeTo: null,
    sections: [
      {
        heading: "Appointment",
        facts: [
          ["Reference", `#${String(view._id).slice(-8).toUpperCase()}`],
          ["Status", statusLabel(view.status)],
          ["Scheduled", start],
          [
            "Ends",
            view.scheduledEnd ? dateTimeLabel(view.scheduledEnd, general) : "Not set",
          ],
          ["Therapist", personName(view.therapist) || "To be assigned"],
          ["Service", service?.name || "Unassigned"],
          ["Duration", minutesLabel(service?.duration || 0)],
        ],
      },
      {
        heading: "Patient",
        facts: patientFacts.filter(([, value]) => Boolean(value)),
      },
      {
        heading: "Payment",
        facts: [
          [
            "Status",
            view.payment.status === "paid"
              ? `Paid · ${moneyLabel(view.payment.amount, general)} (${METHOD_LABELS[view.payment.method] ?? view.payment.method})`
              : "Unpaid",
          ],
          ...(view.payment.referenceNumber
            ? ([["Reference number", view.payment.referenceNumber]] as Array<
                [string, string]
              >)
            : []),
        ],
      },
      ...(view.notes
        ? [
            {
              heading: "Appointment notes",
              paragraphs: [truncate(view.notes)],
            },
          ]
        : []),
      {
        heading: "Audit summary",
        tables: [
          {
            columns: ["Event", "When"],
            rows: view.auditLog.map((entry) => [
              entry.action.replaceAll("_", " "),
              entry.at ? dateTimeLabel(new Date(entry.at), general) : "—",
            ]),
            emptyText: `Recorded with status ${statusLabel(view.status)}.`,
          },
        ],
      },
    ],
  };
}

function receiptPayload(
  view: AppointmentView,
  general: GeneralSettings,
): DocumentPayload {
  const payer = appointmentSubject(view);
  const visit = view.scheduledStart ?? view.createdAt;
  return {
    type: "receipt",
    title: "Payment receipt",
    subject: payer,
    patient: (view.patient as unknown as { _id?: Types.ObjectId })?._id ?? null,
    dependent: view.dependent
      ? ((view.dependent as unknown as { _id?: Types.ObjectId })._id ?? null)
      : null,
    appointment: view._id,
    rangeFrom: null,
    rangeTo: null,
    sections: [
      {
        heading: "Receipt",
        facts: [
          ["Receipt number", "{{tracking}}"],
          [
            "Payment date",
            view.payment.recordedAt
              ? dateTimeLabel(view.payment.recordedAt, general)
              : dateLabel(view.createdAt, general),
          ],
          ["Payer", payer],
          ["Service", view.service?.name || view.serviceSnapshot.name || "Unassigned"],
          ["Visit date", dateLabel(visit, general)],
          ["Amount paid", moneyLabel(view.payment.amount, general)],
          ["Method", METHOD_LABELS[view.payment.method] ?? view.payment.method],
          ...(view.payment.referenceNumber
            ? ([["Reference number", view.payment.referenceNumber]] as Array<
                [string, string]
              >)
            : []),
          [
            "Received by",
            personName(view.payment.recordedBy) || "Front desk",
          ],
        ],
        note: "This receipt covers the visit listed above only.",
      },
    ],
  };
}

export async function buildDocumentPayload(
  input: DocumentCreateInput,
  actor: DocumentActor,
): Promise<DocumentPayload> {
  const settings = await getSettings();
  const general: GeneralSettings = {
    timezone: settings.general.timezone || "Asia/Manila",
    currency: settings.general.currency || "PHP",
  };

  if (input.type === "clinic_report") {
    if (actor.role !== "admin") {
      throw new AppError(403, {
        message: "Only an administrator can issue a clinic activity report.",
      });
    }
    return clinicReportPayload(input.from, input.to, general);
  }

  if (input.type === "patient_summary") {
    return patientSummaryPayload(input, actor, general);
  }

  if (input.type === "receipt" && actor.role === "therapist") {
    throw new AppError(403, {
      message: "Therapists cannot issue payment receipts.",
    });
  }

  const appointment = await loadAppointment(input.appointmentId);
  if (
    actor.role === "therapist" &&
    refId(appointment.therapist) !== actor.id
  ) {
    throw new AppError(404, { message: "Appointment not found." });
  }

  if (input.type === "receipt") {
    if (appointment.payment.status !== "paid") {
      throw new AppError(409, {
        message: "A receipt can only be issued for a paid visit.",
      });
    }
    return receiptPayload(appointment, general);
  }

  return visitRecordPayload(appointment, general);
}
