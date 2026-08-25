"use client";

import { useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@testx/ui";
import { useTestSession } from "@/components/test-session-provider";
import { resolveMediaUrl } from "@/lib/api";
import type { Question, QuestionOption } from "@/lib/test-types";

/** Shared frame for a selectable option, so text and media options behave the same. */
/**
 * Question types this page knows how to render. RANKING is deliberately absent until its
 * drag-to-reorder control lands (plan.md 13.3) - the type already exists server-side and
 * can appear in an active test, so this page has to cope with meeting one.
 */
const RENDERABLE_TYPES = new Set(["SINGLE_SELECT", "MULTI_SELECT", "RATING"]);

function OptionShell({
  selected,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative min-h-11 overflow-hidden rounded-lg border-2 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"
      } ${className ?? ""}`}
    >
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full transition-opacity ${
          selected ? "bg-primary text-primary-foreground opacity-100" : "opacity-0"
        }`}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}

function OptionMedia({ option }: { option: QuestionOption }) {
  const url = resolveMediaUrl(option.media?.url ?? option.mediaUrl);
  if (!url) return null;
  const kind = option.media?.fileType ?? "IMAGE";
  const label = option.label ?? option.media?.fileName ?? "Option";

  if (kind === "VIDEO") {
    return <video src={url} controls className="aspect-video w-full bg-muted object-cover" />;
  }
  if (kind === "AUDIO") {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-muted p-4">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      className="aspect-video w-full bg-muted object-cover"
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options.map((opt) => (
          <OptionShell key={opt.id} selected={selected.includes(opt.id)} onClick={() => onSelect([opt.id])}>
            <OptionMedia option={opt} />
            {opt.label && <p className="px-3 py-2.5 text-sm font-medium">{opt.label}</p>}
          </OptionShell>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      {question.options.map((opt) => (
        <OptionShell
          key={opt.id}
          selected={selected.includes(opt.id)}
          onClick={() => onSelect([opt.id])}
          className="w-full px-4 py-3.5 pr-11 text-sm font-medium"
        >
          {opt.label}
        </OptionShell>
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

  const counter = (
    <p className="mb-3 text-sm text-muted-foreground">
      Select up to {max}{" "}
      <span className="font-medium tabular-nums text-foreground">({selected.length} selected)</span>
    </p>
  );

  if (hasMedia) {
    return (
      <div>
        {counter}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {question.options.map((opt) => (
            <OptionShell key={opt.id} selected={selected.includes(opt.id)} onClick={() => toggle(opt.id)}>
              <OptionMedia option={opt} />
              {opt.label && <p className="px-3 py-2.5 text-sm font-medium">{opt.label}</p>}
            </OptionShell>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {counter}
      <div className="grid gap-2.5">
        {question.options.map((opt) => (
          <OptionShell
            key={opt.id}
            selected={selected.includes(opt.id)}
            onClick={() => toggle(opt.id)}
            className="w-full px-4 py-3.5 pr-11 text-sm font-medium"
          >
            {opt.label}
          </OptionShell>
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
  // A rating question carries at most one option: the item being rated.
  const subject = question.options[0];

  return (
    <div className="space-y-3">
      {subject ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <OptionMedia option={subject} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onRate(v)}
            aria-pressed={value === v}
            className={`min-h-12 min-w-12 rounded-lg border-2 text-base font-bold tabular-nums transition-colors ${
              value === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"
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

  useEffect(() => {
    if (!test) {
      router.replace(`/tests/${params.id}`);
    }
  }, [test, params.id, router]);

  const question: Question | undefined = test?.questions[questionIndex];

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
    // A type this app cannot render yet must not trap the evaluator on a dead question
    // with Next disabled forever. Treating it as answerable lets them move past it, and
    // the empty answer submits as a skip, which the API accepts.
    return !RENDERABLE_TYPES.has(question!.type);
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

  const percent = ((questionIndex + 1) / totalVisible) * 100;

  return (
    <div className="mx-auto max-w-2xl pb-24 sm:pb-0">
      {/* Progress stays in view while the options scroll. */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium text-foreground">
            Question <span className="tabular-nums">{questionIndex + 1}</span> of{" "}
            <span className="tabular-nums">{totalVisible}</span>
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <h1 className="mb-5 text-xl font-semibold leading-snug text-foreground">{question.prompt}</h1>

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
      {!RENDERABLE_TYPES.has(question.type) && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          This question type is not available on the web yet. Skip it here, or answer it in
          the TESTx mobile app.
        </div>
      )}

      {/* Pinned to the bottom on phones, inline on desktop. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button variant="secondary" onClick={goPrev} disabled={isFirst}>
          <ArrowLeft className="size-4" aria-hidden />
          Previous
        </Button>
        <Button onClick={goNext} disabled={!hasAnswer()}>
          {isLast ? "Review & Submit" : "Next"}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
