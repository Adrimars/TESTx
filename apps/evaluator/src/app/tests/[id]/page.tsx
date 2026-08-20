"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Award, Clock, ListChecks } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { useTestSession } from "@/components/test-session-provider";
import type { TestDetail } from "@/lib/test-types";

function StatTile({
  icon: Icon,
  value,
  label,
  highlight,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface p-4 text-center">
      <Icon
        className={`mx-auto mb-2 size-5 ${highlight ? "text-primary" : "text-muted-foreground"}`}
        aria-hidden
      />
      <p className={`text-lg font-bold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

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
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading test…</p>
      </div>
    );
  }

  if (error || !test) {
    return (
      <Card className="mx-auto max-w-lg">
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <p className="text-meta uppercase text-muted-foreground">You are about to start</p>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">{test.title}</h1>
        {test.description && <p className="text-muted-foreground">{test.description}</p>}
      </div>

      <Card>
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-3">
            <StatTile icon={ListChecks} value={String(test.questionCount)} label="Questions" />
            <StatTile
              icon={Clock}
              value={test.advisoryTimeMin ? `~${test.advisoryTimeMin} min` : "Self-paced"}
              label="Est. time"
            />
            <StatTile icon={Award} value={`${test.rewardPoints} pts`} label="Reward" highlight />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="sm:px-10" onClick={handleBegin} disabled={starting}>
              {starting ? "Starting…" : "Begin Test"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.push("/dashboard")}
              disabled={starting}
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
