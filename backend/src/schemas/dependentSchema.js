import z from "zod";

const sex = z.string().trim().max(30);
const medicalNotes = z.string().trim().max(1000);

const dependentFields = {
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  dateOfBirth: z.coerce.date().refine((date) => date <= new Date(), {
    message: "Date of birth cannot be in the future.",
  }),
  sex,
  relationship: z.string().trim().min(1, "Relationship is required.").max(40),
  medicalNotes,
};

// Defaults belong to create only: on a PATCH an absent field must stay untouched.
export const dependentSchema = z.object({
  ...dependentFields,
  sex: sex.optional().default(""),
  medicalNotes: medicalNotes.optional().default(""),
});
export const dependentUpdateSchema = z.object(dependentFields).partial();
