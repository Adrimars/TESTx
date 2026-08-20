"use client";

import { Card, CardContent, CardHeader, CardTitle, Field, Select, StatCard } from "@testx/ui";
import type {
  DemographicResults,
  OptionAggregation,
  QuestionResult,
  SegmentBy,
  TestResults,
} from "@/lib/admin-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const SEGMENT_OPTIONS: Array<{ value: "none" | SegmentBy; label: string }> = [
  { value: "none", label: "None" },
  { value: "gender", label: "Gender" },
  { value: "ageGroup", label: "Age Group" },
  { value: "country", label: "Country" },
];

export function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function optionLabel(option: OptionAggregation, index: number) {
  return option.label ?? (option.mediaId ? `Media ${index + 1}` : `Option ${index + 1}`);
}

export function SegmentSelect({
  value,
  onChange,
  className,
}: {
  value: "none" | SegmentBy;
  onChange: (value: "none" | SegmentBy) => void;
  className?: string;
}) {
  return (
    <Field label="Segment by" htmlFor="segment-by" className={className}>
      <Select
        id="segment-by"
        value={value}
        onChange={(event) => onChange(event.target.value as "none" | SegmentBy)}
      >
        {SEGMENT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function OptionBars({ result }: { result: QuestionResult }) {
  const options = result.options ?? [];
  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <div key={option.optionId} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {option.mediaId && (
                <img
                  src={`${API_URL}/media/${option.mediaId}/file`}
                  alt={optionLabel(option, index)}
                  className="size-8 shrink-0 rounded object-cover"
                />
              )}
              <span className="truncate font-medium text-foreground">{optionLabel(option, index)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {option.count} · {option.percentage}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${option.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RatingResult({ result }: { result: QuestionResult }) {
  const rating = result.rating;
  if (!rating) return null;
  const maxCount = Math.max(1, ...rating.distribution.map((bucket) => bucket.count));
  return (
    <div className="space-y-5">
      <div className="flex gap-8 text-sm">
        <div>
          <p className="text-meta uppercase text-muted-foreground">Average</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{rating.average ?? "—"}</p>
        </div>
        <div>
          <p className="text-meta uppercase text-muted-foreground">Min</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{rating.min ?? "—"}</p>
        </div>
        <div>
          <p className="text-meta uppercase text-muted-foreground">Max</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{rating.max ?? "—"}</p>
        </div>
      </div>
      <div className="flex items-end gap-2">
        {rating.distribution.map((bucket) => (
          <div key={bucket.value} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs tabular-nums text-muted-foreground">{bucket.count}</span>
            <div
              className="w-full rounded-t bg-primary"
              style={{ height: `${(bucket.count / maxCount) * 80 + 4}px` }}
            />
            <span className="text-xs font-medium tabular-nums">{bucket.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuestionBody({ result }: { result: QuestionResult }) {
  if (result.answeredCount === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet.</p>;
  }
  if (result.type === "RATING") return <RatingResult result={result} />;
  return <OptionBars result={result} />;
}

/** The four headline counters shared by the results and report screens. */
export function ResultsSummary({ results }: { results: TestResults }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total Responses" value={results.totalResponses} />
      <StatCard label="Valid Responses" value={results.validResponses} tone="success" />
      <StatCard label="Flagged Responses" value={results.flaggedResponses} tone="danger" />
      <StatCard label="Avg. Completion" value={formatDuration(results.averageCompletionTime)} />
    </div>
  );
}

/**
 * Per-question breakdown, optionally split into demographic segments.
 * `showAnsweredCount` is off on the report screen while a segment is active,
 * matching what each screen showed before.
 */
export function QuestionResults({
  results,
  demographic,
  showAnsweredCount = true,
}: {
  results: TestResults;
  demographic: DemographicResults | null;
  showAnsweredCount?: boolean;
}) {
  return (
    <div className="space-y-4">
      {results.questions.map((question, index) => (
        <Card key={question.questionId}>
          <CardHeader className="pb-3">
            <p className="text-meta uppercase text-muted-foreground">
              Question {index + 1} · {question.type.replace("_", " ").toLowerCase()}
              {showAnsweredCount && ` · ${question.answeredCount} responses`}
            </p>
            <CardTitle>{question.prompt}</CardTitle>
          </CardHeader>
          <CardContent>
            {demographic ? (
              <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                {demographic.segments.map((segment) => {
                  const segmentQuestion = segment.questions.find(
                    (item) => item.questionId === question.questionId,
                  );
                  return (
                    <div key={segment.label}>
                      <p className="mb-2.5 border-b border-border pb-1.5 text-sm font-semibold text-foreground">
                        {segment.label}{" "}
                        <span className="font-normal tabular-nums text-muted-foreground">
                          ({segment.responseCount})
                        </span>
                      </p>
                      {segmentQuestion ? (
                        <QuestionBody result={segmentQuestion} />
                      ) : (
                        <p className="text-sm text-muted-foreground">No data.</p>
                      )}
                    </div>
                  );
                })}
                {demographic.segments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No segmented data available.</p>
                )}
              </div>
            ) : (
              <QuestionBody result={question} />
            )}
          </CardContent>
        </Card>
      ))}
      {results.questions.length === 0 && (
        <p className="text-sm text-muted-foreground">This test has no scored questions.</p>
      )}
    </div>
  );
}
