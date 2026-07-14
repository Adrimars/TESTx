import { z } from "zod";

export const answerPayloadSchema = z
  .object({
    questionId: z.string().uuid(),
    selectedOptionIds: z.array(z.string().uuid()).max(50).optional(),
    ratingValue: z.number().int().optional(),
    textValue: z.string().max(10000).optional(),
    timeSpentSeconds: z.number().int().min(0).max(86_400),
  })
  .strict();

export const testSubmissionSchema = z
  .object({
    startedAt: z.string().datetime(),
    answers: z.array(answerPayloadSchema).min(1).max(300),
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
