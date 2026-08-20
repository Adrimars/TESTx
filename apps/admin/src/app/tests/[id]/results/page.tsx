"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { statusVariant } from "@/lib/status";
import {
  QuestionResults,
  ResultsSummary,
  SegmentSelect,
} from "@/components/results-view";
import type { DemographicResults, SegmentBy, TestResults } from "@/lib/admin-types";

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
  if (error) return <Alert>{error}</Alert>;
  if (!results) return <p className="text-muted-foreground">No results found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/tests" className="text-sm text-muted-foreground underline underline-offset-4">
            ← Back to tests
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title text-foreground">{results.title}</h1>
            <Badge variant={statusVariant(results.status)}>{results.status}</Badge>
          </div>
        </div>
        <SegmentSelect value={segmentBy} onChange={setSegmentBy} className="w-48" />
      </div>

      <ResultsSummary results={results} />

      {results.validResponses === 0 && (
        <p className="text-sm text-muted-foreground">
          No valid responses yet — charts will populate once evaluators complete this test.
        </p>
      )}

      <QuestionResults results={results} demographic={demographic} />
    </div>
  );
}
