import z from "zod";
import { WEEKDAYS } from "../models/userModel.js";

const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const bookingAvailabilitySchema = z.object({
  service: z.string().regex(/^[a-f\d]{24}$/i, "Choose a therapy service."),
  date: z.iso.date(),
});

export const dayHoursSchema = z
  .object({
    day: z.enum(WEEKDAYS, {
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

export const dateOverrideSchema = z
  .object({
    date: z.iso.date(),
    unavailable: z.boolean().default(false),
    start: z.string().regex(clockPattern).default("08:00"),
    end: z.string().regex(clockPattern).default("17:00"),
  })
  .refine((value) => value.unavailable || value.start < value.end, {
    message: "End time must be after the start time.",
    path: ["end"],
  });

export const availabilitySchema = z
  .object({
    workingDays: z
      .array(z.enum(WEEKDAYS))
      .min(1, "Choose at least one working day."),
    workingHoursByDay: z.array(dayHoursSchema).optional(),
    dateOverrides: z.array(dateOverrideSchema).max(366).optional(),
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
    const dates = value.dateOverrides?.map((entry) => entry.date) || [];
    if (new Set(dates).size !== dates.length) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOverrides"],
        message: "Choose each date only once.",
      });
    }
    const hours = value.workingHoursByDay;
    if (
      hours &&
      new Set(hours.map((entry) => entry.day)).size !== hours.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["workingHoursByDay"],
        message: "Choose each weekday only once.",
      });
    }
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

const defaultHours = { start: "08:00", end: "17:00" };

export function normalizeAvailability(input, legacyHours) {
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
