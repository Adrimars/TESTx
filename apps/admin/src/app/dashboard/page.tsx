"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
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
    { label: "Total Evaluators", value: stats?.totalEvaluators },
    { label: "Active Tests", value: stats?.activeTests },
    { label: "Total Responses", value: stats?.totalResponses },
    { label: "Flagged Responses", value: stats?.flaggedResponses },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Platform overview at a glance.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-3xl">{loading ? "—" : card.value ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent tests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
                      <Link className="underline" href={`/tests/${test.id}/results`}>
                        {test.title}
                      </Link>
                    </TableCell>
                    <TableCell><Badge>{test.status}</Badge></TableCell>
                    <TableCell>{test.responseCount}</TableCell>
                    <TableCell>{formatDate(test.createdAt)}</TableCell>
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
