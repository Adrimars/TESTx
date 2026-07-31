import type { AnswerPayload } from "@testx/shared";

type QuestionRow = {
  id: string;
  type: string;
  isAttentionCheck: boolean;
  isTrapDuplicate: boolean;
  trapSourceId: string | null;
  config: unknown;
  options: { id: string; order: number; label: string | null }[];
};

type QualityResult = {
  isFlagged: boolean;
  flagReasons: string[];
  /** Misconfigurations that silently disabled a check. Logged by the caller. */
  warnings: string[];
};

function getConfig(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export const qualityService = {
  runChecks(
    answers: AnswerPayload[],
    questions: QuestionRow[],
    minTimePerQuestion: number
  ): QualityResult {
    const flagReasons: string[] = [];
    const warnings: string[] = [];

    // Speed check: any answer below minTimePerQuestion threshold
    if (minTimePerQuestion > 0) {
      const tooFast = answers.some((a) => a.timeSpentSeconds < minTimePerQuestion);
      if (tooFast) flagReasons.push("SPEED_TOO_FAST");
    }

    const answerMap = new Map(answers.map((a) => [a.questionId, a]));

    for (const question of questions) {
      const answer = answerMap.get(question.id);
      if (!answer) continue;

      // Attention check: verify correct option was selected
      if (question.isAttentionCheck) {
        const config = getConfig(question.config);
        const correctLabel = config.correctOptionLabel as string | undefined;
        const correctOrder = config.correctOptionOrder as number | undefined;

        // Find the correct option
        const correctOption = question.options.find((opt) => {
          if (correctLabel && opt.label === correctLabel) return true;
          if (correctOrder !== undefined && opt.order === correctOrder) return true;
          return false;
        });

        if (correctOption) {
          const selected = answer.selectedOptionIds ?? [];
          if (!selected.includes(correctOption.id)) {
            if (!flagReasons.includes("ATTENTION_CHECK_FAILED")) {
              flagReasons.push("ATTENTION_CHECK_FAILED");
            }
          }
        } else {
          warnings.push(
            `Attention check ${question.id} has no option matching its configured correct answer ` +
              `(correctOptionLabel=${JSON.stringify(correctLabel)}, correctOptionOrder=${correctOrder}); ` +
              `check skipped`
          );
        }
      }

      // Consistency check: trap duplicate must match original question's answer
      if (question.isTrapDuplicate && question.trapSourceId) {
        const sourceAnswer = answerMap.get(question.trapSourceId);
        if (sourceAnswer) {
          const trapSelected = [...(answer.selectedOptionIds ?? [])].sort().join(",");

          // Map trap question option orders to source question option orders for comparison
          // Both questions share the same option structure (duplicated), so compare by matching order
          const trapOptionOrderMap = new Map(question.options.map((o) => [o.id, o.order]));

          // Find the source question to map option order → option id
          // We'll use the option orders to compare since labels/media are the same
          const trapSelectedOrders = (answer.selectedOptionIds ?? [])
            .map((id) => trapOptionOrderMap.get(id))
            .filter((order) => order !== undefined)
            .sort()
            .join(",");

          // We need source question's options to map id → order
          // The source question is not in this list directly, so we compare via the answer's selectedOptionIds
          // by translating both to option orders
          // For the source answer, we need source question options — but we only have the trap question here.
          // Strategy: compare raw selectedOptionIds but normalize using option order mapping.
          // Since the trap is a duplicate, options share the same order sequence.
          // Get source question options from the questions array
          const sourceQuestion = questions.find((q) => q.id === question.trapSourceId);
          if (sourceQuestion) {
            const sourceOptionOrderMap = new Map(sourceQuestion.options.map((o) => [o.id, o.order]));
            const sourceSelectedOrders = (sourceAnswer.selectedOptionIds ?? [])
              .map((id) => sourceOptionOrderMap.get(id))
              .filter((order) => order !== undefined)
              .sort()
              .join(",");

            if (trapSelectedOrders !== sourceSelectedOrders) {
              if (!flagReasons.includes("CONSISTENCY_FAILED")) {
                flagReasons.push("CONSISTENCY_FAILED");
              }
            }
          } else {
            // Fallback: direct ID comparison (same question options not duplicated)
            if (trapSelected !== [...(sourceAnswer.selectedOptionIds ?? [])].sort().join(",")) {
              if (!flagReasons.includes("CONSISTENCY_FAILED")) {
                flagReasons.push("CONSISTENCY_FAILED");
              }
            }
          }
        }
      }
    }

    return { isFlagged: flagReasons.length > 0, flagReasons, warnings };
  },
};
