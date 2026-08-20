"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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

  const [results, setResults] = useState<TestResults | null>(null);
  const [demographic, setDemographic] = useState<DemographicResults | null>(null);
  const [segmentBy, setSegmentBy] = useState<"none" | SegmentBy>("none");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = results?.status === "ACTIVE";

  const fetchAll = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const [base, demo] = await Promise.all([
          apiFetch<TestResults>(`/admin/tests/${testId}/report`),
          segmentBy !== "none"
            ? apiFetch<DemographicResults>(`/admin/tests/${testId}/report?segmentBy=${segmentBy}`)
            : Promise.resolve(null),
        ]);
        setResults(base);
        setDemographic(demo);
        setLastRefreshed(new Date());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [testId, segmentBy]
  );

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      void fetchAll({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, fetchAll]);

  if (loading) return <p className="text-muted-foreground">Loading report…</p>;
  if (error) return <Alert>{error}</Alert>;
  if (!results) return <p className="text-muted-foreground">No data found.</p>;

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
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground">
              Last updated {lastRefreshed.toLocaleTimeString()}
              {isActive && " · auto-refreshes every 30s"}
            </p>
          )}
        </div>

        <div className="flex items-end gap-3">
          <Button variant="secondary" onClick={() => fetchAll({ silent: true })} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <SegmentSelect value={segmentBy} onChange={setSegmentBy} className="w-44" />
        </div>
      </div>

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
