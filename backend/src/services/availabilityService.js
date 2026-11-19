import { Types } from "mongoose";
import Appointment from "../models/appointmentModel.js";
import User, { WEEKDAYS } from "../models/userModel.js";
import { notifyMany } from "./notificationService.js";
import { clinicDay, manilaDateTime } from "../utils/appointmentDates.js";

const dayNames = {
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
export function manilaWeekday(date) {
  return weekdayFormat.format(date);
}

/** Clinic-local `HH:mm` for an instant, comparable to stored schedule times. */
export function manilaClock(date) {
  return clockFormat.format(date);
}

/**
 * Reads the per-day schedule, falling back to the legacy global range for
 * documents that were never migrated.
 */
export function scheduleOf(user) {
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
    .filter((day) => WEEKDAYS.includes(day))
    .map((day) => ({ day: day, start, end }));
}

/** Derived outer bounds; written on every save and never read for scheduling. */
export function summarize(days) {
  const [first] = days;
  if (!first) return { start: "08:00", end: "17:00" };
  return days.reduce(
    (bounds, day) => ({
      start: day.start < bounds.start ? day.start : bounds.start,
      end: day.end > bounds.end ? day.end : bounds.end,
    }),
    { start: first.start, end: first.end },
  );
}

/** `Mon–Fri 08:00–17:00 · Sat 09:00–12:00`, collapsing consecutive equal days. */
export function formatSchedule(days) {
  if (!days.length) return "No working days set";
  const order = WEEKDAYS;
  const sorted = [...days].sort(
    (first, second) => order.indexOf(first.day) - order.indexOf(second.day),
  );
  const groups = [];
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

function specializationsOf(therapist) {
  return Array.isArray(therapist.specialization)
    ? therapist.specialization
    : [therapist.specialization].filter(Boolean);
}

// "Physical Therapist (PTs)" and "Physical Therapy" both stem to [physi, thera].
function stems(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 5));
}

/** Every word of the shorter label appears in the longer one. */
function labelsMatch(first, second) {
  const a = stems(first);
  const b = stems(second);
  if (!a.length || !b.length) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((word) => longer.includes(word));
}

/** True when one of the therapist's specializations covers the service's category or name. */
export function coversService(therapist, service) {
  const specializations = specializationsOf(therapist);
  if (!specializations.length) return true;
  return specializations.some(
    (item) =>
      labelsMatch(item, service.category) || labelsMatch(item, service.name),
  );
}

/**
 * A service no specialist covers (e.g. a general consultation) stays open to
 * every therapist instead of becoming unbookable.
 */
export function needsSpecialist(service, therapists) {
  return therapists.some(
    (therapist) =>
      specializationsOf(therapist).length && coversService(therapist, service),
  );
}

/** First failure wins, and each failure names the rule that blocked it. */
export function therapistMismatch(
  therapist,
  service,
  start,
  end,
  specialistOnly = true,
) {
  if (specialistOnly && !coversService(therapist, service)) {
    return `This therapist's specialization does not cover ${service.name}.`;
  }
  return availabilityError(therapist, start, end);
}

export async function bookingTimes(
  service,
  date,
  therapistId = null,
  options = {},
) {
  const activeTherapists = await User.find({
    role: "therapist",
    isActive: true,
    isArchived: false,
    removedAt: null,
  }).select(
    "specialization workingDays workingHours workingHoursByDay dateOverrides",
  );
  const specialistOnly = needsSpecialist(service, activeTherapists);
  const therapists = therapistId
    ? activeTherapists.filter((user) => String(user._id) === String(therapistId))
    : activeTherapists;
  const dayStart = manilaDateTime(date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const appointments = await Appointment.find({
    therapist: { $in: therapists.map((user) => user._id) },
    status: "confirmed",
    scheduledStart: { $lt: dayEnd },
    scheduledEnd: { $gt: dayStart },
    ...(options.excludeId ? { _id: { $ne: options.excludeId } } : {}),
  }).select("therapist scheduledStart scheduledEnd");
  const times = [];
  const requestedMinute = options.time
    ? Number(options.time.slice(0, 2)) * 60 + Number(options.time.slice(3))
    : null;
  for (
    let minute = requestedMinute ?? 0;
    minute < (requestedMinute === null ? 1440 : requestedMinute + 1);
    minute += 15
  ) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const start = manilaDateTime(date, time);
    const end = new Date(start.getTime() + service.duration * 60_000);
    if (start <= new Date()) continue;
    if (
      therapists.some(
        (user) =>
          !therapistMismatch(user, service, start, end, specialistOnly) &&
          !appointments.some(
            (visit) =>
              String(visit.therapist) === String(user._id) &&
              visit.scheduledStart < end &&
              visit.scheduledEnd > start,
          ),
      )
    )
      times.push(time);
  }
  return times;
}

/**
 * Why this therapist cannot take an appointment in that window, or null when
 * they can. Date overrides take priority; unset schedules use 08:00–17:00.
 */
export function availabilityError(user, start, end) {
  if (
    !Number.isFinite(start?.getTime()) ||
    !Number.isFinite(end?.getTime()) ||
    end <= start
  ) {
    return "Choose a valid appointment time and duration.";
  }
  if (clinicDay(start) !== clinicDay(end))
    return "The appointment must end on the same clinic day.";
  const days = scheduleOf(user);
  const day = manilaWeekday(start);
  const override = user.dateOverrides?.find(
    (entry) => entry.date === clinicDay(start),
  );
  if (override?.unavailable)
    return "This therapist is unavailable on this date.";
  const window =
    override ||
    (days.length
      ? days.find((entry) => entry.day === day)
      : { start: "08:00", end: "17:00" });
  if (!window) return `This therapist does not work on ${dayNames[day]}.`;
  if (manilaClock(start) < window.start || manilaClock(end) > window.end) {
    return `This therapist works ${window.start}–${window.end} on ${dayNames[day]}; the appointment falls outside those hours.`;
  }
  return null;
}

/** Pending or confirmed, still-upcoming appointments that fall outside the proposed schedule. */
export async function findConflicts(therapistId, days, dateOverrides = []) {
  const appointments = await Appointment.find({
    therapist: therapistId,
    status: { $in: ["pending", "confirmed"] },
    $or: [
      { scheduledStart: { $gte: new Date() } },
      { scheduledStart: null, requestedDate: { $gte: clinicDay(new Date()) } },
    ],
  })
    .populate("patient", "firstname lastname")
    .sort({ scheduledStart: 1 })
    .lean();
  const conflicts = [];
  for (const appointment of appointments) {
    const start =
      appointment.scheduledStart ||
      manilaDateTime(appointment.requestedDate, appointment.requestedTime);
    const end =
      appointment.scheduledEnd ||
      new Date(
        start.getTime() +
          (appointment.serviceSnapshot?.duration || 60) * 60_000,
      );
    if (start < new Date()) continue;
    const base = {
      appointmentId: String(appointment._id),
      patientName:
        `${appointment.patient?.firstname || ""} ${appointment.patient?.lastname || ""}`.trim() ||
        "Patient",
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    };
    const override = dateOverrides.find(
      (entry) => entry.date === clinicDay(start),
    );
    const window =
      override || days.find((entry) => entry.day === manilaWeekday(start));
    if (
      availabilityError({ workingHoursByDay: days, dateOverrides }, start, end)
    ) {
      const reason =
        override?.unavailable || clinicDay(start) !== clinicDay(end)
          ? "outside_availability"
          : !window
            ? "day_not_available"
            : manilaClock(start) < window.start
              ? "before_opening"
              : "after_closing";
      conflicts.push({ ...base, reason });
    }
  }
  return conflicts;
}

export function conflictMessage(count) {
  return count === 1
    ? "1 active appointment falls outside this schedule. Reschedule or cancel it first."
    : `${count} active appointments fall outside this schedule. Reschedule or cancel them first.`;
}

export function scheduleConflictPayload(conflicts) {
  return { message: conflictMessage(conflicts.length), conflicts };
}

/** Persists availability, audits the before/after, and tells the admins. */
export async function saveAvailability(params) {
  const { therapist, days, actorId, byAdmin } = params;
  const dateOverrides = params.dateOverrides ?? therapist.dateOverrides ?? [];
  const before = formatSchedule(scheduleOf(therapist));
  therapist.workingDays = days.map((entry) => entry.day);
  const previousOverrides = JSON.stringify(therapist.dateOverrides || []);
  therapist.workingHoursByDay = days;
  therapist.dateOverrides = dateOverrides;
  therapist.workingHours = summarize(days);
  therapist.accountAudit.push({
    action: byAdmin ? "availability-updated:by-admin" : "availability-updated",
    by: new Types.ObjectId(actorId),
    at: new Date(),
    details: `${before} → ${formatSchedule(days)}; date overrides: ${previousOverrides} → ${JSON.stringify(dateOverrides)}`,
  });
  await therapist.save();
  await notifyAvailabilityChanged(therapist, days, actorId);
  return days;
}

/**
 * Notifies every active admin. `notify` already drops the actor and handles
 * in-app plus email, and an email failure never fails the save.
 */
async function notifyAvailabilityChanged(therapist, days, actorId) {
  const admins = await User.find({
    role: "admin",
    isActive: true,
    isArchived: false,
    removedAt: null,
  }).select("_id");
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
