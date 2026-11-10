import z from "zod";

export const registerSpecializationsSchema = z.object({
  names: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Specialization cannot be empty.")
        .max(80, "Specialization must be 80 characters or fewer."),
    )
    .max(50, "Too many specializations."),
});

export type RegisterSpecializationsInput = z.infer<
  typeof registerSpecializationsSchema
>;
