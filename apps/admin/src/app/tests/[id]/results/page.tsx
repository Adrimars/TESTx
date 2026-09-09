"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [segmentBy, setSegmentBy] = useState<"none" | SegmentBy>("none");

  const resultsQuery = useQuery({
    queryKey: ["admin", "tests", testId, "results"],
    queryFn: () => apiFetch<TestResults>(`/admin/tests/${testId}/results`),
  });

  const demographicQuery = useQuery({
    queryKey: ["admin", "tests", testId, "results", "demographics", segmentBy],
    queryFn: () =>
      apiFetch<DemographicResults>(`/admin/tests/${testId}/results/demographics?segmentBy=${segmentBy}`),
    enabled: segmentBy !== "none",
  });

  if (resultsQuery.isPending) return <p className="text-muted-foreground">Loading results…</p>;
  if (resultsQuery.isError) {
    return (
      <Alert>{resultsQuery.error instanceof Error ? resultsQuery.error.message : "Failed to load results"}</Alert>
    );
  }

  const results = resultsQuery.data;
  if (!results) return <p className="text-muted-foreground">No results found.</p>;

  const demographic = segmentBy !== "none" ? (demographicQuery.data ?? null) : null;

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

      {demographicQuery.isError && (
        <Alert>
          {demographicQuery.error instanceof Error ? demographicQuery.error.message : "Failed to segment results"}
        </Alert>
      )}

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
