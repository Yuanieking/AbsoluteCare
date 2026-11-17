import { z } from "zod";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  });
export const auditQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(120).optional(),
    actor: z.string().trim().max(100).optional(),
    role: z
      .enum(["admin", "secretary", "therapist", "user", "system"])
      .optional(),
    category: z
      .enum([
        "account",
        "patient",
        "appointment",
        "session",
        "payment",
        "service",
        "document",
        "settings",
        "integration",
        "notification",
        "backup",
      ])
      .optional(),
    result: z.enum(["success", "failure"]).optional(),
    from: day.optional(),
    to: day.optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "From must not be after To.",
  });
export const auditIdSchema = z.string().min(1).max(200);
