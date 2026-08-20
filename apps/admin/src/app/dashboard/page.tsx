"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { statusVariant } from "@/lib/status";
import type { DashboardStats } from "@/lib/admin-types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStats(await apiFetch<DashboardStats>("/admin/dashboard"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const cards = [
    { label: "Total Evaluators", value: stats?.totalEvaluators, tone: "default" as const },
    { label: "Active Tests", value: stats?.activeTests, tone: "default" as const },
    { label: "Total Responses", value: stats?.totalResponses, tone: "default" as const },
    { label: "Flagged Responses", value: stats?.flaggedResponses, tone: "danger" as const },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Platform overview at a glance." />

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={loading ? "—" : card.value ?? 0}
            tone={card.tone}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Recent tests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : !stats || stats.recentTests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">No tests yet.</TableCell>
                </TableRow>
              ) : (
                stats.recentTests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">
                      <Link
                        className="text-primary underline underline-offset-4"
                        href={`/tests/${test.id}/results`}
                      >
                        {test.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(test.status)}>{test.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{test.responseCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(test.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
