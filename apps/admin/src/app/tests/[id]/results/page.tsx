"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@testx/ui";
import { apiFetch } from "@/lib/api";

type OptionResult = { optionId: string; label: string | null; count: number; percentage: number };
type DistEntry = { value: number; count: number };

type QuestionResult =
  | { questionId: string; prompt: string; type: "SINGLE_SELECT" | "MULTI_SELECT"; options: OptionResult[] }
  | { questionId: string; prompt: string; type: "RATING"; average: number | null; min: number | null; max: number | null; distribution: DistEntry[] }
  | { questionId: string; prompt: string; type: "FREE_TEXT"; responses: string[]; total: number };

type ResultsData = {
  testId: string;
  title: string;
  totalResponses: number;
  validResponses: number;
  flaggedResponses: number;
  avgCompletionTimeSeconds: number;
  questions: QuestionResult[];
};

type DemographicSegment = {
  label: string;
  responseCount: number;
  questions: QuestionResult[];
};

type DemographicsData = {
  segmentBy: string;
  segments: DemographicSegment[];
};

function BarRow({ label, count, percentage }: { label: string | null; count: number; percentage: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground truncate max-w-[60%]">{label ?? "(no label)"}</span>
        <span className="font-medium">{percentage}% ({count})</span>
      </div>
      <div className="h-2 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function SelectResult({ q, segmentMode }: { q: Extract<QuestionResult, { type: "SINGLE_SELECT" | "MULTI_SELECT" }>; segmentMode: boolean }) {
  return (
    <div className="space-y-2">
      {q.options.map((opt) => (
        <BarRow key={opt.optionId} label={opt.label} count={opt.count} percentage={opt.percentage} />
      ))}
    </div>
  );
}

function RatingResult({ q }: { q: Extract<QuestionResult, { type: "RATING" }> }) {
  return (
    <div className="space-y-3">
      {q.average !== null && (
        <p className="text-2xl font-bold">{q.average.toFixed(2)} <span className="text-sm text-muted-foreground font-normal">avg</span></p>
      )}
      <div className="space-y-1">
        {q.distribution.map((d) => {
          const total = q.distribution.reduce((s, x) => s + x.count, 0);
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return <BarRow key={d.value} label={String(d.value)} count={d.count} percentage={pct} />;
        })}
      </div>
    </div>
  );
}

function FreeTextResult({ q }: { q: Extract<QuestionResult, { type: "FREE_TEXT" }> }) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {q.responses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No responses yet.</p>
      ) : (
        q.responses.map((text, i) => (
          <p key={i} className="text-sm border border-border rounded p-2">{text}</p>
        ))
      )}
      {q.total > q.responses.length && (
        <p className="text-xs text-muted-foreground">Showing {q.responses.length} of {q.total}</p>
      )}
    </div>
  );
}

function QuestionCard({ q, segmentMode = false }: { q: QuestionResult; segmentMode?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {q.type.replace("_", " ")}
          </span>
        </div>
        <CardTitle className="text-base leading-snug">{q.prompt}</CardTitle>
      </CardHeader>
      <CardContent>
        {(q.type === "SINGLE_SELECT" || q.type === "MULTI_SELECT") && (
          <SelectResult q={q} segmentMode={segmentMode} />
        )}
        {q.type === "RATING" && <RatingResult q={q} />}
        {q.type === "FREE_TEXT" && <FreeTextResult q={q} />}
      </CardContent>
    </Card>
  );
}

function SegmentedQuestionCard({ questionIndex, segments }: { questionIndex: number; segments: DemographicSegment[] }) {
  const questions = segments.map((seg) => ({
    seg: seg.label,
    count: seg.responseCount,
    q: seg.questions[questionIndex],
  })).filter((x) => x.q !== undefined);

  if (!questions.length) return null;
  const firstQ = questions[0]!.q!;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {firstQ.type.replace("_", " ")}
          </span>
        </div>
        <CardTitle className="text-base leading-snug">{firstQ.prompt}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2">
          {questions.map(({ seg, count, q }) => {
            if (!q) return null;
            return (
              <div key={seg} className="space-y-2">
                <p className="text-sm font-semibold">{seg} <span className="text-xs text-muted-foreground">({count})</span></p>
                {(q.type === "SINGLE_SELECT" || q.type === "MULTI_SELECT") && (
                  <div className="space-y-1">
                    {q.options.map((opt) => (
                      <BarRow key={opt.optionId} label={opt.label} count={opt.count} percentage={opt.percentage} />
                    ))}
                  </div>
                )}
                {q.type === "RATING" && q.average !== null && (
                  <p className="text-xl font-bold">{q.average.toFixed(2)} avg</p>
                )}
                {q.type === "FREE_TEXT" && (
                  <p className="text-sm text-muted-foreground">{q.total} responses</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const [results, setResults] = useState<ResultsData | null>(null);
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [segmentBy, setSegmentBy] = useState<"none" | "gender" | "ageGroup" | "country">("none");
  const [loading, setLoading] = useState(true);
  const [segLoading, setSegLoading] = useState(false);

  useEffect(() => {
    apiFetch<ResultsData>(`/admin/tests/${params.id}/results`)
      .then(setResults)
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (segmentBy === "none") {
      setDemographics(null);
      return;
    }
    setSegLoading(true);
    apiFetch<DemographicsData>(`/admin/tests/${params.id}/results/demographics?segmentBy=${segmentBy}`)
      .then(setDemographics)
      .finally(() => setSegLoading(false));
  }, [params.id, segmentBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Loading results…</p>
      </div>
    );
  }

  if (!results) {
    return <p className="text-muted-foreground">Results not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{results.title}</h1>
        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
          <span>{results.totalResponses} total responses</span>
          <span>·</span>
          <span className="text-green-700">{results.validResponses} valid</span>
          <span>·</span>
          <span className="text-red-700">{results.flaggedResponses} flagged</span>
          {results.avgCompletionTimeSeconds > 0 && (
            <>
              <span>·</span>
              <span>avg {Math.round(results.avgCompletionTimeSeconds / 60)} min</span>
            </>
          )}
        </div>
      </div>

      {results.flaggedResponses > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {results.flaggedResponses} response{results.flaggedResponses > 1 ? "s were" : " was"} flagged for quality issues and excluded from aggregations.
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium" htmlFor="segment-select">Segment by</label>
        <select
          id="segment-select"
          className="rounded border border-border bg-background px-3 py-1.5 text-sm"
          value={segmentBy}
          onChange={(e) => setSegmentBy(e.target.value as typeof segmentBy)}
        >
          <option value="none">None</option>
          <option value="gender">Gender</option>
          <option value="ageGroup">Age Group</option>
          <option value="country">Country</option>
        </select>
        {segLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      <div className="space-y-4">
        {segmentBy === "none" || !demographics ? (
          results.questions.map((q) => <QuestionCard key={q.questionId} q={q} />)
        ) : (
          results.questions.map((_, i) => (
            <SegmentedQuestionCard key={i} questionIndex={i} segments={demographics.segments} />
          ))
        )}
      </div>
    </div>
  );
}
