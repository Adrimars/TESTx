"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@testx/ui";
import type { TestStatus } from "@testx/shared";
import { apiFetch } from "@/lib/api";
import type { AdminTestDetail, AdminTestListItem, Paginated, TemplateItem } from "@/lib/admin-types";

const STATUSES: Array<"ALL" | TestStatus> = ["ALL", "DRAFT", "ACTIVE", "PAUSED", "CLOSED"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function TestsPage() {
  const router = useRouter();
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const [tests, setTests] = useState<AdminTestListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [status, setStatus] = useState<"ALL" | TestStatus>("ALL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  async function openCreateDialog() {
    setTitle("");
    setDescription("");
    setError("");
    createDialogRef.current?.showModal();
    try {
      const data = await apiFetch<{ items: TemplateItem[] }>("/admin/templates");
      setTemplates(data.items);
    } catch {
      setTemplates([]);
    }
  }

  async function createBlank() {
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const test = await apiFetch<AdminTestDetail>("/admin/tests", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      createDialogRef.current?.close();
      router.push(`/tests/${test.id}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setCreating(false);
    }
  }

  async function createFromTemplate(templateId: string) {
    setCreating(true);
    setError("");
    try {
      const test = await apiFetch<AdminTestDetail>(`/admin/tests/from-template/${templateId}`, { method: "POST" });
      createDialogRef.current?.close();
      router.push(`/tests/${test.id}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create test from template");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tests</h1>
          <p className="text-muted-foreground">Create and manage evaluation tests.</p>
        </div>
        <Button onClick={openCreateDialog}>Create Test</Button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted p-1">
        {STATUSES.map((item) => (
          <button
            key={item}
            onClick={() => setStatus(item)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              status === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item === "ALL" ? "All" : item.charAt(0) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>All tests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
                    <TableCell className="font-medium">{test.title}</TableCell>
                    <TableCell><Badge>{test.status}</Badge></TableCell>
                    <TableCell>{test.questionCount}</TableCell>
                    <TableCell>{test.responseCount}</TableCell>
                    <TableCell>{formatDate(test.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link className="text-sm font-medium underline" href={`/tests/${test.id}/edit`}>
                          Edit
                        </Link>
                        <Link className="text-sm font-medium underline" href={`/tests/${test.id}/preview`}>
                          Preview
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog ref={createDialogRef} className="w-full max-w-3xl">
        <div className="space-y-5 p-6">
          <CardHeader className="p-0">
            <CardTitle>Create test</CardTitle>
          </CardHeader>

          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Input placeholder="Test title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => createDialogRef.current?.close()} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createBlank} disabled={!title.trim() || creating}>
              Create Blank
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="mb-3 text-sm font-semibold">Start from template</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => createFromTemplate(template.id)}
                  disabled={creating}
                  className="rounded-lg border border-border p-4 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <span className="block font-medium">{template.name}</span>
                  <span className="mt-1 block text-muted-foreground">{template.description}</span>
                </button>
              ))}
              {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates loaded.</p>}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
