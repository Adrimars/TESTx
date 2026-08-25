"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Eye, Pencil, Play, Plus, Square, PauseCircle } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
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

export default function TestsPage() {
  const closeTestDialogRef = useRef<HTMLDialogElement>(null);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [tests, setTests] = useState<AdminTestListItem[]>([]);
  const [status, setStatus] = useState<"ALL" | TestStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (status !== "ALL") params.set("status", status);
      const data = await apiFetch<Paginated<AdminTestListItem>>(`/admin/tests?${params}`);
      setTests(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tests");
      setTests([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void fetchTests();
  }, [fetchTests]);

  async function changeStatus(testId: string, newStatus: TestStatus) {
    try {
      await apiFetch(`/admin/tests/${testId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      void fetchTests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update test status");
    }
  }

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

      {error && <Alert>{error}</Alert>}

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
