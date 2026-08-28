"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FilePlus2, LayoutTemplate } from "lucide-react";
import { Alert, Button, PageHeader } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { UNTITLED_TEST } from "@/lib/status";
import type { AdminTestDetail, TemplateItem } from "@/lib/admin-types";

/** Templates carry their questions in a free-form JSON structure; count them defensively. */
function templateQuestionCount(structure: unknown): number {
  if (!structure || typeof structure !== "object" || Array.isArray(structure)) return 0;
  const questions = (structure as { questions?: unknown }).questions;
  return Array.isArray(questions) ? questions.length : 0;
}

/**
 * Choosing a starting point is all this page does: one click creates the draft and opens the
 * editor. Title, description and the rest are the editor's fields — asking for them here first
 * would only make you fill in the same form twice.
 */
export default function NewTestPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: TemplateItem[] }>("/admin/templates");
      setTemplates(data.items);
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  async function create(sourceId: string) {
    if (pendingId) return;
    setPendingId(sourceId);
    setError("");
    try {
      const test =
        sourceId === "blank"
          ? await apiFetch<AdminTestDetail>("/admin/tests", {
              method: "POST",
              body: JSON.stringify({ title: UNTITLED_TEST }),
            })
          : await apiFetch<AdminTestDetail>(`/admin/tests/from-template/${sourceId}`, {
              method: "POST",
            });
      router.push(`/tests/${test.id}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create test");
      setPendingId(null);
    }
  }

  const sources = [
    {
      id: "blank",
      name: "Blank test",
      description: "Start with no questions and build the test yourself.",
      questionCount: null as number | null,
      icon: FilePlus2,
    },
    ...templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description ?? "Template",
      questionCount: templateQuestionCount(template.structure),
      icon: LayoutTemplate,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/tests" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back to tests
        </Link>
        <PageHeader
          title="Create test"
          description="Pick a starting point — the editor opens straight away, where you name it and add questions."
          actions={
            <Link href="/tests">
              <Button variant="secondary">Cancel</Button>
            </Link>
          }
        />
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => {
          const Icon = source.icon;
          const pending = pendingId === source.id;
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => create(source.id)}
              disabled={pendingId !== null}
              className="rounded-lg border border-border bg-card p-5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
            >
              <span className="flex items-center gap-2 font-medium text-foreground">
                <Icon className="size-4 shrink-0" aria-hidden />
                {source.name}
              </span>
              <span className="mt-1 block text-muted-foreground">{source.description}</span>
              <span className="mt-3 block text-meta uppercase text-muted-foreground">
                {pending
                  ? "Opening editor…"
                  : source.questionCount !== null
                    ? `${source.questionCount} question${source.questionCount === 1 ? "" : "s"}`
                    : "Empty"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
