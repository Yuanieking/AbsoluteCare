import z from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const appointmentRequestSchema = z.object({
  service: z.string().min(1, "A therapy service is required."),
  requestedDate: z.string().regex(datePattern, "Choose a valid date."),
  requestedTime: z.string().regex(timePattern, "Choose a valid time."),
  dependent: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional().default(""),
});

export const rescheduleRequestSchema = z.object({
  proposedDate: z.string().regex(datePattern, "Choose a valid date."),
  proposedTime: z.string().regex(timePattern, "Choose a valid time."),
  reason: z.string().trim().max(500).optional().default(""),
});
