"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@testx/ui";
import { apiFetch } from "@/lib/api";

type DashboardData = {
  totalEvaluators: number;
  activeTests: number;
  totalResponses: number;
  flaggedResponses: number;
  recentTests: {
    id: string;
    title: string;
    status: string;
    responseCount: number;
    createdAt: string;
  }[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CLOSED: "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardData>("/admin/dashboard")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const stats = data
    ? [
        { label: "Total Evaluators", value: data.totalEvaluators },
        { label: "Active Tests", value: data.activeTests },
        { label: "Total Responses", value: data.totalResponses },
        { label: "Flagged Responses", value: data.flaggedResponses },
      ]
    : [
        { label: "Total Evaluators", value: "—" },
        { label: "Active Tests", value: "—" },
        { label: "Total Responses", value: "—" },
        { label: "Flagged Responses", value: "—" },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of the TESTx platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className={loading ? "text-muted-foreground" : ""}>
                {loading ? "…" : String(stat.value)}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent tests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.recentTests.length ? (
            <p className="text-sm text-muted-foreground">No tests yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {data.recentTests.map((test) => (
                <button
                  key={test.id}
                  type="button"
                  onClick={() => router.push(`/tests/${test.id}/results`)}
                  className="w-full flex items-center justify-between py-3 text-left hover:bg-muted/40 px-2 rounded transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{test.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {test.responseCount} responses · {new Date(test.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[test.status] ?? ""}`}
                  >
                    {test.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
