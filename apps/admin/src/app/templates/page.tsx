"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input, Select } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import type { AdminTestDetail, TemplateItem } from "@/lib/admin-types";

type DraftQuestion = {
  type: "SINGLE_SELECT" | "MULTI_SELECT" | "RATING";
  prompt: string;
  options: string[];
  minSelections: string;
  maxSelections: string;
  ratingMin: string;
  ratingMax: string;
  minLabel: string;
  maxLabel: string;
};

const EMPTY_QUESTION: DraftQuestion = {
  type: "SINGLE_SELECT",
  prompt: "",
  options: ["", ""],
  minSelections: "",
  maxSelections: "",
  ratingMin: "1",
  ratingMax: "5",
  minLabel: "",
  maxLabel: "",
};

function fromStructure(structure: unknown): DraftQuestion[] {
  if (!structure || typeof structure !== "object" || Array.isArray(structure)) return [];
  const questions = (structure as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return [];
  return questions.map((q: unknown) => {
    const obj = q as Record<string, unknown>;
    const cfg = (obj.config ?? {}) as Record<string, unknown>;
    const rawOpts = Array.isArray(obj.options) ? (obj.options as unknown[]) : [];
    const opts = rawOpts.map((o) =>
      typeof o === "string" ? o : ((o as Record<string, unknown>).label as string) ?? ""
    );
    return {
      type: (obj.type as DraftQuestion["type"]) ?? "SINGLE_SELECT",
      prompt: (obj.prompt as string) ?? "",
      options: opts.length >= 2 ? opts : [...opts, ...Array(2 - opts.length).fill("")],
      minSelections: String(cfg.minSelections ?? ""),
      maxSelections: String(cfg.maxSelections ?? ""),
      ratingMin: String(cfg.min ?? "1"),
      ratingMax: String(cfg.max ?? "5"),
      minLabel: String(cfg.minLabel ?? ""),
      maxLabel: String(cfg.maxLabel ?? ""),
    };
  });
}

function toStructure(questions: DraftQuestion[]) {
  return {
    questions: questions.map((q) => {
      if (q.type === "RATING") {
        return {
          type: q.type,
          prompt: q.prompt,
          mediaType: "TEXT",
          config: {
            min: q.ratingMin ? Number(q.ratingMin) : 1,
            max: q.ratingMax ? Number(q.ratingMax) : 5,
            ...(q.minLabel && { minLabel: q.minLabel }),
            ...(q.maxLabel && { maxLabel: q.maxLabel }),
          },
          options: [],
        };
      }
      return {
        type: q.type,
        prompt: q.prompt,
        mediaType: "TEXT",
        config: q.type === "MULTI_SELECT" ? {
          ...(q.minSelections && { minSelections: Number(q.minSelections) }),
          ...(q.maxSelections && { maxSelections: Number(q.maxSelections) }),
        } : {},
        options: q.options.filter((o) => o.trim()),
      };
    }),
  };
}

export default function TemplatesPage() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formQuestions, setFormQuestions] = useState<DraftQuestion[]>([{ ...EMPTY_QUESTION }]);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ items: TemplateItem[] }>("/admin/templates");
      setTemplates(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  async function createFromTemplate(templateId: string) {
    setCreatingId(templateId);
    setError("");
    try {
      const test = await apiFetch<AdminTestDetail>(`/admin/tests/from-template/${templateId}`, { method: "POST" });
      router.push(`/tests/${test.id}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setCreatingId(null);
    }
  }

  async function deleteTemplate(templateId: string) {
    setDeletingId(templateId);
    setError("");
    try {
      await apiFetch(`/admin/templates/${templateId}`, { method: "DELETE" });
      await loadTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  }

  function openAdd() {
    setFormMode("add");
    setEditingId(null);
    setFormName("");
    setFormDesc("");
    setFormQuestions([{ ...EMPTY_QUESTION }]);
    setFormError("");
    dialogRef.current?.showModal();
  }

  function openEdit(template: TemplateItem) {
    setFormMode("edit");
    setEditingId(template.id);
    setFormName(template.name);
    setFormDesc(template.description ?? "");
    const parsed = fromStructure(template.structure);
    setFormQuestions(parsed.length > 0 ? parsed : [{ ...EMPTY_QUESTION }]);
    setFormError("");
    dialogRef.current?.showModal();
  }

  async function saveForm() {
    if (!formName.trim()) { setFormError("Template name is required."); return; }
    setFormSaving(true);
    setFormError("");
    try {
      const body = {
        name: formName.trim(),
        description: formDesc.trim() || null,
        structure: toStructure(formQuestions),
      };
      if (formMode === "add") {
        await apiFetch<TemplateItem>("/admin/templates", { method: "POST", body: JSON.stringify(body) });
      } else {
        await apiFetch<TemplateItem>(`/admin/templates/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
      }
      dialogRef.current?.close();
      await loadTemplates();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setFormSaving(false);
    }
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setFormQuestions((prev) => prev.map((q, i) => i === index ? { ...q, ...patch } : q));
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setFormQuestions((prev) => prev.map((q, i) => {
      if (i !== qIndex) return q;
      const options = [...q.options];
      options[oIndex] = value;
      return { ...q, options };
    }));
  }

  function addOption(qIndex: number) {
    setFormQuestions((prev) => prev.map((q, i) => i === qIndex ? { ...q, options: [...q.options, ""] } : q));
  }

  function removeOption(qIndex: number, oIndex: number) {
    setFormQuestions((prev) => prev.map((q, i) => {
      if (i !== qIndex) return q;
      return { ...q, options: q.options.filter((_, oi) => oi !== oIndex) };
    }));
  }

  function removeQuestion(index: number) {
    setFormQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">Seeded starting points for common evaluation patterns.</p>
        </div>
        <Button onClick={openAdd}>Add Template</Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading templates...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates found.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{template.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => createFromTemplate(template.id)} disabled={creatingId === template.id}>
                    {creatingId === template.id ? "Creating..." : "Use Template"}
                  </Button>
                  <Button variant="secondary" onClick={() => openEdit(template)}>
                    Edit Template
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => deleteTemplate(template.id)}
                    disabled={deletingId === template.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {deletingId === template.id ? "Deleting..." : "Delete Template"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog ref={dialogRef} className="w-full max-w-3xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">
            {formMode === "add" ? "Add Template" : "Edit Template"}
          </h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => dialogRef.current?.close()} disabled={formSaving}>
              Cancel
            </Button>
            <Button onClick={saveForm} disabled={formSaving}>
              {formSaving ? "Saving..." : formMode === "add" ? "Save Template" : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="space-y-6 p-6 max-h-[75vh] overflow-y-auto">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Template name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>

          {formQuestions.map((q, qi) => (
            <div key={qi} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Question {qi + 1}</span>
                <button
                  type="button"
                  onClick={() => removeQuestion(qi)}
                  disabled={formQuestions.length === 1}
                  className="text-sm text-destructive hover:underline disabled:opacity-30"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Question prompt"
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                />
                <Select
                  aria-label="Question type"
                  value={q.type}
                  onChange={(e) => updateQuestion(qi, { type: e.target.value as DraftQuestion["type"] })}
                >
                  <option value="SINGLE_SELECT">Single Select</option>
                  <option value="MULTI_SELECT">Multi Select</option>
                  <option value="RATING">Rating</option>
                </Select>
              </div>

              {q.type === "RATING" && (
                <div className="grid gap-3 sm:grid-cols-4">
                  <Input placeholder="Min (e.g. 1)" value={q.ratingMin} onChange={(e) => updateQuestion(qi, { ratingMin: e.target.value })} />
                  <Input placeholder="Max (e.g. 5)" value={q.ratingMax} onChange={(e) => updateQuestion(qi, { ratingMax: e.target.value })} />
                  <Input placeholder="Min label" value={q.minLabel} onChange={(e) => updateQuestion(qi, { minLabel: e.target.value })} />
                  <Input placeholder="Max label" value={q.maxLabel} onChange={(e) => updateQuestion(qi, { maxLabel: e.target.value })} />
                </div>
              )}

              {q.type === "MULTI_SELECT" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Min selections" value={q.minSelections} onChange={(e) => updateQuestion(qi, { minSelections: e.target.value })} />
                  <Input placeholder="Max selections" value={q.maxSelections} onChange={(e) => updateQuestion(qi, { maxSelections: e.target.value })} />
                </div>
              )}

              {q.type !== "RATING" && (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex gap-2">
                      <Input
                        placeholder={`Option ${oi + 1}`}
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(qi, oi)}
                          className="text-sm text-destructive hover:underline whitespace-nowrap"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(qi)}
                    className="text-sm text-primary hover:underline"
                  >
                    + Add option
                  </button>
                </div>
              )}
            </div>
          ))}

          <Button variant="secondary" onClick={() => setFormQuestions((prev) => [...prev, { ...EMPTY_QUESTION }])}>
            Add Question
          </Button>

          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
      </Dialog>
    </div>
  );
}
