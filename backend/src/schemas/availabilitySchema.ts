import z from "zod";
import { WEEKDAYS, type DayHours, type Weekday } from "../models/userModel.js";

const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dayHoursSchema = z
  .object({
    day: z.enum(WEEKDAYS as [Weekday, ...Weekday[]], {
      message: "Choose a valid working day.",
    }),
    start: z
      .string()
      .regex(clockPattern, "Enter a start time as HH:mm, e.g. 08:00."),
    end: z
      .string()
      .regex(clockPattern, "Enter an end time as HH:mm, e.g. 17:00."),
  })
  .refine((value) => value.start < value.end, {
    message: "End time must be after the start time.",
    path: ["end"],
  });

export const availabilitySchema = z
  .object({
    workingDays: z
      .array(z.enum(WEEKDAYS as [Weekday, ...Weekday[]]))
      .min(1, "Choose at least one working day."),
    workingHoursByDay: z.array(dayHoursSchema).optional(),
  })
  .superRefine((value, ctx) => {
    const duplicates = value.workingDays.filter(
      (day, index) => value.workingDays.indexOf(day) !== index,
    );
    if (duplicates.length) {
      ctx.addIssue({
        code: "custom",
        path: ["workingDays"],
        message: `${duplicates[0]} is selected more than once.`,
      });
    }
    const hours = value.workingHoursByDay;
    if (!hours) return;
    for (const entry of hours) {
      if (!value.workingDays.includes(entry.day)) {
        ctx.addIssue({
          code: "custom",
          path: ["workingHoursByDay"],
          message: `${entry.day} has hours set but is not a selected working day.`,
        });
      }
    }
    for (const day of value.workingDays) {
      if (!hours.some((entry) => entry.day === day)) {
        ctx.addIssue({
          code: "custom",
          path: ["workingHoursByDay"],
          message: `Add a start and end time for ${day}.`,
        });
      }
    }
  });

export type AvailabilityInput = z.infer<typeof availabilitySchema>;

const defaultHours = { start: "08:00", end: "17:00" };

/**
 * Turns a request into the canonical per-day schedule. A body that still sends
 * only the legacy `workingHours` is expanded onto every selected day.
 */
export function normalizeAvailability(
  input: AvailabilityInput,
  legacyHours?: { start?: string; end?: string },
): DayHours[] {
  const seed = {
    start: legacyHours?.start || defaultHours.start,
    end: legacyHours?.end || defaultHours.end,
  };
  return input.workingDays.map((day) => {
    const entry = input.workingHoursByDay?.find((item) => item.day === day);
    return entry
      ? { day, start: entry.start, end: entry.end }
      : { day, ...seed };
  });
}
