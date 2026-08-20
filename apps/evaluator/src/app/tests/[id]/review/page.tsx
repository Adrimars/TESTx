"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, Button, Dialog } from "@testx/ui";
import { useTestSession } from "@/components/test-session-provider";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

type SubmitResult = {
  pointsEarned: number;
  isFlagged: boolean;
  flagReasons: string[];
};

/** Seconds as prose for the flag messages, e.g. "45 seconds" / "2.5 minutes". */
function formatRequiredTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  const minutes = Math.round((totalSeconds / 60) * 10) / 10;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

const FLAG_REASON_LABELS: Record<string, string> = {
  SPEED_TOO_FAST: "You finished the test too quickly — the whole test took less than the minimum time it requires.",
  TIMING_UNVERIFIED: "The session was left open for too long before answers were submitted. Response times could not be verified.",
  ATTENTION_CHECK_FAILED: "An attention check question was answered incorrectly.",
  CONSISTENCY_FAILED: "Your answers were inconsistent — a repeated question received a different answer than the original.",
};

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, resetSession } = useTestSession();
  const { refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Captured before the session is cleared, so the flag message can name the minimum. */
  const [requiredSeconds, setRequiredSeconds] = useState<number | null>(null);
  const resultDialogRef = useRef<HTMLDialogElement>(null);

  const test = state.test;

  useEffect(() => {
    function handleUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  useEffect(() => {
    if (!test && !result) {
      router.replace(`/tests/${params.id}`);
    }
  }, [test, result, params.id, router]);

  useEffect(() => {
    if (result) {
      resultDialogRef.current?.showModal();
    }
  }, [result]);

  if (!test && !result) return null;

  const answers = (test?.questions ?? []).map((question) => {
    const data = state.answers.get(question.id);
    return {
      questionId: question.id,
      selectedOptionIds: data?.selectedOptionIds ?? [],
      ratingValue: data?.ratingValue ?? undefined,
      timeSpentSeconds: data?.timeSpentSeconds ?? 0,
    };
  });

  async function handleSubmit() {
    if (!test || !state.sessionToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<SubmitResult>(`/evaluator/tests/${test.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: state.sessionToken,
          answers,
        }),
      });
      await refreshUser();
      setRequiredSeconds(test.minTimePerQuestion * test.questions.length);
      resetSession();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {test && (
        <div className="mx-auto max-w-2xl space-y-6 pb-24 sm:pb-0">
          <div className="space-y-1">
            <h1 className="text-page-title text-foreground">Review your answers</h1>
            <p className="text-sm text-muted-foreground">
              Check your answers before submitting. Use “Change” to go back to a question.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {test.questions.filter((q) => !q.isReviewHidden).map((question, index) => {
              const answer = state.answers.get(question.id);
              let answerText = "No answer";

              if (answer) {
                if (question.type === "RATING" && answer.ratingValue !== null) {
                  answerText = `Rating: ${answer.ratingValue}`;
                } else if (answer.selectedOptionIds.length > 0) {
                  const labels = answer.selectedOptionIds
                    .map((id) => question.options.find((o) => o.id === id)?.label ?? id)
                    .join(", ");
                  answerText = labels;
                }
              }

              return (
                <div
                  key={question.id}
                  className="flex items-start justify-between gap-4 border-b border-border p-4 last:border-b-0"
                >
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{question.prompt}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{answerText}</p>
                  </div>
                  <Button
                    variant="link"
                    className="shrink-0 self-center"
                    onClick={() => {
                      // The visible list is filtered, but question numbers in the URL
                      // are positions in the full (unfiltered) question order.
                      const realIndex = test.questions.findIndex((q) => q.id === question.id);
                      router.push(`/tests/${params.id}/question/${realIndex + 1}`);
                    }}
                  >
                    Change
                  </Button>
                </div>
              );
            })}
          </div>

          {error && <Alert>{error}</Alert>}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <Button size="lg" className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Test"}
            </Button>
          </div>
        </div>
      )}

      <Dialog ref={resultDialogRef} className="max-w-sm">
        {result && (
          result.isFlagged ? (
            <div className="space-y-5 p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <CircleAlert className="size-7" aria-hidden />
                </div>
                <h2 className="text-xl font-bold text-foreground">No points earned</h2>
                <p className="text-sm text-muted-foreground">
                  Your response was flagged for quality issues. No points were awarded for this test.
                </p>
              </div>

              <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-left">
                <p className="text-meta uppercase text-destructive">
                  Reason{result.flagReasons.length > 1 ? "s" : ""}
                </p>
                <ul className="space-y-1.5">
                  {result.flagReasons.map((reason) => (
                    <li key={reason} className="flex gap-2 text-sm text-foreground">
                      <span className="mt-0.5 shrink-0 text-destructive">•</span>
                      <span>
                        {FLAG_REASON_LABELS[reason] ?? reason}
                        {reason === "SPEED_TOO_FAST" && requiredSeconds !== null && requiredSeconds > 0 && (
                          <> This test needs at least {formatRequiredTime(requiredSeconds)} in total.</>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button className="w-full" variant="secondary" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-5 p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <CircleCheck className="size-7" aria-hidden />
                </div>
                <h2 className="text-xl font-bold text-foreground">Test complete!</h2>
                <p className="text-sm text-muted-foreground">
                  Great job! You successfully completed the test.
                </p>
              </div>

              <div className="rounded-lg bg-surface p-5">
                <p className="text-meta uppercase text-muted-foreground">Points earned</p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-primary">+{result.pointsEarned}</p>
              </div>

              <Button className="w-full" onClick={() => router.push("/dashboard")}>
                Total Points
              </Button>
            </div>
          )
        )}
      </Dialog>
    </>
  );
}
