import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Enter a valid record id.");

const date = z.coerce.date();

const MAX_RANGE_DAYS = 366;

const ranged = {
  from: date,
  to: date,
};

/**
 * The client sends ids and a range, never document content. Bodies are always
 * assembled server-side from existing collections.
 */
export const documentCreateSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("clinic_report"), ...ranged }).strict(),
    z
      .object({
        type: z.literal("patient_summary"),
        patientId: objectId,
        dependentId: objectId.optional(),
        ...ranged,
      })
      .strict(),
    z.object({ type: z.literal("visit_record"), appointmentId: objectId }).strict(),
    z.object({ type: z.literal("receipt"), appointmentId: objectId }).strict(),
  ])
  .superRefine((value, context) => {
    if (!("from" in value)) return;
    if (value.from > value.to) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "The start date must be on or before the end date.",
      });
      return;
    }
    const days = (value.to.getTime() - value.from.getTime()) / 86_400_000;
    if (days > MAX_RANGE_DAYS) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Choose a range of one year or less.",
      });
    }
  });

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;

export const documentListQuerySchema = z
  .object({
    type: z
      .enum(["clinic_report", "patient_summary", "visit_record", "receipt"])
      .optional(),
    patientId: objectId.optional(),
    appointmentId: objectId.optional(),
    driveStatus: z.enum(["pending", "uploaded", "failed"]).optional(),
    status: z.enum(["issued", "superseded", "revoked"]).optional(),
    search: z.string().trim().max(120).optional(),
    from: date.optional(),
    to: date.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });

export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

export const documentRevokeSchema = z
  .object({
    reason: z.string().trim().min(4).max(500),
  })
  .strict();

export const trackingNumberParamSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}-\d{4}-\d{6,}$/);
