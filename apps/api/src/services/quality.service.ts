import type { AnswerPayload } from "@testx/shared";

type QuestionOptionRow = {
  id: string;
  order: number;
  label: string | null;
  mediaId: string | null;
};

type QuestionRow = {
  id: string;
  type: string;
  isAttentionCheck: boolean;
  isTrapDuplicate: boolean;
  trapSourceId: string | null;
  config: unknown;
  options: QuestionOptionRow[];
};

type QualityInput = {
  answers: AnswerPayload[];
  questions: QuestionRow[];
  minTimePerQuestion: number;
  /** Server-measured wall-clock duration of the session, from the signed session token. */
  sessionSeconds: number;
};

type QualityResult = {
  isFlagged: boolean;
  flagReasons: string[];
  /** Misconfigurations that silently disabled a check. Logged by the caller. */
  warnings: string[];
};

/** Only option-based answers can be compared for consistency; see the trap check below. */
const COMPARABLE_TRAP_TYPES = new Set(["SINGLE_SELECT", "MULTI_SELECT", "RANKING"]);

/** Types whose answer is a ranking, where the order of `selectedOptions` is the answer. */
const ORDERED_TYPES = new Set(["RANKING"]);

/**
 * A session may legitimately run longer than the work it contains — an evaluator gets
 * interrupted and comes back. Beyond this much unaccounted idle time we stop believing the
 * self-reported per-question timings, because at that point the reported work is a small
 * slice of a window the server cannot vouch for.
 */
const IDLE_GRACE_SECONDS = 15 * 60;

function getConfig(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Identifies an option by what it *is*, not where it sits. A trap duplicate is a separate
 * question with its own option rows, so IDs never match between the two; positions do not
 * match either once the options are reordered, which is the entire point of asking twice.
 * Label is the identity an evaluator actually sees; media-only options fall back to the
 * image they show.
 */
function optionKey(option: QuestionOptionRow): string {
  const label = option.label?.trim().toLowerCase();
  if (label) return `label:${label}`;
  if (option.mediaId) return `media:${option.mediaId}`;
  return `order:${option.order}`;
}

/**
 * The comparable form of an answer. Selections are a set, so the keys are sorted before
 * comparison; a ranking is a sequence, where the order the evaluator chose *is* the answer
 * and sorting it would call every ranking consistent.
 */
function answerKey(selectedIds: string[], options: QuestionOptionRow[], ordered: boolean): string {
  const byId = new Map(options.map((option) => [option.id, option]));
  const keys = selectedIds
    .map((id) => byId.get(id))
    .filter((option): option is QuestionOptionRow => option !== undefined)
    .map(optionKey);
  return (ordered ? keys : [...keys].sort()).join(",");
}

function sameOptionSet(a: QuestionOptionRow[], b: QuestionOptionRow[]): boolean {
  const keysA = new Set(a.map(optionKey));
  const keysB = new Set(b.map(optionKey));
  return keysA.size === keysB.size && [...keysA].every((key) => keysB.has(key));
}

export const qualityService = {
  runChecks({ answers, questions, minTimePerQuestion, sessionSeconds }: QualityInput): QualityResult {
    const flagReasons = new Set<string>();
    const warnings: string[] = [];

    // Speed check: judged on the session as a whole, not question by question. An evaluator may
    // answer one question fast and dwell on the next; what matters is that the whole test got at
    // least the time its author asked for. Measured against the server clock, not self-reported
    // times, so it cannot be inflated by the client.
    const requiredTotalSeconds = minTimePerQuestion * questions.length;
    if (requiredTotalSeconds > 0 && sessionSeconds < requiredTotalSeconds) {
      flagReasons.add("SPEED_TOO_FAST");
    }

    // Idle check: the caller has already capped reported times so their sum cannot exceed the
    // session, but that bound is one-sided — it does nothing about a session held open for
    // hours and then answered in seconds. Unaccounted idle time is the signal for that.
    const creditedSeconds = answers.reduce((sum, a) => sum + a.timeSpentSeconds, 0);
    const idleSeconds = sessionSeconds - creditedSeconds;
    const idleAllowance = Math.max(minTimePerQuestion * questions.length, IDLE_GRACE_SECONDS);
    if (idleSeconds > idleAllowance) {
      flagReasons.add("TIMING_UNVERIFIED");
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

        const correctOption = question.options.find((opt) => {
          if (correctLabel && opt.label === correctLabel) return true;
          if (correctOrder !== undefined && opt.order === correctOrder) return true;
          return false;
        });

        if (correctOption) {
          const selected = answer.selectedOptionIds ?? [];
          if (!selected.includes(correctOption.id)) {
            flagReasons.add("ATTENTION_CHECK_FAILED");
          }
        } else {
          warnings.push(
            `Attention check ${question.id} has no option matching its configured correct answer ` +
              `(correctOptionLabel=${JSON.stringify(correctLabel)}, correctOptionOrder=${correctOrder}); ` +
              `check skipped`
          );
        }
      }

      // Consistency check: the trap duplicate asks the same thing again, so the same choice
      // must come back — compared by option identity, since the trap's options are expected
      // to be in a different order.
      if (question.isTrapDuplicate && question.trapSourceId) {
        const sourceQuestion = questions.find((q) => q.id === question.trapSourceId);
        const sourceAnswer = answerMap.get(question.trapSourceId);

        if (!sourceQuestion || !sourceAnswer) {
          warnings.push(
            `Trap duplicate ${question.id} has no answered source question ${question.trapSourceId}; check skipped`
          );
        } else if (!COMPARABLE_TRAP_TYPES.has(question.type)) {
          warnings.push(
            `Trap duplicate ${question.id} is a ${question.type} question; only select and ranking ` +
              `questions can be compared for consistency, check skipped`
          );
        } else if (question.type !== sourceQuestion.type) {
          // Ranking three options and picking one of them are different answers; comparing
          // them would flag an evaluator for the author's mistake.
          warnings.push(
            `Trap duplicate ${question.id} is a ${question.type} question but its source ` +
              `${sourceQuestion.id} is a ${sourceQuestion.type} question; check skipped`
          );
        } else if (!sameOptionSet(question.options, sourceQuestion.options)) {
          // Not a real duplicate — comparing them would flag an evaluator for the author's mistake.
          warnings.push(
            `Trap duplicate ${question.id} does not offer the same options as its source ` +
              `${sourceQuestion.id}; check skipped`
          );
        } else {
          const ordered = ORDERED_TYPES.has(question.type);
          const trapSelection = answerKey(answer.selectedOptionIds ?? [], question.options, ordered);
          const sourceSelection = answerKey(
            sourceAnswer.selectedOptionIds ?? [],
            sourceQuestion.options,
            ordered
          );
          if (trapSelection !== sourceSelection) {
            flagReasons.add("CONSISTENCY_FAILED");
          }
        }
      }
    }

    return {
      isFlagged: flagReasons.size > 0,
      flagReasons: Array.from(flagReasons),
      warnings,
    };
  },
};
