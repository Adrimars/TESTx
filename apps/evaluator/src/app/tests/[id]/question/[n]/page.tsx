"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
} from "@testx/ui";
import {
  isAnswered,
  useTestSession,
  type AnswerState,
  type TestQuestion,
  type TestQuestionOption,
} from "@/components/test-session-provider";
import { resolveMediaUrl } from "@/lib/api";

export default function QuestionPage() {
  const router = useRouter();
  const params = useParams<{ id: string; n: string }>();
  const testId = params?.id;
  const questionNumber = Math.max(1, Number(params?.n ?? "1"));
  const {
    session,
    getAnswer,
    setAnswer,
    markQuestionVisited,
    consumeTime,
    startedAt,
  } = useTestSession();

  useEffect(() => {
    if (!session && testId) {
      router.replace(`/tests/${testId}`);
    }
  }, [session, testId, router]);

  const question = session?.questions[questionNumber - 1];
  const totalQuestions = session?.questions.length ?? 0;
  const answer = question ? getAnswer(question.id) : undefined;

  useEffect(() => {
    if (!question) return;
    markQuestionVisited(question.id);
    return () => {
      consumeTime(question.id);
    };
  }, [question, markQuestionVisited, consumeTime]);

  const remainingTime = useAdvisoryCountdown(session?.advisoryTimeMin ?? null, startedAt);

  const isLast = questionNumber === totalQuestions;
  const canAdvance = question ? isAnswered(question, answer) : false;
  const allAnswered = session
    ? session.questions.every((q) => isAnswered(q, getAnswer(q.id)))
    : false;

  const handleNext = useCallback(() => {
    if (!question || !testId) return;
    consumeTime(question.id);
    if (isLast) {
      router.push(`/tests/${testId}/review`);
    } else {
      router.push(`/tests/${testId}/question/${questionNumber + 1}`);
    }
  }, [consumeTime, isLast, question, questionNumber, router, testId]);

  const handleBackToReview = useCallback(() => {
    if (!question || !testId) return;
    consumeTime(question.id);
    router.push(`/tests/${testId}/review`);
  }, [consumeTime, question, router, testId]);

  const handlePrev = useCallback(() => {
    if (!question || !testId || questionNumber <= 1) return;
    consumeTime(question.id);
    router.push(`/tests/${testId}/question/${questionNumber - 1}`);
  }, [consumeTime, question, questionNumber, router, testId]);

  if (!session || !question || !answer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Preparing question...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {questionNumber} of {totalQuestions}
          </span>
          {remainingTime && <span>Time left (advisory): {remainingTime}</span>}
        </div>
        <Progress value={(questionNumber / totalQuestions) * 100} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl leading-tight">{question.prompt}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <QuestionBody
            question={question}
            answer={answer}
            onSelectOptions={(ids) => setAnswer(question.id, { selectedOptionIds: ids })}
            onRating={(value) => setAnswer(question.id, { ratingValue: value })}
            onText={(value) => setAnswer(question.id, { textValue: value })}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              disabled={questionNumber === 1}
              onClick={handlePrev}
            >
              Previous
            </Button>
            <div className="flex items-center gap-3">
              {allAnswered && !isLast && (
                <Button variant="secondary" onClick={handleBackToReview}>
                  Back to review
                </Button>
              )}
              <Button disabled={!canAdvance} onClick={handleNext}>
                {isLast ? "Review & Submit" : "Next"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type QuestionBodyProps = {
  question: TestQuestion;
  answer: AnswerState;
  onSelectOptions: (ids: string[]) => void;
  onRating: (value: number) => void;
  onText: (value: string) => void;
};

function QuestionBody({ question, answer, onSelectOptions, onRating, onText }: QuestionBodyProps) {
  if (question.type === "SINGLE_SELECT") {
    return (
      <SelectGrid
        question={question}
        selected={answer.selectedOptionIds}
        onChange={(id) => onSelectOptions([id])}
        multi={false}
      />
    );
  }
  if (question.type === "MULTI_SELECT") {
    const config = question.config as Record<string, unknown>;
    const max =
      typeof config.maxSelections === "number"
        ? (config.maxSelections as number)
        : question.options.length;
    const min = typeof config.minSelections === "number" ? (config.minSelections as number) : 1;
    return (
      <div className="space-y-3">
        <SelectGrid
          question={question}
          selected={answer.selectedOptionIds}
          multi
          maxSelections={max}
          onChange={(id) => {
            const current = new Set(answer.selectedOptionIds);
            if (current.has(id)) {
              current.delete(id);
            } else if (current.size < max) {
              current.add(id);
            }
            onSelectOptions(Array.from(current));
          }}
        />
        <p className="text-sm text-muted-foreground">
          {answer.selectedOptionIds.length} of {max} selected (min {min})
        </p>
      </div>
    );
  }
  if (question.type === "RATING") {
    const config = question.config as Record<string, unknown>;
    const minValue = typeof config.min === "number" ? (config.min as number) : 1;
    const maxValue = typeof config.max === "number" ? (config.max as number) : 5;
    const minLabel = typeof config.minLabel === "string" ? (config.minLabel as string) : null;
    const maxLabel = typeof config.maxLabel === "string" ? (config.maxLabel as string) : null;
    const values = Array.from({ length: maxValue - minValue + 1 }, (_, i) => minValue + i);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => {
            const isSelected = answer.ratingValue === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onRating(value)}
                className={`min-h-11 min-w-11 rounded-md border px-4 text-sm font-medium transition ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
        {(minLabel || maxLabel) && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        )}
      </div>
    );
  }
  if (question.type === "FREE_TEXT") {
    const config = question.config as Record<string, unknown>;
    const minChars = typeof config.minChars === "number" ? (config.minChars as number) : 0;
    const maxChars = typeof config.maxChars === "number" ? (config.maxChars as number) : 5000;
    return (
      <div className="space-y-2">
        <textarea
          value={answer.textValue}
          onChange={(event) => onText(event.target.value.slice(0, maxChars))}
          className="min-h-32 w-full rounded-md border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Type your answer here..."
        />
        <p className="text-xs text-muted-foreground">
          {answer.textValue.length} / {maxChars} characters
          {minChars > 0 ? ` (min ${minChars})` : ""}
        </p>
      </div>
    );
  }
  return null;
}

function SelectGrid({
  question,
  selected,
  multi,
  maxSelections,
  onChange,
}: {
  question: TestQuestion;
  selected: string[];
  multi: boolean;
  maxSelections?: number;
  onChange: (id: string) => void;
}) {
  const isText = question.mediaType === "TEXT" || question.options.every((option) => !option.mediaId);

  if (isText) {
    return (
      <div className="flex flex-col gap-2">
        {question.options.map((option) => {
          const isSelected = selected.includes(option.id);
          const disabled =
            multi &&
            !isSelected &&
            typeof maxSelections === "number" &&
            selected.length >= maxSelections;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`min-h-12 rounded-md border px-4 py-3 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {option.label ?? "Untitled option"}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {question.options.map((option) => (
        <MediaOption
          key={option.id}
          option={option}
          isSelected={selected.includes(option.id)}
          onClick={() => onChange(option.id)}
        />
      ))}
    </div>
  );
}

function MediaOption({
  option,
  isSelected,
  onClick,
}: {
  option: TestQuestionOption;
  isSelected: boolean;
  onClick: () => void;
}) {
  const url = resolveMediaUrl(option.media?.url ?? option.mediaUrl);
  const kind = option.media?.fileType ?? null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${
        isSelected
          ? "border-primary ring-2 ring-primary"
          : "border-border hover:border-primary/60"
      }`}
    >
      <div className="aspect-video w-full bg-muted">
        {url && kind === "IMAGE" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={option.label ?? option.media?.fileName ?? ""} className="h-full w-full object-cover" />
        )}
        {url && kind === "VIDEO" && (
          <video src={url} controls className="h-full w-full object-cover" />
        )}
        {url && kind === "AUDIO" && (
          <div className="flex h-full w-full items-center justify-center p-3">
            <audio src={url} controls className="w-full" />
          </div>
        )}
      </div>
      {option.label && (
        <p className="border-t border-border bg-card px-3 py-2 text-sm font-medium">
          {option.label}
        </p>
      )}
    </button>
  );
}

function useAdvisoryCountdown(advisoryMin: number | null, startedAt: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!advisoryMin || !startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [advisoryMin, startedAt]);

  return useMemo(() => {
    if (!advisoryMin || !startedAt) return null;
    const totalSeconds = advisoryMin * 60;
    const elapsed = Math.floor((now - startedAt.getTime()) / 1000);
    const remaining = Math.max(0, totalSeconds - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [advisoryMin, startedAt, now]);
}
