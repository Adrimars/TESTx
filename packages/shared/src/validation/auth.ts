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
  age: z.number().int().min(13).max(100),
  gender: z.enum(GENDERS),
  country: z.string().min(2),
  city: z.string().trim().min(1).optional(),
  nativeLanguage: z.string().min(1).optional(),
  foreignLanguages: z.array(z.string().min(1)).optional().default([]),
  occupation: z.string().trim().optional(),
  educationLevel: z.string().min(1).optional(),
  aiUseCases: z.array(z.string().min(1)).optional().default([]),
  aiExperience: z.string().min(1).optional(),
  aiFrequency: z.string().min(1).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EvaluatorProfileInput = z.infer<typeof evaluatorProfileSchema>;
