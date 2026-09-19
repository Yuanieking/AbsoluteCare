import z from "zod";
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from "../utils/validators.js";

const email = z.string().trim().transform(normalizeEmail).refine(isValidEmail, {
  message: "Enter a valid email address, e.g. name@gmail.com",
});
const phone = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((value) => !value || isValidPhone(value), {
    message: "Enter a valid mobile number (e.g. 09171234567)",
  });

export const signupSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email,
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    phone: phone.optional().default(""),
    recaptchaToken: z.string().nullable().optional(),
    acceptedTerms: z.literal(true, {
      error: "You must agree to continue.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
  recaptchaToken: z.string().nullable().optional(),
});

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  phone: phone.optional().default(""),
  dateOfBirth: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(240).optional().default(""),
  profilePicture: z.string().trim().max(2_000_000).optional().default(""),
});

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
