import { z } from "zod";

export const answerPayloadSchema = z
  .object({
    questionId: z.string().uuid(),
    selectedOptionIds: z.array(z.string().uuid()).optional(),
    ratingValue: z.number().int().optional(),
    textValue: z.string().optional(),
    timeSpentSeconds: z.number().int().min(0),
  })
  .strict();

export const testSubmissionSchema = z
  .object({
    startedAt: z.string().datetime(),
    answers: z.array(answerPayloadSchema).min(1),
  })
  .strict();

export type AnswerPayloadInput = z.infer<typeof answerPayloadSchema>;
export type TestSubmissionInput = z.infer<typeof testSubmissionSchema>;

export const FLAG_REASONS = [
  "SPEED_TOO_FAST",
  "ATTENTION_CHECK_FAILED",
  "CONSISTENCY_FAILED",
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];
