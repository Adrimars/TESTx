"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Alert, Badge, Button } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { statusVariant } from "@/lib/status";
import { QuestionResults, ResultsSummary, SegmentSelect } from "@/components/results-view";
import type { DemographicResults, SegmentBy, TestResults } from "@/lib/admin-types";

const REFRESH_INTERVAL_MS = 30_000;

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const testId = params.id;
  const [segmentBy, setSegmentBy] = useState<"none" | SegmentBy>("none");

  // `refetchInterval` only fires while `status` is ACTIVE, and — react-query's own
  // default, not something opted into here — pauses automatically while the tab isn't
  // focused (`refetchIntervalInBackground` defaults to false). N admins with this page
  // open no longer multiplies identical report queries by N every 30s while unfocused.
  const resultsQuery = useQuery({
    queryKey: ["admin", "tests", testId, "report"],
    queryFn: () => apiFetch<TestResults>(`/admin/tests/${testId}/report`),
    refetchInterval: (query) => (query.state.data?.status === "ACTIVE" ? REFRESH_INTERVAL_MS : false),
  });

  const demographicQuery = useQuery({
    queryKey: ["admin", "tests", testId, "report", "demographics", segmentBy],
    queryFn: () =>
      apiFetch<DemographicResults>(`/admin/tests/${testId}/report?segmentBy=${segmentBy}`),
    enabled: segmentBy !== "none",
    refetchInterval: () => (resultsQuery.data?.status === "ACTIVE" ? REFRESH_INTERVAL_MS : false),
  });

  const results = resultsQuery.data;
  const isActive = results?.status === "ACTIVE";
  const refreshing = resultsQuery.isFetching || demographicQuery.isFetching;

  function refresh() {
    void resultsQuery.refetch();
    if (segmentBy !== "none") void demographicQuery.refetch();
  }

  if (resultsQuery.isPending) return <p className="text-muted-foreground">Loading report…</p>;
  if (resultsQuery.isError) {
    return (
      <Alert>{resultsQuery.error instanceof Error ? resultsQuery.error.message : "Failed to load report"}</Alert>
    );
  }
  if (!results) return <p className="text-muted-foreground">No data found.</p>;

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
            {isActive && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-success" />
                </span>
                Live
              </span>
            )}
          </div>
          {resultsQuery.dataUpdatedAt > 0 && (
            <p className="text-xs text-muted-foreground">
              Last updated {new Date(resultsQuery.dataUpdatedAt).toLocaleTimeString()}
              {isActive && " · auto-refreshes every 30s"}
            </p>
          )}
        </div>

        <div className="flex items-end gap-3">
          <Button variant="secondary" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <SegmentSelect value={segmentBy} onChange={setSegmentBy} className="w-44" />
        </div>
      </div>

      {demographicQuery.isError && (
        <Alert>
          {demographicQuery.error instanceof Error ? demographicQuery.error.message : "Failed to segment report"}
        </Alert>
      )}

      <ResultsSummary results={results} />

      {results.validResponses === 0 && (
        <p className="text-sm text-muted-foreground">
          No valid responses yet — charts will populate once evaluators complete this test.
        </p>
      )}

      <QuestionResults results={results} demographic={demographic} showAnsweredCount={!demographic} />
    </div>
  );
}
