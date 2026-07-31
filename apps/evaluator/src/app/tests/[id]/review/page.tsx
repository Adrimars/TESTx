"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@testx/ui";
import { useTestSession } from "@/components/test-session-provider";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

type SubmitResult = {
  pointsEarned: number;
  isFlagged: boolean;
  flagReasons: string[];
};

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, resetSession } = useTestSession();
  const { refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const test = state.test;

  useEffect(() => {
    function handleUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  useEffect(() => {
    if (!test) {
      router.replace(`/tests/${params.id}`);
    }
  }, [test, params.id, router]);

  if (!test) return null;

  const answers = Array.from(state.answers.entries()).map(([questionId, data]) => ({
    questionId,
    selectedOptionIds: data.selectedOptionIds,
    ratingValue: data.ratingValue ?? undefined,
    textValue: data.textValue || undefined,
    timeSpentSeconds: data.timeSpentSeconds,
  }));

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
      setResult(res);
      await refreshUser();
      resetSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {result.isFlagged ? "Response recorded" : "Test complete!"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.isFlagged ? (
              <p className="text-muted-foreground">
                Your response was flagged for quality issues. No points were awarded.
              </p>
            ) : (
              <p className="text-4xl font-bold text-primary">+{result.pointsEarned} pts</p>
            )}
            <Button className="min-h-[44px]" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review your answers</h1>
        <p className="text-muted-foreground text-sm">
          Check your answers before submitting. Use "Change" to go back.
        </p>
      </div>

      <div className="space-y-3">
        {test.questions.map((question, index) => {
          const answer = state.answers.get(question.id);
          let answerText = "No answer";

          if (answer) {
            if (question.type === "RATING" && answer.ratingValue !== null) {
              answerText = `Rating: ${answer.ratingValue}`;
            } else if (question.type === "FREE_TEXT" && answer.textValue) {
              answerText = answer.textValue.slice(0, 100);
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
  );
}
