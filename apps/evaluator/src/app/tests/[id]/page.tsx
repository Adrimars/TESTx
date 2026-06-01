"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
import {
  useTestSession,
  type TestSessionData,
} from "@/components/test-session-provider";

export default function TestIntroPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const testId = params?.id;
  const { startSession } = useTestSession();
  const [test, setTest] = useState<TestSessionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<TestSessionData>(`/evaluator/tests/${testId}`);
        if (!cancelled) {
          setTest(data);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load test");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const handleBegin = useCallback(() => {
    if (!test) return;
    startSession(test);
    router.push(`/tests/${test.id}/question/1`);
  }, [router, startSession, test]);

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load test</CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!test) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading test...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{test.title}</CardTitle>
          {test.description && <CardDescription>{test.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Info label="Questions" value={String(test.questionCount)} />
            <Info
              label="Estimated time"
              value={test.advisoryTimeMin ? `${test.advisoryTimeMin} min` : "—"}
            />
            <Info label="Reward" value={`${test.rewardPoints} pts`} />
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Before you begin</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Complete the test in one session — leaving discards your progress.</li>
              <li>Take your time on each question to earn the reward.</li>
              <li>You can revisit answers using the Previous button.</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleBegin}>Begin Test</Button>
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
