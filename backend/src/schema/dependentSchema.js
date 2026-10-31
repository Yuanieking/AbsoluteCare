import z from "zod";

const dependentFields = {
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  dateOfBirth: z.coerce.date().refine((date) => date <= new Date(), {
    message: "Date of birth cannot be in the future.",
  }),
  sex: z.string().trim().max(30).optional().default(""),
  relationship: z.string().trim().min(1, "Relationship is required.").max(40),
  medicalNotes: z.string().trim().max(1000).optional().default(""),
};

export const dependentSchema = z.object(dependentFields);
export const dependentUpdateSchema = z.object(dependentFields).partial();
