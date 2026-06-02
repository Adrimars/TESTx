"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@testx/ui";
import {
  isAnswered,
  useTestSession,
  type AnswerState,
  type TestQuestion,
} from "@/components/test-session-provider";
import { apiFetch, resolveMediaUrl } from "@/lib/api";

type SubmissionResponse = {
  id: string;
  isFlagged: boolean;
  pointsEarned: number;
};

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const testId = params?.id;
  const { session, answers, startedAt, getTotalTimeFor, endSession } = useTestSession();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResponse | null>(null);

  useEffect(() => {
    if (!session && testId && !result) {
      router.replace(`/tests/${testId}`);
    }
  }, [session, testId, router, result]);

  const visibleQuestions = useMemo(() => session?.questions ?? [], [session]);

  const handleSubmit = useCallback(async () => {
    if (!session || !testId || !startedAt) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        startedAt: startedAt.toISOString(),
        answers: session.questions.map((question) => {
          const answer = answers.get(question.id);
          return {
            questionId: question.id,
            selectedOptionIds: answer?.selectedOptionIds ?? [],
            ratingValue: answer?.ratingValue ?? undefined,
            textValue: answer?.textValue ?? undefined,
            timeSpentSeconds: getTotalTimeFor(question.id),
          };
        }),
      };
      const response = await apiFetch<SubmissionResponse>(
        `/evaluator/tests/${testId}/submit`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      setResult(response);
      endSession();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  }, [session, testId, startedAt, answers, getTotalTimeFor, endSession]);

  if (result) {
    return <CompletionView result={result} onDone={() => router.push("/dashboard")} />;
  }

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review your answers</CardTitle>
          <CardDescription>You can go back and change any answer before submitting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleQuestions.map((question, index) => {
            const answer = answers.get(question.id);
            return (
              <ReviewItem
                key={question.id}
                index={index + 1}
                question={question}
                answer={answer}
                onChange={() =>
                  router.push(
                    `/tests/${testId}/question/${session.questions.indexOf(question) + 1}`
                  )
                }
              />
            );
          })}

          {errorMessage && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button variant="ghost" onClick={() => router.push(`/tests/${testId}/question/1`)}>
              Back to questions
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewItem({
  index,
  question,
  answer,
  onChange,
}: {
  index: number;
  question: TestQuestion;
  answer: AnswerState | undefined;
  onChange: () => void;
}) {
  const answered = isAnswered(question, answer);
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Question {index}
          </p>
          <p className="font-medium">{question.prompt}</p>
        </div>
        <Button variant="ghost" onClick={onChange}>
          Change
        </Button>
      </div>
      <AnswerPreview question={question} answer={answer} />
      {!answered && (
        <p className="text-xs text-destructive">No answer selected yet.</p>
      )}
    </div>
  );
}

function AnswerPreview({
  question,
  answer,
}: {
  question: TestQuestion;
  answer: AnswerState | undefined;
}) {
  if (!answer) return <p className="text-sm text-muted-foreground">—</p>;

  if (question.type === "RATING") {
    return (
      <p className="text-sm font-medium">
        Rating: {answer.ratingValue ?? "—"}
      </p>
    );
  }
  if (question.type === "FREE_TEXT") {
    return (
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
        {answer.textValue || "—"}
      </p>
    );
  }

  const selected = question.options.filter((option) =>
    answer.selectedOptionIds.includes(option.id)
  );
  if (selected.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {selected.map((option) => {
        const url = resolveMediaUrl(option.media?.url ?? option.mediaUrl);
        return (
          <div
            key={option.id}
            className="flex min-w-32 max-w-48 flex-col overflow-hidden rounded border border-border bg-muted/30"
          >
            {url && option.media?.fileType === "IMAGE" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="aspect-video w-full object-cover" />
            )}
            {option.label && (
              <p className="px-2 py-1 text-xs font-medium">{option.label}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompletionView({
  result,
  onDone,
}: {
  result: SubmissionResponse;
  onDone: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {result.isFlagged ? "Submission received" : "Great work!"}
        </CardTitle>
        <CardDescription>
          {result.isFlagged
            ? "Your response has been recorded."
            : "Your evaluation has been recorded successfully."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Points earned
          </p>
          <p className="mt-2 text-5xl font-bold tracking-tight">
            {result.pointsEarned}
          </p>
        </div>
        <Button onClick={onDone} className="w-full sm:w-auto">
          Back to dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
