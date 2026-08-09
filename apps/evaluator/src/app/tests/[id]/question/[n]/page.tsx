"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@testx/ui";
import { useTestSession } from "@/components/test-session-provider";
import type { Question, QuestionOption } from "@/lib/test-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function MediaImage({ url, label }: { url: string; label: string | null }) {
  return (
    <img
      src={`${API_URL}${url}`}
      alt={label ?? "Option"}
      className="w-full h-32 sm:h-40 object-cover rounded-md"
      loading="lazy"
    />
  );
}

function SingleSelectQuestion({
  question,
  selected,
  onSelect,
}: {
  question: Question;
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  const hasMedia = question.options.some((o) => o.mediaUrl);

  if (hasMedia) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect([opt.id])}
            className={`rounded-lg border-2 overflow-hidden text-left transition-all min-h-[44px] ${
              selected.includes(opt.id)
                ? "border-primary ring-2 ring-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            {opt.mediaUrl && <MediaImage url={opt.mediaUrl} label={opt.label} />}
            {opt.label && (
              <p className="p-2 text-sm font-medium">{opt.label}</p>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {question.options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect([opt.id])}
          className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all min-h-[44px] ${
            selected.includes(opt.id)
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MultiSelectQuestion({
  question,
  selected,
  onSelect,
}: {
  question: Question;
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  const config = question.config as { maxSelections?: number; minSelections?: number };
  const max = config.maxSelections ?? question.options.length;
  const hasMedia = question.options.some((o) => o.mediaUrl);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onSelect(selected.filter((s) => s !== id));
    } else if (selected.length < max) {
      onSelect([...selected, id]);
    }
  }

  if (hasMedia) {
    return (
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          Select up to {max} ({selected.length} selected)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`rounded-lg border-2 overflow-hidden text-left transition-all min-h-[44px] ${
                selected.includes(opt.id)
                  ? "border-primary ring-2 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {opt.mediaUrl && <MediaImage url={opt.mediaUrl} label={opt.label} />}
              {opt.label && <p className="p-2 text-sm font-medium">{opt.label}</p>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Select up to {max} ({selected.length} selected)
      </p>
      <div className="space-y-2">
        {question.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all min-h-[44px] ${
              selected.includes(opt.id)
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RatingQuestion({
  question,
  value,
  onRate,
}: {
  question: Question;
  value: number | null;
  onRate: (v: number) => void;
}) {
  const config = question.config as { min?: number; max?: number; minLabel?: string; maxLabel?: string };
  const min = config.min ?? 1;
  const max = config.max ?? 5;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onRate(v)}
            className={`min-w-[44px] min-h-[44px] rounded-lg border-2 font-bold transition-all ${
              value === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary/50"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      {(config.minLabel || config.maxLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{config.minLabel ?? ""}</span>
          <span>{config.maxLabel ?? ""}</span>
        </div>
      )}
    </div>
  );
}

function FreeTextQuestion({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (v: string) => void;
}) {
  const config = question.config as { minChars?: number; maxChars?: number };
  return (
    <div className="space-y-2">
      <textarea
        className="w-full min-h-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Your answer…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={config.maxChars}
      />
      {config.maxChars && (
        <p className="text-xs text-muted-foreground text-right">
          {value.length} / {config.maxChars}
        </p>
      )}
    </div>
  );
}

export default function QuestionPage() {
  const params = useParams<{ id: string; n: string }>();
  const router = useRouter();
  const { state, setAnswer, getAnswer, recordTime } = useTestSession();
  const questionIndex = Number(params.n) - 1;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);

  const test = state.test;

  useEffect(() => {
    function handleUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // If no session loaded redirect to intro
  useEffect(() => {
    if (!test) {
      router.replace(`/tests/${params.id}`);
    }
  }, [test, params.id, router]);

  const question: Question | undefined = test?.questions[questionIndex];

  // Per-question timer
  useEffect(() => {
    if (!question) return;
    tickRef.current = 0;
    timerRef.current = setInterval(() => {
      tickRef.current += 1;
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (tickRef.current > 0) {
        recordTime(question.id, tickRef.current);
      }
    };
  }, [question?.id]);

  if (!test || !question) return null;

  const answer = getAnswer(question.id);
  const selected = answer?.selectedOptionIds ?? [];
  const ratingValue = answer?.ratingValue ?? null;
  const textValue = answer?.textValue ?? "";

  const totalVisible = test.questions.length;
  const isFirst = questionIndex === 0;
  const isLast = questionIndex === totalVisible - 1;

  function hasAnswer(): boolean {
    if (question!.type === "SINGLE_SELECT") return selected.length === 1;
    if (question!.type === "MULTI_SELECT") {
      const config = question!.config as { minSelections?: number };
      return selected.length >= (config.minSelections ?? 1);
    }
    if (question!.type === "RATING") return ratingValue !== null;
    return true; // free text always allows next
  }

  function goNext() {
    if (isLast) {
      router.push(`/tests/${params.id}/review`);
    } else {
      router.push(`/tests/${params.id}/question/${questionIndex + 2}`);
    }
  }

  function goPrev() {
    router.push(`/tests/${params.id}/question/${questionIndex}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Question {questionIndex + 1} of {totalVisible}</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${((questionIndex + 1) / totalVisible) * 100}%` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-snug">{question.prompt}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {question.type === "SINGLE_SELECT" && (
            <SingleSelectQuestion
              question={question}
              selected={selected}
              onSelect={(ids) => setAnswer(question.id, { selectedOptionIds: ids })}
            />
          )}
          {question.type === "MULTI_SELECT" && (
            <MultiSelectQuestion
              question={question}
              selected={selected}
              onSelect={(ids) => setAnswer(question.id, { selectedOptionIds: ids })}
            />
          )}
          {question.type === "RATING" && (
            <RatingQuestion
              question={question}
              value={ratingValue}
              onRate={(v) => setAnswer(question.id, { ratingValue: v })}
            />
          )}
          {question.type === "FREE_TEXT" && (
            <FreeTextQuestion
              question={question}
              value={textValue}
              onChange={(v) => setAnswer(question.id, { textValue: v })}
            />
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="secondary"
              onClick={goPrev}
              disabled={isFirst}
              className="min-h-[44px]"
            >
              Previous
            </Button>
            <Button
              onClick={goNext}
              disabled={!hasAnswer()}
              className="min-h-[44px]"
            >
              {isLast ? "Review & Submit" : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
