"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, ChevronLeft, ChevronRight, Eye, Pencil, Play, Plus, Square, PauseCircle } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  ConfirmDialog,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@testx/ui";
import type { TestStatus } from "@testx/shared";
import { apiFetch } from "@/lib/api";
import { formatDate, statusVariant } from "@/lib/status";
import type { AdminTestListItem, Paginated } from "@/lib/admin-types";

const STATUSES: Array<"ALL" | TestStatus> = ["ALL", "DRAFT", "ACTIVE", "PAUSED", "CLOSED"];
const PAGE_SIZE = 50;

export default function TestsPage() {
  const closeTestDialogRef = useRef<HTMLDialogElement>(null);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [status, setStatus] = useState<"ALL" | TestStatus>("ALL");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    error,
  } = useQuery({
    queryKey: ["admin", "tests", status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status !== "ALL") params.set("status", status);
      return apiFetch<Paginated<AdminTestListItem>>(`/admin/tests?${params}`);
    },
    placeholderData: keepPreviousData,
  });
  const tests = data?.items ?? [];
  const total = data?.total ?? 0;

  // A status change can leave `page` pointing past the new filter's last page — reset
  // to page 1 rather than showing an empty table until the user notices and goes back.
  useEffect(() => {
    setPage(1);
  }, [status]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeStatusMutation = useMutation({
    mutationFn: ({ testId, newStatus }: { testId: string; newStatus: TestStatus }) =>
      apiFetch(`/admin/tests/${testId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tests"] });
    },
  });

  function changeStatus(testId: string, newStatus: TestStatus) {
    changeStatusMutation.mutate({ testId, newStatus });
  }

  const displayError = error ?? changeStatusMutation.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests"
        description="Create and manage evaluation tests."
        actions={
          <Link href="/tests/new">
            <Button>
              <Plus className="size-4" aria-hidden />
              Create Test
            </Button>
          </Link>
        }
      />

      <div className="flex w-fit gap-1 rounded-lg border border-border bg-muted p-1">
        {STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            aria-pressed={status === item}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              status === item
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item === "ALL" ? "All" : item.charAt(0) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {displayError && (
        <Alert>{displayError instanceof Error ? displayError.message : "Failed to load tests"}</Alert>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">Loading tests...</TableCell>
                </TableRow>
              ) : tests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">No tests found.</TableCell>
                </TableRow>
              ) : (
                tests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium text-foreground">{test.title}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(test.status)}>{test.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{test.questionCount}</TableCell>
                    <TableCell className="tabular-nums">{test.responseCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(test.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Link href={`/tests/${test.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="size-3.5" aria-hidden />
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/tests/${test.id}/preview`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="size-3.5" aria-hidden />
                            Preview
                          </Button>
                        </Link>
                        {(test.status === "ACTIVE" || test.status === "CLOSED") && (
                          <Link href={`/tests/${test.id}/report`}>
                            <Button variant="ghost" size="sm">
                              <BarChart3 className="size-3.5" aria-hidden />
                              Report
                            </Button>
                          </Link>
                        )}

                        {(test.status === "ACTIVE" || test.status === "PAUSED") && (
                          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                        )}

                        {test.status === "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-warning hover:bg-warning/10 hover:text-warning"
                            onClick={() => changeStatus(test.id, "PAUSED")}
                          >
                            <PauseCircle className="size-3.5" aria-hidden />
                            Deactivate
                          </Button>
                        )}
                        {test.status === "PAUSED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-success hover:bg-success/10 hover:text-success"
                            onClick={() => changeStatus(test.id, "ACTIVE")}
                          >
                            <Play className="size-3.5" aria-hidden />
                            Reactivate
                          </Button>
                        )}
                        {(test.status === "ACTIVE" || test.status === "PAUSED") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              setPendingCloseId(test.id);
                              closeTestDialogRef.current?.showModal();
                            }}
                          >
                            <Square className="size-3.5" aria-hidden />
                            Close
                          </Button>
                        )}
                      </div>
                    </TableCell>
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

      <ConfirmDialog
        ref={closeTestDialogRef}
        title="Close Test"
        description="Are you sure you want to close the test? The test cannot be reopened once closed."
        confirmLabel="Close Test"
        tone="danger"
        onCancel={() => setPendingCloseId(null)}
        onConfirm={() => {
          closeTestDialogRef.current?.close();
          if (pendingCloseId) void changeStatus(pendingCloseId, "CLOSED");
          setPendingCloseId(null);
        }}
      />
    </div>
  );
}
