import { Types, type QueryFilter } from "mongoose";
import Appointment, {
  type Appointment as AppointmentRecord,
} from "../models/appointmentModel.js";
import User, {
  WEEKDAYS,
  type DayHours,
  type User as UserRecord,
  type UserDoc,
  type Weekday,
  type WorkingHours,
} from "../models/userModel.js";
import { notifyMany } from "./notificationService.js";

const dayNames: Record<Weekday, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Asia/Manila",
});

// h23 keeps midnight as 00:00; the legacy `hour12: false` can emit 24:00.
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Manila",
});

/** Clinic-local weekday for an instant, never the server's. */
export function manilaWeekday(date: Date): Weekday {
  return weekdayFormat.format(date) as Weekday;
}

/** Clinic-local `HH:mm` for an instant, comparable to stored schedule times. */
export function manilaClock(date: Date): string {
  return clockFormat.format(date);
}

/**
 * Reads the per-day schedule, falling back to the legacy global range for
 * documents that were never migrated.
 */
export function scheduleOf(user: {
  workingDays?: string[];
  workingHoursByDay?: DayHours[] | null;
  workingHours?: Partial<WorkingHours> | null;
}): DayHours[] {
  const byDay = user.workingHoursByDay;
  if (byDay?.length) {
    return byDay.map((entry) => ({
      day: entry.day,
      start: entry.start,
      end: entry.end,
    }));
  }
  const start = user.workingHours?.start || "08:00";
  const end = user.workingHours?.end || "17:00";
  return (user.workingDays || [])
    .filter((day) => (WEEKDAYS as string[]).includes(day))
    .map((day) => ({ day: day as Weekday, start, end }));
}

/** Derived outer bounds; written on every save and never read for scheduling. */
export function summarize(days: DayHours[]): WorkingHours {
  const [first] = days;
  if (!first) return { start: "08:00", end: "17:00" };
  return days.reduce<WorkingHours>(
    (bounds, day) => ({
      start: day.start < bounds.start ? day.start : bounds.start,
      end: day.end > bounds.end ? day.end : bounds.end,
    }),
    { start: first.start, end: first.end },
  );
}

/** `Mon–Fri 08:00–17:00 · Sat 09:00–12:00`, collapsing consecutive equal days. */
export function formatSchedule(days: DayHours[]): string {
  if (!days.length) return "No working days set";
  const order = WEEKDAYS as readonly string[];
  const sorted = [...days].sort(
    (first, second) => order.indexOf(first.day) - order.indexOf(second.day),
  );
  const groups: { from: number; to: number; hours: string }[] = [];
  for (const entry of sorted) {
    const index = order.indexOf(entry.day);
    const hours = `${entry.start}–${entry.end}`;
    const last = groups[groups.length - 1];
    if (last && last.hours === hours && last.to === index - 1) last.to = index;
    else groups.push({ from: index, to: index, hours });
  }
  return groups
    .map(
      (group) =>
        `${order[group.from]}${
          group.from === group.to ? "" : `–${order[group.to]}`
        } ${group.hours}`,
    )
    .join(" · ");
}

/**
 * Why this therapist cannot take an appointment in that window, or null when
 * they can. An empty schedule means "no restriction" and always passes.
 */
export function availabilityError(
  user: Parameters<typeof scheduleOf>[0],
  start: Date,
  end: Date,
): string | null {
  const days = scheduleOf(user);
  if (!days.length) return null;
  const day = manilaWeekday(start);
  const window = days.find((entry) => entry.day === day);
  if (!window) return `This therapist does not work on ${dayNames[day]}.`;
  if (manilaClock(start) < window.start || manilaClock(end) > window.end) {
    return `This therapist works ${window.start}–${window.end} on ${dayNames[day]}; the appointment falls outside those hours.`;
  }
  return null;
}

export type AvailabilityConflictReason =
  | "day_not_available"
  | "before_opening"
  | "after_closing";

export interface AvailabilityConflict {
  appointmentId: string;
  patientName: string;
  startsAt: string;
  endsAt: string;
  reason: AvailabilityConflictReason;
}

interface ConflictingAppointment {
  _id: Types.ObjectId;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  patient?: { firstname?: string; lastname?: string } | null;
}

/** Confirmed, still-upcoming appointments that fall outside the proposed schedule. */
export async function findConflicts(
  therapistId: string,
  days: DayHours[],
): Promise<AvailabilityConflict[]> {
  if (!days.length) return [];
  const appointments = await Appointment.find({
    therapist: therapistId,
    status: "confirmed",
    scheduledStart: { $gte: new Date() },
  } as QueryFilter<AppointmentRecord>)
    .populate("patient", "firstname lastname")
    .sort({ scheduledStart: 1 })
    .lean();
  const conflicts: AvailabilityConflict[] = [];
  for (const appointment of appointments as unknown as ConflictingAppointment[]) {
    if (!appointment.scheduledStart) continue;
    const start = appointment.scheduledStart;
    const end = appointment.scheduledEnd ?? start;
    const base = {
      appointmentId: String(appointment._id),
      patientName:
        `${appointment.patient?.firstname || ""} ${appointment.patient?.lastname || ""}`.trim() ||
        "Patient",
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    };
    const window = days.find((entry) => entry.day === manilaWeekday(start));
    if (!window) {
      conflicts.push({ ...base, reason: "day_not_available" });
    } else if (manilaClock(start) < window.start) {
      conflicts.push({ ...base, reason: "before_opening" });
    } else if (manilaClock(end) > window.end) {
      conflicts.push({ ...base, reason: "after_closing" });
    }
  }
  return conflicts;
}

export function conflictMessage(count: number): string {
  return count === 1
    ? "1 confirmed appointment falls outside this schedule. Reschedule or cancel it first."
    : `${count} confirmed appointments fall outside this schedule. Reschedule or cancel them first.`;
}

export function scheduleConflictPayload(
  conflicts: AvailabilityConflict[],
): Record<string, unknown> {
  return { message: conflictMessage(conflicts.length), conflicts };
}

/** Persists availability, audits the before/after, and tells the admins. */
export async function saveAvailability(params: {
  therapist: UserDoc;
  days: DayHours[];
  actorId: string;
  byAdmin: boolean;
}): Promise<DayHours[]> {
  const { therapist, days, actorId, byAdmin } = params;
  const before = formatSchedule(scheduleOf(therapist));
  therapist.workingDays = days.map((entry) => entry.day);
  therapist.workingHoursByDay = days;
  therapist.workingHours = summarize(days);
  therapist.accountAudit.push({
    action: byAdmin ? "availability-updated:by-admin" : "availability-updated",
    by: new Types.ObjectId(actorId),
    at: new Date(),
    details: `${before} → ${formatSchedule(days)}`,
  });
  await therapist.save();
  await notifyAvailabilityChanged(therapist, days, actorId);
  return days;
}

/**
 * Notifies every active admin. `notify` already drops the actor and handles
 * in-app plus email, and an email failure never fails the save.
 */
async function notifyAvailabilityChanged(
  therapist: UserDoc,
  days: DayHours[],
  actorId: string,
): Promise<void> {
  const admins = await User.find({
    role: "admin",
    isActive: true,
    isArchived: false,
    removedAt: null,
  } as QueryFilter<UserRecord>).select("_id");
  if (!admins.length) return;
  await notifyMany(
    admins.map((admin) => admin._id),
    {
      type: "availability_updated",
      title: "Therapist availability updated",
      message: `${therapist.firstname} ${therapist.lastname}'s schedule is now ${formatSchedule(days)}.`,
      link: "/staff/admin/therapists",
      actorId,
    },
  );
}
