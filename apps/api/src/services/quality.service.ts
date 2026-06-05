import type { Prisma } from "@testx/database";
import type { AnswerPayloadInput, FlagReason } from "@testx/shared";

type QuestionWithOptions = Prisma.QuestionGetPayload<{
  include: { options: true };
}>;

export type QualityCheckInput = {
  questions: QuestionWithOptions[];
  answers: AnswerPayloadInput[];
  minTimePerQuestion: number;
  elapsedSeconds: number;
  requiredQuestionCount: number;
};

export type QualityCheckResult = {
  flagReasons: FlagReason[];
  isFlagged: boolean;
};

function getAnswer(
  answers: AnswerPayloadInput[],
  questionId: string
): AnswerPayloadInput | undefined {
  return answers.find((answer) => answer.questionId === questionId);
}

function correctOptionFromConfig(question: QuestionWithOptions): string | null {
  const config = (question.config ?? {}) as Record<string, unknown>;
  const correctOrder = config.correctOptionOrder;
  const correctLabel = config.correctOptionLabel;

  if (typeof correctOrder === "number") {
    const match = question.options.find((option) => option.order === correctOrder);
    if (match) return match.id;
  }
  if (typeof correctLabel === "string") {
    const match = question.options.find(
      (option) => option.label?.trim().toLowerCase() === correctLabel.trim().toLowerCase()
    );
    if (match) return match.id;
  }
  return null;
}

function answersEqual(
  question: QuestionWithOptions,
  source: AnswerPayloadInput,
  duplicate: AnswerPayloadInput
): boolean {
  if (question.type === "RATING") {
    return source.ratingValue === duplicate.ratingValue;
  }
  if (question.type === "FREE_TEXT") {
    return (source.textValue ?? "").trim() === (duplicate.textValue ?? "").trim();
  }
  const labelsFor = (answer: AnswerPayloadInput): Set<string> =>
    new Set(
      (answer.selectedOptionIds ?? [])
        .map((optionId) => question.options.find((option) => option.id === optionId)?.label ?? null)
        .filter((label): label is string => label !== null)
    );

  const sourceLabels = labelsFor(source);
  const duplicateLabels = labelsFor(duplicate);

  if (sourceLabels.size !== duplicateLabels.size) return false;
  for (const label of duplicateLabels) {
    if (!sourceLabels.has(label)) return false;
  }
  return true;
}

export function runQualityChecks({
  questions,
  answers,
  minTimePerQuestion,
  elapsedSeconds,
  requiredQuestionCount,
}: QualityCheckInput): QualityCheckResult {
  const reasons = new Set<FlagReason>();

  if (minTimePerQuestion > 0) {
    // Server-authoritative gate: real wall-clock time cannot be faked by the client.
    if (
      requiredQuestionCount > 0 &&
      elapsedSeconds < minTimePerQuestion * requiredQuestionCount
    ) {
      reasons.add("SPEED_TOO_FAST");
    }

    // Per-question client timings add granularity for honest submissions.
    for (const question of questions) {
      if (question.isAttentionCheck || question.isTrapDuplicate) continue;
      const answer = getAnswer(answers, question.id);
      if (answer && answer.timeSpentSeconds < minTimePerQuestion) {
        reasons.add("SPEED_TOO_FAST");
        break;
      }
    }
  }

  for (const question of questions) {
    if (!question.isAttentionCheck) continue;
    const expected = correctOptionFromConfig(question);
    // No configured correct answer => misconfigured check; skip rather than
    // penalize every evaluator with an unavoidable failure.
    if (!expected) continue;
    const answer = getAnswer(answers, question.id);
    const selected = answer?.selectedOptionIds ?? [];
    if (selected.length !== 1 || selected[0] !== expected) {
      reasons.add("ATTENTION_CHECK_FAILED");
    }
  }

  for (const question of questions) {
    if (!question.isTrapDuplicate || !question.trapSourceId) continue;
    const sourceQuestion = questions.find((q) => q.id === question.trapSourceId);
    if (!sourceQuestion) continue;
    const sourceAnswer = getAnswer(answers, sourceQuestion.id);
    const duplicateAnswer = getAnswer(answers, question.id);
    if (!sourceAnswer || !duplicateAnswer) {
      reasons.add("CONSISTENCY_FAILED");
      continue;
    }
    if (!answersEqual(question, sourceAnswer, duplicateAnswer)) {
      reasons.add("CONSISTENCY_FAILED");
    }
  }

  return {
    flagReasons: Array.from(reasons),
    isFlagged: reasons.size > 0,
  };
}
