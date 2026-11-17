import z from "zod";

export const therapyServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required."),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
  duration: z.coerce
    .number()
    .int("Enter whole minutes.")
    .min(30, "Duration must be at least 30 minutes."),
  fee: z.coerce.number().min(0, "Fee must be zero or greater."),
});
