import z from "zod";

const notes = z
  .string()
  .trim()
  .max(4000, "Keep the notes under 4000 characters.");

const sessionFields = {
  sessionDate: z.string().min(1, "Choose the session date."),
  durationMinutes: z.coerce
    .number()
    .int("Enter the duration in whole minutes.")
    .min(1, "Enter at least 1 minute.")
    .max(240, "Enter 240 minutes or less."),
  patientVisibleNotes: notes,
  clinicalNotes: notes,
};

// Defaults belong to create only: on a PATCH an absent field must stay untouched.
export const sessionInputSchema = z.object({
  ...sessionFields,
  patientVisibleNotes: notes.optional().default(""),
  clinicalNotes: notes.optional().default(""),
});

export const sessionUpdateSchema = z.object(sessionFields).partial();
