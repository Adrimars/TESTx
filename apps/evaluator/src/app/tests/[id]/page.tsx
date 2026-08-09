"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { useTestSession } from "@/components/test-session-provider";
import type { TestDetail } from "@/lib/test-types";

export default function TestIntroPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { startSession } = useTestSession();
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<TestDetail>(`/evaluator/tests/${params.id}`)
      .then(setTest)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load test"))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    function handleUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  function handleBegin() {
    if (!test) return;
    setStarting(true);
    startSession(test);
    router.push(`/tests/${test.id}/question/1`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Loading test…</p>
      </div>
    );
  }

  if (error || !test) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Test unavailable</CardTitle>
          <CardDescription>{error ?? "This test could not be loaded."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{test.title}</CardTitle>
          {test.description && <CardDescription className="text-base">{test.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold">{test.questionCount}</p>
              <p className="text-sm text-muted-foreground">Questions</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold">
                {test.advisoryTimeMin ? `~${test.advisoryTimeMin} min` : "Self-paced"}
              </p>
              <p className="text-sm text-muted-foreground">Est. time</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-primary">{test.rewardPoints} pts</p>
              <p className="text-sm text-muted-foreground">Reward</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Answer every question carefully. Responses are checked for consistency and speed.
            Careless answers will not earn points.
          </p>

          <Button
            className="w-full sm:w-auto min-h-[44px] px-8"
            onClick={handleBegin}
            disabled={starting}
          >
            {starting ? "Starting…" : "Begin Test"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
