"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@testx/ui";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import type { NextTest } from "@/lib/test-types";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [noTests, setNoTests] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = user?.evaluatorProfile?.balance ?? 0;

  async function handleStartNextTest() {
    setLoading(true);
    setNoTests(false);
    setError(null);
    try {
      const result = await apiFetch<NextTest | null>("/evaluator/next-test");
      if (!result) {
        setNoTests(true);
      } else {
        router.push(`/tests/${result.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Start your next evaluation</CardTitle>
          <CardDescription>
            Tests are auto-assigned based on your profile. Complete honestly to earn points.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full sm:w-auto min-h-[44px]"
            onClick={handleStartNextTest}
            disabled={loading}
          >
            {loading ? "Finding test…" : "Start Next Test"}
          </Button>
          {noTests && (
            <p className="text-sm text-muted-foreground">
              No tests available right now. Check back later!
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">{balance}</CardTitle>
            <CardDescription>Points earned</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" disabled className="min-h-[44px]">
              Withdraw — Coming Soon
            </Button>
          </CardContent>
        </Card>

        {user?.evaluatorProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your profile</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>{user.email}</p>
              <p>
                {user.evaluatorProfile.gender} · {user.evaluatorProfile.country}
                {user.evaluatorProfile.city ? ` · ${user.evaluatorProfile.city}` : ""}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
