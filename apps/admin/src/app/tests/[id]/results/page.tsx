"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
import type {
  DemographicResults,
  OptionAggregation,
  QuestionResult,
  SegmentBy,
  TestResults,
} from "@/lib/admin-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SEGMENT_OPTIONS: Array<{ value: "none" | SegmentBy; label: string }> = [
  { value: "none", label: "None" },
  { value: "gender", label: "Gender" },
  { value: "ageGroup", label: "Age Group" },
  { value: "country", label: "Country" },
];

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function optionLabel(option: OptionAggregation, index: number) {
  return option.label ?? (option.mediaId ? `Media ${index + 1}` : `Option ${index + 1}`);
}

function OptionBars({ result }: { result: QuestionResult }) {
  const options = result.options ?? [];
  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <div key={option.optionId} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              {option.mediaId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_URL}/media/${option.mediaId}/file`}
                  alt={optionLabel(option, index)}
                  className="h-8 w-8 rounded object-cover"
                />
              )}
              <span className="font-medium">{optionLabel(option, index)}</span>
            </span>
            <span className="text-muted-foreground">
              {option.count} · {option.percentage}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
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
    <div className="space-y-4">
      <div className="flex gap-6 text-sm">
        <div>
          <p className="text-2xl font-bold">{rating.average ?? "—"}</p>
          <p className="text-muted-foreground">Average</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{rating.min ?? "—"}</p>
          <p className="text-muted-foreground">Min</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{rating.max ?? "—"}</p>
          <p className="text-muted-foreground">Max</p>
        </div>
      </div>
      <div className="flex items-end gap-2">
        {rating.distribution.map((bucket) => (
          <div key={bucket.value} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{bucket.count}</span>
            <div
              className="w-full rounded-t bg-primary"
              style={{ height: `${(bucket.count / maxCount) * 80 + 4}px` }}
            />
            <span className="text-xs font-medium">{bucket.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FreeTextResult({ result }: { result: QuestionResult }) {
  const responses = result.textResponses ?? [];
  if (responses.length === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet.</p>;
  }
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto">
      {responses.map((text, index) => (
        <p key={index} className="rounded-md border border-border bg-muted/40 p-2 text-sm">
          {text}
        </p>
      ))}
    </div>
  );
}

function QuestionBody({ result }: { result: QuestionResult }) {
  if (result.answeredCount === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet.</p>;
  }
  if (result.type === "RATING") return <RatingResult result={result} />;
  if (result.type === "FREE_TEXT") return <FreeTextResult result={result} />;
  return <OptionBars result={result} />;
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const testId = params.id;
  const [results, setResults] = useState<TestResults | null>(null);
  const [demographic, setDemographic] = useState<DemographicResults | null>(null);
  const [segmentBy, setSegmentBy] = useState<"none" | SegmentBy>("none");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResults(await apiFetch<TestResults>(`/admin/tests/${testId}/results`));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (segmentBy === "none") {
      setDemographic(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<DemographicResults>(
          `/admin/tests/${testId}/results/demographics?segmentBy=${segmentBy}`
        );
        if (!cancelled) setDemographic(data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to segment results");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [segmentBy, testId]);

  if (loading) return <p className="text-muted-foreground">Loading results…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!results) return <p className="text-muted-foreground">No results found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link className="text-sm text-muted-foreground underline" href="/tests">
            ← Back to tests
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold tracking-tight">
            {results.title}
            <Badge>{results.status}</Badge>
          </h1>
        </div>
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Segment by</label>
          <Select value={segmentBy} onChange={(event) => setSegmentBy(event.target.value as "none" | SegmentBy)}>
            {SEGMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Responses</CardDescription>
            <CardTitle className="text-3xl">{results.totalResponses}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Valid Responses</CardDescription>
            <CardTitle className="text-3xl">{results.validResponses}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Flagged Responses</CardDescription>
            <CardTitle className="text-3xl text-destructive">{results.flaggedResponses}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Avg. Completion</CardDescription>
            <CardTitle className="text-3xl">{formatDuration(results.averageCompletionTime)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {results.validResponses === 0 && (
        <p className="text-sm text-muted-foreground">
          No valid responses yet — charts will populate once evaluators complete this test.
        </p>
      )}

      <div className="space-y-4">
        {results.questions.map((question, index) => {
          const segments =
            demographic?.segments.map((segment) => ({
              label: segment.label,
              responseCount: segment.responseCount,
              question: segment.questions.find((item) => item.questionId === question.questionId),
            })) ?? null;

          return (
            <Card key={question.questionId}>
              <CardHeader>
                <CardDescription>
                  Question {index + 1} · {question.type.replace("_", " ").toLowerCase()} · {question.answeredCount}{" "}
                  responses
                </CardDescription>
                <CardTitle className="text-base">{question.prompt}</CardTitle>
              </CardHeader>
              <CardContent>
                {segments ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {segments.map((segment) => (
                      <div key={segment.label} className="rounded-lg border border-border p-3">
                        <p className="mb-2 text-sm font-semibold">
                          {segment.label}{" "}
                          <span className="font-normal text-muted-foreground">({segment.responseCount})</span>
                        </p>
                        {segment.question ? (
                          <QuestionBody result={segment.question} />
                        ) : (
                          <p className="text-sm text-muted-foreground">No data.</p>
                        )}
                      </div>
                    ))}
                    {segments.length === 0 && (
                      <p className="text-sm text-muted-foreground">No segmented data available.</p>
                    )}
                  </div>
                ) : (
                  <QuestionBody result={question} />
                )}
              </CardContent>
            </Card>
          );
        })}
        {results.questions.length === 0 && (
          <p className="text-sm text-muted-foreground">This test has no scored questions.</p>
        )}
      </div>
    </div>
  );
}
