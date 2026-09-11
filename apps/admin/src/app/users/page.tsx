"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardFooter,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/status";
import type { EvaluatorListItem, Paginated } from "@/lib/admin-types";

const PAGE_SIZE = 25;

export default function UsersPage() {
  const [page, setPage] = useState(1);

  const { data, isPending: loading, error } = useQuery({
    queryKey: ["admin", "users", page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      return apiFetch<Paginated<EvaluatorListItem>>(`/admin/users?${params}`);
    },
    // Keeps the current page's rows on screen while the next page loads, instead of
    // flashing back to a "Loading…" table on every Previous/Next click.
    placeholderData: keepPreviousData,
  });

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evaluators"
        description={`${total} registered evaluator${total === 1 ? "" : "s"}.`}
      />

      {error && <Alert>{error instanceof Error ? error.message : "Failed to load users"}</Alert>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Tests Completed</TableHead>
                <TableHead>Total Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">No evaluators yet.</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">{user.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(user.registeredAt)}
                    </TableCell>
                    <TableCell className="tabular-nums">{user.testsCompleted}</TableCell>
                    <TableCell className="tabular-nums">{user.totalPoints}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        <CardFooter className="justify-between">
          <p className="text-sm tabular-nums text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
