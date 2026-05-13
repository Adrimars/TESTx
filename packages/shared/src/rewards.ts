import { QUESTION_REWARD_WEIGHTS } from "./constants";
import type { QuestionType } from "./constants";

export type RewardQuestion = {
  type: QuestionType;
  isAttentionCheck?: boolean;
  isTrapDuplicate?: boolean;
};

export function calculateTestReward(questions: RewardQuestion[]): number {
  let points = questions
    .filter((question) => !question.isAttentionCheck && !question.isTrapDuplicate)
    .reduce((sum, question) => sum + QUESTION_REWARD_WEIGHTS[question.type], 0);

  const estimatedMinutes = questions.length * 0.5;
  if (estimatedMinutes > 5) {
    points += 5;
  }

  return points;
}
