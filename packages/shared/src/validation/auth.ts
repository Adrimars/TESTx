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

/**
 * Minimum self-declared age for a mobile account. The gate exists to sidestep
 * the unresolved TMK minor-consent question rather than to answer it, so it is
 * deliberately stricter than evaluatorProfileSchema's floor, which still serves
 * existing web accounts. See kvkk-compliance-research.md section 5.
 */
export const MOBILE_MIN_AGE = 18;

/**
 * Mobile registration. Adds the KVKK steps and the 18+ gate on top of the web
 * payload; web registration keeps using registerSchema untouched.
 *
 * aydinlatmaAcknowledged and acikRizaAccepted are separate on purpose and must
 * never be driven by a single control: Kurul Ilke Karari 2026/347 prohibits
 * merging the Article 10 disclosure with explicit consent. Only the first is
 * required - declining explicit consent must not block registration.
 */
export const mobileRegisterSchema = registerSchema.extend({
  age: z
    .number()
    .int()
    .min(MOBILE_MIN_AGE, `You must be at least ${MOBILE_MIN_AGE} to create an account`)
    .max(120),
  aydinlatmaAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "The disclosure must be acknowledged before registering" }),
  }),
  acikRizaAccepted: z.boolean().optional(),
});

export type MobileRegisterInput = z.infer<typeof mobileRegisterSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EvaluatorProfileInput = z.infer<typeof evaluatorProfileSchema>;
