import { z } from "zod";
import {
  AI_EXPERIENCE_OPTIONS,
  AI_FREQUENCY_OPTIONS,
  AI_USE_CASES,
  EDUCATION_LEVELS,
  GENDERS,
  HOBBIES,
  HOBBIES_MAX,
} from "../constants";

/**
 * The bare values out of each predefined option list, for `z.enum` - these keep the
 * profile's closed-set fields closed rather than free text an evaluator (or a replayed
 * request) could put anything into.
 *
 * Every one of these fields is rendered by both profile forms as a picker over exactly
 * these constants, so a value outside the list can only come from a hand-rolled request.
 * They also feed demographic targeting and analytics, which is the practical reason the
 * server has to enforce what the picker already offers: one junk value is a row nothing
 * can group by.
 */
const optionValues = (options: readonly { value: string }[]) =>
  options.map((option) => option.value) as [string, ...string[]];

const HOBBY_VALUES = optionValues(HOBBIES);
const EDUCATION_LEVEL_VALUES = optionValues(EDUCATION_LEVELS);
const AI_USE_CASE_VALUES = optionValues(AI_USE_CASES);
const AI_EXPERIENCE_VALUES = optionValues(AI_EXPERIENCE_OPTIONS);
const AI_FREQUENCY_VALUES = optionValues(AI_FREQUENCY_OPTIONS);

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
  educationLevel: z.enum(EDUCATION_LEVEL_VALUES).optional(),
  aiUseCases: z.array(z.enum(AI_USE_CASE_VALUES)).optional().default([]),
  aiExperience: z.enum(AI_EXPERIENCE_VALUES).optional(),
  aiFrequency: z.enum(AI_FREQUENCY_VALUES).optional(),
  hobbies: z.array(z.enum(HOBBY_VALUES)).max(HOBBIES_MAX).optional().default([]),
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
  // A self-attested checkbox (16.8), not a number - the numeric age was never persisted
  // by /register/mobile (apps/api/src/routes/auth.ts), only used to gate under-18
  // signups. The real, persisted EvaluatorProfile.age is still collected once, on
  // profile-onboarding.tsx, unaffected by this change.
  ageConfirmed: z.literal(true, {
    errorMap: () => ({ message: `You must confirm you are ${MOBILE_MIN_AGE} or older to create an account` }),
  }),
  aydinlatmaAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "The disclosure must be acknowledged before registering" }),
  }),
  acikRizaAccepted: z.boolean().optional(),
  /**
   * Stable per-install device identifier. Optional so a client that cannot
   * produce one still registers - the guard is a detection signal, never a
   * gate. See plan.md 9.5.
   */
  deviceId: z.string().min(1).max(200).optional(),
});

export type MobileRegisterInput = z.infer<typeof mobileRegisterSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EvaluatorProfileInput = z.infer<typeof evaluatorProfileSchema>;
