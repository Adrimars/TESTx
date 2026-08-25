"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, GripVertical } from "lucide-react";
import { Button } from "@testx/ui";
import { useTestSession } from "@/components/test-session-provider";
import { resolveMediaUrl } from "@/lib/api";
import type { Question, QuestionOption } from "@/lib/test-types";

/** Shared frame for a selectable option, so text and media options behave the same. */
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

/** The media a question is about, shown once above the answer UI at a readable size. */
function QuestionMediaPanel({ question }: { question: Question }) {
  const url = resolveMediaUrl(question.media?.url ?? question.mediaUrl);
  if (!url) return null;
  const kind = question.media?.fileType ?? "IMAGE";
  const label = question.media?.fileName ?? question.prompt;

  if (kind === "VIDEO") {
    return (
      <video src={url} controls className="mb-5 w-full rounded-lg border border-border bg-muted" />
    );
  }
  if (kind === "AUDIO") {
    return (
      <div className="mb-5 rounded-lg border border-border bg-muted p-4">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      className="mb-5 max-h-96 w-full rounded-lg border border-border bg-muted object-contain"
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

  return (
    <div className="space-y-3">
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

/**
 * A drag-to-rank list. Dragging is the whole interaction: grab a row anywhere and the rows
 * under it move aside live, so the list always reads as its current ranking. Keyboard users
 * get the same thing through the grip, which is focusable and moves its row with the arrow
 * keys — and that path is what makes the list usable without a pointer at all.
 */
function OrderingQuestion({
  question,
  order,
  onReorder,
}: {
  question: Question;
  order: string[];
  onReorder: (ids: string[]) => void;
}) {
  const config = question.config as { topLabel?: string; bottomLabel?: string };
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  /** Pointer position the current drag is measured from; shifts as rows swap under it. */
  const grabY = useRef(0);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const byId = new Map(question.options.map((option) => [option.id, option]));
  // The session seeds a shuffled order; fall back to the authored one if it is ever missing.
  const ranked = order.length === question.options.length
    ? order.map((id) => byId.get(id)).filter((option): option is QuestionOption => option !== undefined)
    : question.options;

  function optionName(option: QuestionOption, index: number) {
    return option.label ?? option.media?.fileName ?? `Option ${index + 1}`;
  }

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= ranked.length || to === from) return;
    const next = ranked.map((option) => option.id);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onReorder(next);
  }

  function startDrag(event: React.PointerEvent, id: string) {
    // Ignore secondary buttons so a right-click never leaves a row stuck to the pointer.
    if (event.button !== 0) return;
    // Capture on the row, not the grip: the row is what carries the move handlers, and it
    // keeps receiving them even when the pointer runs past the end of the list.
    rowRefs.current.get(id)?.setPointerCapture(event.pointerId);
    setDraggingId(id);
    setDragOffset(0);
    grabY.current = event.clientY;
  }

  function onDrag(event: React.PointerEvent) {
    if (!draggingId) return;
    const index = ranked.findIndex((option) => option.id === draggingId);
    if (index < 0) return;

    // Neighbours are measured live: their rows are not translated, so their midpoints are
    // where the dragged row would land if it were dropped now.
    const goingDown = event.clientY > grabY.current;
    const neighbour = ranked[goingDown ? index + 1 : index - 1];
    const rect = neighbour ? rowRefs.current.get(neighbour.id)?.getBoundingClientRect() : undefined;
    const draggedRect = rowRefs.current.get(draggingId)?.getBoundingClientRect();

    if (rect && draggedRect) {
      const midpoint = rect.top + rect.height / 2;
      if ((goingDown && event.clientY > midpoint) || (!goingDown && event.clientY < midpoint)) {
        // Shift the reference point by the distance the row just travelled — measured between
        // slots rather than by row height, so the gap between rows is accounted for and the
        // row keeps sitting under the pointer instead of drifting away from it.
        const slotTop = draggedRect.top - dragOffset;
        grabY.current += rect.top - slotTop;
        moveTo(index, goingDown ? index + 1 : index - 1);
      }
    }

    setDragOffset(event.clientY - grabY.current);
  }

  function endDrag(event: React.PointerEvent) {
    if (!draggingId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingId(null);
    setDragOffset(0);
  }

  function onGripKeyDown(event: React.KeyboardEvent, index: number, option: QuestionOption) {
    const direction = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (direction === 0) return;
    const target = index + direction;
    if (target < 0 || target >= ranked.length) return;
    event.preventDefault();
    moveTo(index, target);
    setAnnouncement(`${optionName(option, index)} moved to position ${target + 1} of ${ranked.length}.`);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {config.topLabel ?? "Drag the options into order — best first."}
      </p>

      <ol className="grid gap-2.5">
        {ranked.map((option, index) => {
          const dragging = draggingId === option.id;
          return (
            <li
              key={option.id}
              ref={(element) => {
                if (element) rowRefs.current.set(option.id, element);
                else rowRefs.current.delete(option.id);
              }}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={dragging ? { transform: `translateY(${dragOffset}px)` } : undefined}
              className={`flex select-none items-center gap-3 rounded-lg border-2 bg-card p-2.5 ${
                dragging ? "z-10 border-primary shadow-lg" : "border-border hover:border-primary/40"
              }`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold tabular-nums text-muted-foreground">
                {index + 1}
              </span>

              {option.mediaUrl && (
                <div className="w-24 shrink-0 overflow-hidden rounded-md">
                  <OptionMedia option={option} />
                </div>
              )}
              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                {optionName(option, index)}
              </span>

              {/*
                Dragging starts here rather than anywhere on the row for two reasons: a row can
                hold a video or audio player whose controls need the same presses, and on a
                phone a row-wide drag target would eat the scroll gesture.
              */}
              <button
                type="button"
                aria-label={`Reorder ${optionName(option, index)}, position ${index + 1} of ${
                  ranked.length
                }. Use the arrow keys to move it.`}
                onPointerDown={(event) => startDrag(event, option.id)}
                onKeyDown={(event) => onGripKeyDown(event, index, option)}
                className={`flex min-h-11 w-11 shrink-0 touch-none items-center justify-center self-stretch rounded-md text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  dragging ? "cursor-grabbing bg-primary/10 text-primary" : "cursor-grab hover:bg-accent"
                }`}
              >
                <GripVertical className="size-5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {config.bottomLabel && <p className="text-sm text-muted-foreground">{config.bottomLabel}</p>}
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
    if (question!.type === "ORDERING") {
      // The list arrives pre-filled with a shuffle, so only a deliberate rearrangement counts.
      return selected.length === question!.options.length && answer?.orderTouched === true;
    }
    return false;
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

      <QuestionMediaPanel question={question} />

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
      {question.type === "ORDERING" && (
        <OrderingQuestion
          question={question}
          order={selected}
          onReorder={(ids) => setAnswer(question.id, { selectedOptionIds: ids, orderTouched: true })}
        />
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
