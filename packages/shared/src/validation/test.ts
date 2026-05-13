import { z } from "zod";
import { DEFAULT_MIN_TIME_PER_QUESTION_SECONDS, GENDERS } from "../constants";

export const demographicFiltersSchema = z.object({
  ageMin: z.number().int().min(0).optional(),
  ageMax: z.number().int().min(0).optional(),
  genders: z.array(z.enum(GENDERS)).optional(),
  countries: z.array(z.string().min(2)).optional(),
  cities: z.array(z.string().min(1)).optional(),
});

export const createTestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const updateTestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  responseCap: z.number().int().positive().nullable().optional(),
  advisoryTimeMin: z.number().int().positive().nullable().optional(),
  minTimePerQuestion: z.number().int().min(0).default(DEFAULT_MIN_TIME_PER_QUESTION_SECONDS),
  demographicFilters: demographicFiltersSchema.nullable().optional(),
});

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
