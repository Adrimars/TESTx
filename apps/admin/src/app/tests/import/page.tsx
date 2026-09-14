"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileJson, Download, AlertCircle, ChevronRight, ArrowLeft } from "lucide-react";
import { Alert, Button, PageHeader } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import type { AdminTestDetail, ImportTest, ImportTestQuestion } from "@/lib/admin-types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type ValidationError = string;

function validateImport(
  data: unknown,
): { valid: true; test: ImportTest } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Root must be a JSON object."] };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.title || typeof obj.title !== "string" || obj.title.trim() === "") {
    errors.push('"title" is required and must be a non-empty string.');
  }
  if (obj.description !== undefined && typeof obj.description !== "string") {
    errors.push('"description" must be a string.');
  }
  if (obj.responseCap !== undefined && (typeof obj.responseCap !== "number" || obj.responseCap < 1)) {
    errors.push('"responseCap" must be a positive number.');
  }
  if (obj.advisoryTimeMin !== undefined && (typeof obj.advisoryTimeMin !== "number" || obj.advisoryTimeMin < 1)) {
    errors.push('"advisoryTimeMin" must be a positive number.');
  }
  if (obj.minTimePerQuestion !== undefined && (typeof obj.minTimePerQuestion !== "number" || obj.minTimePerQuestion < 0)) {
    errors.push('"minTimePerQuestion" must be a non-negative number.');
  }
  if (obj.rewardPoints !== undefined && (typeof obj.rewardPoints !== "number" || obj.rewardPoints < 0)) {
    errors.push('"rewardPoints" must be a non-negative number.');
  }

  if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
    errors.push('"questions" must be a non-empty array.');
    return { valid: false, errors };
  }

  const QUESTION_TYPES = ["SINGLE_SELECT", "MULTI_SELECT", "RATING", "ORDERING"] as const;
  const MEDIA_TYPES = ["TEXT", "IMAGE", "VIDEO", "AUDIO"] as const;

  (obj.questions as unknown[]).forEach((q, i) => {
    const prefix = `questions[${i}]`;
    if (!q || typeof q !== "object" || Array.isArray(q)) {
      errors.push(`${prefix}: must be an object.`);
      return;
    }
    const question = q as Record<string, unknown>;
    if (!QUESTION_TYPES.includes(question.type as (typeof QUESTION_TYPES)[number])) {
      errors.push(`${prefix}.type: must be one of ${QUESTION_TYPES.join(", ")}.`);
    }
    if (!question.prompt || typeof question.prompt !== "string" || (question.prompt as string).trim() === "") {
      errors.push(`${prefix}.prompt: required non-empty string.`);
    }
    if (question.mediaType !== undefined && !MEDIA_TYPES.includes(question.mediaType as (typeof MEDIA_TYPES)[number])) {
      errors.push(`${prefix}.mediaType: must be one of ${MEDIA_TYPES.join(", ")}.`);
    }
    const type = question.type as string;
    if (type === "SINGLE_SELECT" || type === "MULTI_SELECT" || type === "ORDERING") {
      const opts = question.options;
      if (!Array.isArray(opts) || opts.length < 2) {
        errors.push(`${prefix}.options: ${type} requires at least 2 options.`);
      }
    }
  });

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, test: obj as ImportTest };
}

// ---------------------------------------------------------------------------
// Example JSON
// ---------------------------------------------------------------------------

const EXAMPLE_JSON: ImportTest = {
  title: "My Test",
  description: "An example evaluation test.",
  responseCap: 100,
  advisoryTimeMin: 30,
  minTimePerQuestion: 5,
  rewardPoints: 50,
  demographicFilters: {
    ageMin: 18,
    ageMax: 65,
    genders: ["MALE", "FEMALE"],
    countries: ["TR", "US"],
  },
  questions: [
    {
      type: "SINGLE_SELECT",
      prompt: "Which image do you prefer?",
      mediaType: "TEXT",
      order: 1,
      options: [
        { label: "Option A", order: 1 },
        { label: "Option B", order: 2 },
      ],
    },
    {
      type: "RATING",
      prompt: "Rate the quality of this image.",
      mediaType: "TEXT",
      order: 2,
      config: {
        minValue: 1,
        maxValue: 5,
        minLabel: "Poor",
        maxLabel: "Excellent",
      },
    },
    {
      type: "ORDERING",
      prompt: "Rank these options from best to worst.",
      mediaType: "TEXT",
      order: 3,
      config: { topLabel: "Best", bottomLabel: "Worst" },
      options: [
        { label: "Option A", order: 1 },
        { label: "Option B", order: 2 },
        { label: "Option C", order: 3 },
      ],
    },
    {
      type: "MULTI_SELECT",
      prompt: "Which of these apply to you?",
      mediaType: "TEXT",
      order: 4,
      config: { minSelections: 1, maxSelections: 3 },
      options: [
        { label: "Choice 1", order: 1 },
        { label: "Choice 2", order: 2 },
        { label: "Choice 3", order: 3 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function runImport(test: ImportTest): Promise<string> {
  const created = await apiFetch<AdminTestDetail>("/admin/tests", {
    method: "POST",
    body: JSON.stringify({ title: test.title }),
  });
  const testId = created.id;

  await apiFetch(`/admin/tests/${testId}`, {
    method: "PUT",
    body: JSON.stringify({
      title: test.title,
      description: test.description ?? null,
      responseCap: test.responseCap ?? null,
      advisoryTimeMin: test.advisoryTimeMin ?? null,
      minTimePerQuestion: test.minTimePerQuestion ?? 10,
      rewardPoints: test.rewardPoints ?? 0,
      demographicFilters: test.demographicFilters ?? null,
    }),
  });

  const ordered = [...test.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const q of ordered) {
    await apiFetch(`/admin/tests/${testId}/questions`, {
      method: "POST",
      body: JSON.stringify({
        type: q.type,
        prompt: q.prompt,
        mediaType: q.mediaType ?? "TEXT",
        mediaId: q.mediaId ?? null,
        isAttentionCheck: q.isAttentionCheck ?? false,
        isTrapDuplicate: q.isTrapDuplicate ?? false,
        config: q.config ?? {},
        options: (q.options ?? []).map((o, idx) => ({
          label: o.label ?? null,
          mediaId: o.mediaId ?? null,
          order: o.order ?? idx + 1,
        })),
      }),
    });
  }

  return testId;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type ParsedState =
  | { status: "idle" }
  | { status: "error"; errors: string[] }
  | { status: "ready"; test: ImportTest };

type Step = 1 | 2;

export default function ImportTestPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [dragging, setDragging] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [parsed, setParsed] = useState<ParsedState>({ status: "idle" });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // Load JSON from a media library item if mediaId query param is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mediaId = params.get("mediaId");
    if (!mediaId) return;
    void (async () => {
      try {
        const media = await apiFetch<{ textContent?: string | null }>(
          `/admin/media/${mediaId}`
        );
        if (media.textContent) {
          setRawJson(media.textContent);
          parseRaw(media.textContent);
        }
      } catch {
        // ignore — user can still paste manually
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parseRaw(text: string) {
    if (!text.trim()) { setParsed({ status: "idle" }); return; }
    let data: unknown;
    try { data = JSON.parse(text); }
    catch { setParsed({ status: "error", errors: ["Invalid JSON — check for syntax errors."] }); return; }
    const result = validateImport(data);
    setParsed(result.valid ? { status: "ready", test: result.test } : { status: "error", errors: result.errors });
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setRawJson(e.target.value);
    parseRaw(e.target.value);
  }

  async function loadFile(file: File) {
    const text = await file.text();
    setRawJson(text);
    parseRaw(text);
  }

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void loadFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".json")) void loadFile(file);
  }, []);

  function downloadExample() {
    const blob = new Blob([JSON.stringify(EXAMPLE_JSON, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "test-import-example.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (parsed.status !== "ready") return;
    setImporting(true);
    setImportError("");
    try {
      const testId = await runImport(parsed.test);
      router.push(`/tests/${testId}/edit`);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
      setImporting(false);
    }
  }

  const isReady = parsed.status === "ready";

  // ── Step 1 ────────────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Link href="/tests" className="text-sm text-muted-foreground underline underline-offset-4">
            ← Back to tests
          </Link>
          <PageHeader
            title="Import test from JSON"
            description="Upload or paste a JSON file to create a test with all its questions in one step."
            actions={
              <Button variant="secondary" onClick={downloadExample}>
                <Download className="size-4" aria-hidden />
                Download example
              </Button>
            }
          />
        </div>

        {/* Step indicator */}
        <StepIndicator current={1} />

        {/* Upload zone */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 text-sm transition-colors ${
            dragging
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          <Upload className="size-8" aria-hidden />
          <span className="font-medium">Drop a JSON file here, or click to browse</span>
          <span className="text-xs">.json files only</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileInput}
        />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>or paste JSON below</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <textarea
          value={rawJson}
          onChange={handleTextChange}
          placeholder={`{\n  "title": "My Test",\n  "questions": [...]\n}`}
          rows={16}
          spellCheck={false}
          className="w-full rounded-lg border border-border bg-muted p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
        />

        {/* Errors */}
        {parsed.status === "error" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-1.5">
            <p className="flex items-center gap-2 font-medium text-destructive text-sm">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              Fix these errors before continuing
            </p>
            <ul className="list-disc list-inside text-sm text-destructive/80 space-y-0.5 pl-1">
              {parsed.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Next button */}
        <div className="flex justify-end">
          <Button
            onClick={() => setStep(2)}
            disabled={!isReady}
          >
            Next: Preview
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────

  const test = parsed.status === "ready" ? parsed.test : null;
  if (!test) { setStep(1); return null; }

  const ordered = [...test.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { setStep(1); setImportError(""); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to editor
          </button>
          <h1 className="text-2xl font-bold text-foreground">Preview</h1>
          <p className="text-sm text-muted-foreground">Review your test before importing it.</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Button onClick={handleImport} disabled={importing} className="min-w-36">
            {importing ? "Importing…" : "Import test"}
          </Button>
          {importError && (
            <p className="text-xs text-destructive max-w-xs text-right">{importError}</p>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={2} />

      {/* Test summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Questions" value={test.questions.length} />
        {test.responseCap != null && <SummaryCard label="Response cap" value={test.responseCap} />}
        {test.advisoryTimeMin != null && <SummaryCard label="Advisory time" value={`${test.advisoryTimeMin} min`} />}
        {test.rewardPoints != null && <SummaryCard label="Reward points" value={test.rewardPoints} />}
      </div>

      {/* Test info */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-1">
        <div className="flex items-center gap-2">
          <FileJson className="size-4 text-primary shrink-0" aria-hidden />
          <h2 className="font-semibold text-lg text-foreground">{test.title}</h2>
        </div>
        {test.description && (
          <p className="text-sm text-muted-foreground pl-6">{test.description}</p>
        )}
        {test.demographicFilters && (
          <p className="text-xs text-muted-foreground pl-6">
            Filters: ages {test.demographicFilters.ageMin ?? "?"} – {test.demographicFilters.ageMax ?? "?"}
            {test.demographicFilters.countries?.length
              ? ` · ${test.demographicFilters.countries.join(", ")}`
              : ""}
            {test.demographicFilters.genders?.length
              ? ` · ${test.demographicFilters.genders.join(", ")}`
              : ""}
          </p>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Questions ({ordered.length})
        </h3>
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {ordered.map((q, i) => (
            <QuestionPreviewRow key={i} index={i + 1} question={q} />
          ))}
        </div>
      </div>

      {/* Bottom import */}
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button
          variant="secondary"
          onClick={() => { setStep(1); setImportError(""); }}
          disabled={importing}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        <Button onClick={handleImport} disabled={importing} className="min-w-36">
          {importing ? "Importing…" : "Import test"}
        </Button>
      </div>
      {importError && <Alert>{importError}</Alert>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`flex items-center gap-1.5 ${current === 1 ? "text-foreground" : "text-muted-foreground"}`}>
        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
          current === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          {current > 1 ? "✓" : "1"}
        </span>
        <span className={current === 1 ? "font-medium" : ""}>Upload JSON</span>
      </div>
      <div className="h-px w-8 bg-border" />
      <div className={`flex items-center gap-1.5 ${current === 2 ? "text-foreground" : "text-muted-foreground"}`}>
        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
          current === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          2
        </span>
        <span className={current === 2 ? "font-medium" : ""}>Preview & Import</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  SINGLE_SELECT: "bg-blue-500/10 text-blue-600",
  MULTI_SELECT:  "bg-violet-500/10 text-violet-600",
  RATING:        "bg-amber-500/10 text-amber-600",
  ORDERING:      "bg-emerald-500/10 text-emerald-600",
};

const TYPE_LABELS: Record<string, string> = {
  SINGLE_SELECT: "Single select",
  MULTI_SELECT:  "Multi select",
  RATING:        "Rating",
  ORDERING:      "Ordering",
};

function QuestionPreviewRow({ index, question }: { index: number; question: ImportTestQuestion }) {
  const [open, setOpen] = useState(false);
  const hasOptions = (question.options?.length ?? 0) > 0;
  const hasConfig = question.config && Object.keys(question.config).length > 0;
  const expandable = hasOptions || hasConfig;

  return (
    <div>
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors ${
          expandable ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
        }`}
      >
        <span className="mt-0.5 shrink-0 w-6 text-center text-xs font-mono text-muted-foreground">
          {index}
        </span>
        <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[question.type] ?? "bg-muted text-muted-foreground"}`}>
          {TYPE_LABELS[question.type] ?? question.type}
        </span>
        <span className="flex-1 text-sm text-foreground leading-snug">{question.prompt}</span>
        {expandable && (
          <ChevronRight className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
        )}
      </button>

      {open && expandable && (
        <div className="px-5 pb-4 pl-14 space-y-2">
          {hasOptions && (
            <div className="flex flex-wrap gap-1.5">
              {question.options!.map((o, i) => (
                <span key={i} className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                  {o.label ?? `Option ${i + 1}`}
                </span>
              ))}
            </div>
          )}
          {hasConfig && question.config && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(question.config).map(([k, v]) => (
                <span key={k}>
                  <span className="font-mono text-foreground">{k}</span>: {String(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
