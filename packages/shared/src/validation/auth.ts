import { z } from "zod";
import { GENDERS } from "../constants";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const evaluatorProfileSchema = z.object({
  dateOfBirth: z.string().date(),
  gender: z.enum(GENDERS),
  country: z.string().min(2),
  city: z.string().trim().min(1).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EvaluatorProfileInput = z.infer<typeof evaluatorProfileSchema>;
