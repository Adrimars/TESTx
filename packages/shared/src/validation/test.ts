import { z } from "zod";
import { GENDERS, TEST_STATUSES } from "../constants";

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
  minTimePerQuestion: z.number().int().min(0).optional(),
  demographicFilters: demographicFiltersSchema.nullable().optional(),
});

export const updateTestStatusSchema = z.object({
  status: z.enum(TEST_STATUSES),
});

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type UpdateTestStatusInput = z.infer<typeof updateTestStatusSchema>;
export type ReorderQuestionsInput = z.infer<typeof reorderQuestionsSchema>;
