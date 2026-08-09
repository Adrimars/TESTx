"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@testx/ui";
import { apiFetch } from "@/lib/api";

type EvaluatorUser = {
  id: string;
  email: string;
  createdAt: string;
  testsCompleted: number;
  totalPoints: number;
};

type UsersResponse = {
  items: EvaluatorUser[];
  total: number;
  page: number;
  limit: number;
};

export default function UsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<UsersResponse>(`/admin/users?page=${page}&limit=50`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = data ? Math.ceil(data.total / (data.limit || 50)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evaluators</h1>
        <p className="text-muted-foreground">{data ? `${data.total} registered evaluators` : ""}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User list</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.items.length ? (
            <p className="text-sm text-muted-foreground">No evaluators yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Registered</th>
                    <th className="pb-2 pr-4 font-medium text-right">Tests Completed</th>
                    <th className="pb-2 font-medium text-right">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((user) => (
                    <tr key={user.id}>
                      <td className="py-3 pr-4">{user.email}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-right">{user.testsCompleted}</td>
                      <td className="py-3 text-right font-medium">{user.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
