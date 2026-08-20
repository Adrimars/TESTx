"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog } from "@testx/ui";
import { useTestSession } from "@/components/test-session-provider";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

type SubmitResult = {
  pointsEarned: number;
  isFlagged: boolean;
  flagReasons: string[];
};

const FLAG_REASON_LABELS: Record<string, string> = {
  SPEED_TOO_FAST: "The test was completed too quickly. Each question must be given adequate time.",
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
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Review your answers</h1>
            <p className="text-muted-foreground text-sm">
              Check your answers before submitting. Use "Change" to go back.
            </p>
          </div>

          <div className="space-y-3">
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
                  className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Q{index + 1}</p>
                    <p className="text-sm font-medium line-clamp-2">{question.prompt}</p>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{answerText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/tests/${params.id}/question/${index + 1}`)}
                    className="shrink-0 text-sm text-primary underline underline-offset-2 min-h-[44px] flex items-center"
                  >
                    Change
                  </button>
                </div>
              );
            })}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full min-h-[44px]"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit Test"}
          </Button>
        </div>
      )}

      <Dialog ref={resultDialogRef}>
        {result && (
          result.isFlagged ? (
            <div className="space-y-5 p-6 text-center max-w-sm mx-auto">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">No points earned</h2>
                <p className="text-sm text-muted-foreground">
                  Your response was flagged for quality issues. No points were awarded for this test.
                </p>
              </div>

              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Reason{result.flagReasons.length > 1 ? "s" : ""}</p>
                <ul className="space-y-1">
                  {result.flagReasons.map((reason) => (
                    <li key={reason} className="text-sm text-foreground flex gap-2">
                      <span className="mt-0.5 shrink-0 text-destructive">•</span>
                      <span>{FLAG_REASON_LABELS[reason] ?? reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="w-full min-h-[44px]"
                variant="secondary"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-5 p-6 text-center max-w-sm mx-auto">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">Test complete!</h2>
                <p className="text-sm text-muted-foreground">
                  Great job! You successfully completed the test.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground mb-1">Points earned</p>
                <p className="text-5xl font-bold text-primary">+{result.pointsEarned}</p>
              </div>

              <Button
                className="w-full min-h-[44px]"
                onClick={() => router.push("/dashboard")}
              >
                Total Points
              </Button>
            </div>
          )
        )}
      </Dialog>
    </>
  );
}
