import { z } from "zod";
import { MEDIA_TYPES, QUESTION_TYPES } from "../constants";

export const questionOptionSchema = z.object({
  label: z.string().optional(),
  mediaId: z.string().uuid().optional(),
  order: z.number().int().nonnegative(),
});

export const questionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().min(1),
  mediaType: z.enum(MEDIA_TYPES).nullable().optional(),
  config: z.record(z.unknown()).default({}),
  options: z.array(questionOptionSchema).default([]),
  isAttentionCheck: z.boolean().default(false),
  isTrapDuplicate: z.boolean().default(false),
  trapSourceId: z.string().uuid().nullable().optional(),
});

export type QuestionInput = z.infer<typeof questionSchema>;
