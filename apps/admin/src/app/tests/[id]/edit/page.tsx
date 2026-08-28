"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Eye,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  PauseCircle,
} from "lucide-react";
import type { Gender, MediaType, QuestionType, TestStatus } from "@testx/shared";
import { COUNTRIES, CITIES_BY_COUNTRY, RANKING_MAX_OPTIONS, RANKING_MIN_OPTIONS } from "@testx/shared";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  MultiCombobox,
  Select,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { statusVariant } from "@/lib/status";
import type { AdminMedia, AdminQuestion, AdminTestDetail, Paginated } from "@/lib/admin-types";

type OptionDraft = { label: string; mediaId: string };
type QuestionDraft = {
  id?: string;
  type: QuestionType;
  prompt: string;
  mediaType: MediaType;
  options: OptionDraft[];
  isAttentionCheck: boolean;
  isTrapDuplicate: boolean;
  trapSourceId: string;
  minSelections: string;
  maxSelections: string;
  ratingMin: string;
  ratingMax: string;
  minLabel: string;
  maxLabel: string;
  bestLabel: string;
  worstLabel: string;
};

const EMPTY_QUESTION: QuestionDraft = {
  type: "SINGLE_SELECT",
  prompt: "",
  mediaType: "TEXT",
  options: [{ label: "", mediaId: "" }, { label: "", mediaId: "" }],
  isAttentionCheck: false,
  isTrapDuplicate: false,
  trapSourceId: "",
  minSelections: "",
  maxSelections: "",
  ratingMin: "1",
  ratingMax: "5",
  minLabel: "",
  maxLabel: "",
  bestLabel: "",
  worstLabel: "",
};

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"];
const FILE_MEDIA_TYPES: Array<Exclude<MediaType, "TEXT">> = ["IMAGE", "VIDEO", "AUDIO"];

const SETTINGS_TABS = [
  { value: "general", label: "General" },
  { value: "timing", label: "Timing & quality" },
  { value: "targeting", label: "Targeting" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

function configNumber(value: unknown, fallback = "") {
  return typeof value === "number" ? String(value) : fallback;
}

function configString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toDraft(question?: AdminQuestion): QuestionDraft {
  if (!question) return { ...EMPTY_QUESTION, options: EMPTY_QUESTION.options.map((option) => ({ ...option })) };
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    mediaType: question.mediaType ?? "TEXT",
    options:
      question.options.length > 0
        ? question.options.map((option) => ({ label: option.label ?? "", mediaId: option.mediaId ?? "" }))
        : question.type === "RATING"
        ? []
        : [{ label: "", mediaId: "" }, { label: "", mediaId: "" }],
    isAttentionCheck: question.isAttentionCheck,
    isTrapDuplicate: question.isTrapDuplicate,
    trapSourceId: question.trapSourceId ?? "",
    minSelections: configNumber(question.config.minSelections),
    maxSelections: configNumber(question.config.maxSelections),
    ratingMin: configNumber(question.config.min, "1"),
    ratingMax: configNumber(question.config.max, "5"),
    minLabel: configString(question.config.minLabel),
    maxLabel: configString(question.config.maxLabel),
    bestLabel: configString(question.config.bestLabel),
    worstLabel: configString(question.config.worstLabel),
  };
}

/** Pads or trims an options list to land within [min, max], preserving existing entries. */
function clampOptions(options: OptionDraft[], min: number, max: number): OptionDraft[] {
  const next = options.slice(0, max);
  while (next.length < min) next.push({ label: "", mediaId: "" });
  return next;
}

function numberOrUndefined(value: string) {
  return value.trim() ? Number(value) : undefined;
}

/** Compact form of a total minimum, e.g. "45 seconds" / "3 min". */
function formatTotalMinimum(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  return `${Math.round((totalSeconds / 60) * 10) / 10} min`;
}

export default function TestEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const questionDialogRef = useRef<HTMLDialogElement>(null);
  const closeTestDialogRef = useRef<HTMLDialogElement>(null);
  const deactivateDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDraftDialogRef = useRef<HTMLDialogElement>(null);
  const deleteQuestionDialogRef = useRef<HTMLDialogElement>(null);
  const [pendingDeleteQuestionId, setPendingDeleteQuestionId] = useState<string | null>(null);
  const [test, setTest] = useState<AdminTestDetail | null>(null);
  const [media, setMedia] = useState<AdminMedia[]>([]);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_QUESTION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responseCap, setResponseCap] = useState("");
  const [advisoryTimeMin, setAdvisoryTimeMin] = useState("");
  const [minTimePerQuestion, setMinTimePerQuestion] = useState("60");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [selectedGenders, setSelectedGenders] = useState<Gender[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const testId = params.id;
  const isDraft = test?.status === "DRAFT";

  const cityOptions = useMemo(() =>
    countries.flatMap((code) =>
      (CITIES_BY_COUNTRY[code] ?? []).map((c) => ({ value: c, label: c }))
    ),
    [countries]
  );

  function handleCountriesChange(next: string[]) {
    setCountries(next);
    const available = new Set(next.flatMap((code) => CITIES_BY_COUNTRY[code] ?? []));
    setCities((prev) => prev.filter((c) => available.has(c)));
  }

  const applyTest = useCallback((next: AdminTestDetail) => {
    setTest(next);
    setTitle(next.title);
    setDescription(next.description ?? "");
    setResponseCap(next.responseCap ? String(next.responseCap) : "");
    setAdvisoryTimeMin(next.advisoryTimeMin ? String(next.advisoryTimeMin) : "");
    setMinTimePerQuestion(String(next.minTimePerQuestion));
    setAgeMin(next.demographicFilters?.ageMin ? String(next.demographicFilters.ageMin) : "");
    setAgeMax(next.demographicFilters?.ageMax ? String(next.demographicFilters.ageMax) : "");
    setSelectedGenders(next.demographicFilters?.genders ?? []);
    setCountries(next.demographicFilters?.countries ?? []);
    setCities(next.demographicFilters?.cities ?? []);
  }, []);

  const fetchTest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<AdminTestDetail>(`/admin/tests/${testId}`);
      applyTest(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load test");
    } finally {
      setLoading(false);
    }
  }, [applyTest, testId]);

  useEffect(() => {
    void fetchTest();
  }, [fetchTest]);

  async function fetchMedia(mediaType: MediaType) {
    if (mediaType === "TEXT") {
      setMedia([]);
      return;
    }
    const data = await apiFetch<Paginated<AdminMedia>>(`/admin/media?page=1&limit=100&fileType=${mediaType}`);
    setMedia(data.items);
  }

  function openQuestionDialog(question?: AdminQuestion) {
    const nextDraft = toDraft(question);
    setDraft(nextDraft);
    setError("");
    questionDialogRef.current?.showModal();
    void fetchMedia(nextDraft.mediaType);
  }

  function updateOption(index: number, option: Partial<OptionDraft>) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((item, itemIndex) => (itemIndex === index ? { ...item, ...option } : item)),
    }));
  }

  function buildQuestionPayload() {
    const config: Record<string, unknown> = {};
    if (draft.type === "MULTI_SELECT") {
      const minSelections = numberOrUndefined(draft.minSelections);
      const maxSelections = numberOrUndefined(draft.maxSelections);
      if (minSelections) config.minSelections = minSelections;
      if (maxSelections) config.maxSelections = maxSelections;
    }
    if (draft.type === "RATING") {
      config.min = Number(draft.ratingMin || 1);
      config.max = Number(draft.ratingMax || 5);
      if (draft.minLabel.trim()) config.minLabel = draft.minLabel.trim();
      if (draft.maxLabel.trim()) config.maxLabel = draft.maxLabel.trim();
    }
    if (draft.type === "RANKING") {
      if (draft.bestLabel.trim()) config.bestLabel = draft.bestLabel.trim();
      if (draft.worstLabel.trim()) config.worstLabel = draft.worstLabel.trim();
    }

    const options =
      draft.type === "RATING"
        ? draft.options
            .filter((option) => option.label.trim() || option.mediaId)
            .slice(0, 1)
            .map((option, index) => ({
              label: option.label.trim() || undefined,
              mediaId: option.mediaId || undefined,
              order: index + 1,
            }))
        : draft.options.map((option, index) => ({
            label: option.label.trim() || undefined,
            mediaId: option.mediaId || undefined,
            order: index + 1,
          }));

    return {
      type: draft.type,
      prompt: draft.prompt.trim(),
      mediaType: draft.mediaType,
      config,
      options,
      isAttentionCheck: draft.isAttentionCheck,
      isTrapDuplicate: draft.isTrapDuplicate,
      trapSourceId: draft.isTrapDuplicate ? draft.trapSourceId || undefined : undefined,
    };
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      const filters = {
        ageMin: numberOrUndefined(ageMin),
        ageMax: numberOrUndefined(ageMax),
        genders: selectedGenders.length ? selectedGenders : undefined,
        countries: countries.length ? countries : undefined,
        cities: cities.length ? cities : undefined,
      };
      const hasFilters = Object.values(filters).some(Boolean);
      const updated = await apiFetch<AdminTestDetail>(`/admin/tests/${testId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          responseCap: numberOrUndefined(responseCap) ?? null,
          advisoryTimeMin: numberOrUndefined(advisoryTimeMin) ?? null,
          minTimePerQuestion: Number(minTimePerQuestion || 0),
          demographicFilters: hasFilters ? filters : null,
        }),
      });
      applyTest(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveQuestion() {
    setSaving(true);
    setError("");
    try {
      const payload = buildQuestionPayload();
      const updated = draft.id
        ? await apiFetch<AdminTestDetail>(`/admin/questions/${draft.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiFetch<AdminTestDetail>(`/admin/tests/${testId}/questions`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
      applyTest(updated);
      questionDialogRef.current?.close();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<AdminTestDetail>(`/admin/questions/${questionId}`, { method: "DELETE" });
      applyTest(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete question");
    } finally {
      setSaving(false);
    }
  }

  async function moveQuestion(questionId: string, direction: -1 | 1) {
    if (!test) return;
    const index = test.questions.findIndex((question) => question.id === questionId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= test.questions.length) return;
    const questionIds = test.questions.map((question) => question.id);
    [questionIds[index], questionIds[nextIndex]] = [questionIds[nextIndex]!, questionIds[index]!];
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<AdminTestDetail>(`/admin/tests/${test.id}/questions/reorder`, {
        method: "PUT",
        body: JSON.stringify({ questionIds }),
      });
      applyTest(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reorder questions");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: TestStatus) {
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<AdminTestDetail>(`/admin/tests/${testId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      applyTest(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to change status to ${status}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTest() {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/admin/tests/${testId}`, { method: "DELETE" });
      router.push("/tests");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete test");
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading test...</p>;
  if (!test) return <Alert>{error || "Test not found"}</Alert>;

  const totalMinimum = Number(minTimePerQuestion || 0) * test.questions.length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/tests" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back to tests
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-page-title text-foreground">{test.title}</h1>
          <Badge variant={statusVariant(test.status)}>{test.status}</Badge>
          <Badge variant="primary">{test.rewardPoints} pts</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Edit draft settings, questions, media options, and lifecycle.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="border-b border-border pb-0">
              <CardTitle>Settings</CardTitle>
              {!isDraft && (
                <p className="text-sm text-muted-foreground">
                  Settings are read-only once a test leaves draft.
                </p>
              )}
              <div className="flex gap-1 pt-3">
                {SETTINGS_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setSettingsTab(tab.value)}
                    aria-pressed={settingsTab === tab.value}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                      settingsTab === tab.value
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="pt-5">
              {settingsTab === "general" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Title" htmlFor="title">
                    <Input
                      id="title"
                      placeholder="Test title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      disabled={!isDraft}
                    />
                  </Field>
                  <Field label="Description" htmlFor="description" optional>
                    <Input
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Shown to evaluators under the title"
                      disabled={!isDraft}
                    />
                  </Field>
                  <Field
                    label="Response cap"
                    htmlFor="responseCap"
                    optional
                    hint="Stops assigning the test once this many responses arrive."
                  >
                    <Input
                      id="responseCap"
                      type="number"
                      min={1}
                      placeholder="No limit"
                      value={responseCap}
                      onChange={(event) => setResponseCap(event.target.value)}
                      disabled={!isDraft}
                    />
                  </Field>
                </div>
              )}

              {settingsTab === "timing" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field
                    label="Advisory time (minutes)"
                    htmlFor="advisoryTimeMin"
                    optional
                    hint="Shown to evaluators as an estimate. Fractional minutes allowed, e.g. 0.5 for 30 seconds."
                  >
                    <Input
                      id="advisoryTimeMin"
                      type="number"
                      min={0.1}
                      step={0.1}
                      placeholder="Advisory time in minutes"
                      value={advisoryTimeMin}
                      onChange={(event) => setAdvisoryTimeMin(event.target.value)}
                      disabled={!isDraft}
                    />
                  </Field>
                  <Field
                    label="Minimum time per question (seconds)"
                    htmlFor="minTimePerQuestion"
                    hint={
                      test.questions.length > 0
                        ? `Checked as a total: a response finished in under ${formatTotalMinimum(
                            totalMinimum
                          )} is flagged and earns no points.`
                        : "Checked as a total across all questions: finishing faster than that earns no points."
                    }
                  >
                    <Input
                      id="minTimePerQuestion"
                      type="number"
                      min={0}
                      placeholder="Min seconds per question"
                      value={minTimePerQuestion}
                      onChange={(event) => setMinTimePerQuestion(event.target.value)}
                      disabled={!isDraft}
                    />
                  </Field>
                </div>
              )}

              {settingsTab === "targeting" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Age range" optional hint="Leave empty to accept any age.">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Min"
                        aria-label="Minimum age"
                        value={ageMin}
                        onChange={(event) => setAgeMin(event.target.value)}
                        disabled={!isDraft}
                      />
                      <Input
                        placeholder="Max"
                        aria-label="Maximum age"
                        value={ageMax}
                        onChange={(event) => setAgeMax(event.target.value)}
                        disabled={!isDraft}
                      />
                    </div>
                  </Field>
                  <Field label="Genders" optional hint="No selection means every gender is eligible.">
                    <div className="flex min-h-11 flex-wrap items-center gap-3">
                      {GENDERS.map((gender) => (
                        <label key={gender} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input accent-primary"
                            checked={selectedGenders.includes(gender)}
                            disabled={!isDraft}
                            onChange={(event) => {
                              setSelectedGenders((current) =>
                                event.target.checked
                                  ? [...current, gender]
                                  : current.filter((item) => item !== gender)
                              );
                            }}
                          />
                          {gender}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Countries" optional>
                    <MultiCombobox
                      options={COUNTRIES}
                      value={countries}
                      onChange={handleCountriesChange}
                      placeholder="Select countries…"
                      disabled={!isDraft}
                    />
                  </Field>
                  <Field label="Cities" optional>
                    <MultiCombobox
                      options={cityOptions}
                      value={cities}
                      onChange={setCities}
                      placeholder={countries.length === 0 ? "Select countries first…" : "Select cities…"}
                      disabled={!isDraft || countries.length === 0}
                    />
                  </Field>
                </div>
              )}
            </CardContent>

            {isDraft && (
              <CardFooter className="justify-end">
                <Button onClick={saveSettings} disabled={saving || !title.trim()}>
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border">
              <CardTitle>Questions ({test.questions.length})</CardTitle>
              {isDraft && (
                <Button size="sm" onClick={() => openQuestionDialog()}>
                  <Plus className="size-4" aria-hidden />
                  Add Question
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {test.questions.length === 0 ? (
                <EmptyState
                  className="border-0 bg-transparent"
                  title="No questions yet"
                  description={
                    isDraft
                      ? "Add the first question to build this test."
                      : "This test has no questions."
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {test.questions.map((question, index) => (
                    <li
                      key={question.id}
                      className="flex flex-col gap-3 p-4 transition-colors hover:bg-accent/40 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold tabular-nums text-foreground">#{question.order}</span>
                          <span>·</span>
                          <span>{question.type.replace("_", " ").toLowerCase()}</span>
                          {question.mediaType && (
                            <>
                              <span>·</span>
                              <span>{question.mediaType.toLowerCase()}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{question.options.length} options</span>
                          {question.isAttentionCheck && <Badge variant="warning">Attention</Badge>}
                          {question.isTrapDuplicate && <Badge variant="warning">Trap</Badge>}
                        </div>
                        <p className="font-medium text-foreground">{question.prompt}</p>
                      </div>
                      {isDraft && (
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Move up"
                            className="px-2"
                            onClick={() => moveQuestion(question.id, -1)}
                            disabled={saving || index === 0}
                          >
                            <ArrowUp className="size-4" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Move down"
                            className="px-2"
                            onClick={() => moveQuestion(question.id, 1)}
                            disabled={saving || index === test.questions.length - 1}
                          >
                            <ArrowDown className="size-4" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openQuestionDialog(question)}
                            disabled={saving}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              setPendingDeleteQuestionId(question.id);
                              deleteQuestionDialogRef.current?.showModal();
                            }}
                            disabled={saving}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            Delete
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lifecycle actions, gathered in one place instead of spread across the header. */}
        <Card className="xl:sticky xl:top-8">
          <CardHeader className="pb-3">
            <CardTitle>Status & actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={statusVariant(test.status)}>{test.status}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Questions</dt>
                <dd className="tabular-nums">{test.questions.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Reward</dt>
                <dd className="tabular-nums">{test.rewardPoints} pts</dd>
              </div>
              {test.questions.length > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Min. total time</dt>
                  <dd className="tabular-nums">{formatTotalMinimum(totalMinimum)}</dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {isDraft && (
                <Button onClick={() => changeStatus("ACTIVE")} disabled={saving}>
                  <Play className="size-4" aria-hidden />
                  Activate
                </Button>
              )}
              {test.status === "PAUSED" && (
                <Button onClick={() => changeStatus("ACTIVE")} disabled={saving}>
                  <Play className="size-4" aria-hidden />
                  Reactivate
                </Button>
              )}

              <Link href={`/tests/${test.id}/preview`} className="contents">
                <Button variant="secondary" className="w-full">
                  <Eye className="size-4" aria-hidden />
                  Preview
                </Button>
              </Link>
              {(test.status === "ACTIVE" || test.status === "CLOSED") && (
                <Link href={`/tests/${test.id}/report`} className="contents">
                  <Button variant="secondary" className="w-full">
                    <BarChart3 className="size-4" aria-hidden />
                    Report
                  </Button>
                </Link>
              )}

              {test.status === "ACTIVE" && (
                <Button
                  variant="secondary"
                  className="text-warning"
                  onClick={() => deactivateDialogRef.current?.showModal()}
                  disabled={saving}
                >
                  <PauseCircle className="size-4" aria-hidden />
                  Deactivate
                </Button>
              )}
              {(test.status === "ACTIVE" || test.status === "PAUSED") && (
                <Button
                  variant="secondary"
                  className="text-destructive"
                  onClick={() => closeTestDialogRef.current?.showModal()}
                  disabled={saving}
                >
                  <Square className="size-4" aria-hidden />
                  Close Test
                </Button>
              )}
              {isDraft && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => deleteDraftDialogRef.current?.showModal()}
                  disabled={saving}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete Draft
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog ref={questionDialogRef} className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit question" : "Add question"}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <section className="space-y-4">
            <h3 className="text-meta uppercase text-muted-foreground">Basics</h3>
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Question type">
                <Select
                  aria-label="Question type"
                  value={draft.type}
                  onChange={(event) => {
                    const type = event.target.value as QuestionType;
                    setDraft((current) => ({
                      ...current,
                      type,
                      options:
                        type === "RANKING"
                          ? clampOptions(current.options, RANKING_MIN_OPTIONS, RANKING_MAX_OPTIONS)
                          : type === "RATING"
                          ? clampOptions(current.options, 0, 1)
                          : current.options,
                      // Neither check is meaningful for a ranking (prd.md 5.3.4): a trap
                      // duplicate compares option identity, which a ranking selects in full by
                      // construction, and there is no admin-facing way to key a "correct" order.
                      isAttentionCheck: type === "RANKING" ? false : current.isAttentionCheck,
                      isTrapDuplicate: type === "RANKING" ? false : current.isTrapDuplicate,
                      trapSourceId: type === "RANKING" ? "" : current.trapSourceId,
                    }));
                  }}
                >
                  <option value="SINGLE_SELECT">Single select</option>
                  <option value="MULTI_SELECT">Multi select</option>
                  <option value="RATING">Rating</option>
                  <option value="RANKING">Ranking</option>
                </Select>
              </Field>
              <Field label="Option media" hint="Changing this clears the options.">
                <Select
                  aria-label="Option media type"
                  value={draft.mediaType}
                  onChange={(event) => {
                    const mediaType = event.target.value as MediaType;
                    setDraft((current) => ({
                      ...current,
                      mediaType,
                      options: clampOptions(
                        [],
                        current.type === "RANKING" ? RANKING_MIN_OPTIONS : current.type === "RATING" ? 0 : 2,
                        current.type === "RANKING" ? RANKING_MAX_OPTIONS : current.type === "RATING" ? 1 : 2
                      ),
                    }));
                    void fetchMedia(mediaType);
                  }}
                >
                  <option value="TEXT">Text</option>
                  {FILE_MEDIA_TYPES.map((mediaType) => (
                    <option key={mediaType} value={mediaType}>{mediaType}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Prompt">
                <Input
                  placeholder="Question prompt"
                  value={draft.prompt}
                  onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                />
              </Field>
            </div>
          </section>

          {(draft.type === "SINGLE_SELECT" ||
            draft.type === "MULTI_SELECT" ||
            draft.type === "RANKING" ||
            draft.type === "RATING") && (
            <section className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-meta uppercase text-muted-foreground">
                  {draft.type === "RATING"
                    ? "Subject (optional)"
                    : `Options (${draft.options.length})`}
                  {draft.type === "RANKING" && ` — ${RANKING_MIN_OPTIONS} to ${RANKING_MAX_OPTIONS} required`}
                </h3>
                {draft.type !== "RATING" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        options: [...current.options, { label: "", mediaId: "" }],
                      }))
                    }
                    disabled={draft.options.length >= (draft.type === "RANKING" ? RANKING_MAX_OPTIONS : 10)}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add Option
                  </Button>
                )}
              </div>

              {draft.type === "RATING" && (
                <p className="text-sm text-muted-foreground">
                  What evaluators are rating — a photo, clip, sound, or short label. Leave it empty to
                  rate the prompt text alone.
                </p>
              )}

              {draft.type === "RATING" && draft.options.length === 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDraft((current) => ({ ...current, options: [{ label: "", mediaId: "" }] }))
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  Add Subject
                </Button>
              ) : null}

              {draft.options.map((option, index) => (
                <div key={index} className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                  <Input
                    placeholder={draft.type === "RATING" ? "Subject label" : `Option ${index + 1} label`}
                    aria-label={draft.type === "RATING" ? "Subject label" : `Option ${index + 1} label`}
                    value={option.label}
                    onChange={(event) => updateOption(index, { label: event.target.value })}
                  />
                  {draft.mediaType === "TEXT" ? (
                    <Input value="Text option" aria-label="Option media" disabled />
                  ) : (
                    <Select
                      aria-label={draft.type === "RATING" ? "Subject media" : `Option ${index + 1} media`}
                      value={option.mediaId}
                      onChange={(event) => updateOption(index, { mediaId: event.target.value })}
                    >
                      <option value="">Select media</option>
                      {media.map((item) => (
                        <option key={item.id} value={item.id}>{item.fileName}</option>
                      ))}
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    aria-label={draft.type === "RATING" ? "Remove subject" : `Remove option ${index + 1}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        options: current.options.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    disabled={
                      draft.type === "RATING"
                        ? false
                        : draft.options.length <= (draft.type === "RANKING" ? RANKING_MIN_OPTIONS : 2)
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Remove
                  </Button>
                </div>
              ))}

              {draft.type === "MULTI_SELECT" && (
                <div className="grid gap-4 pt-1 sm:grid-cols-2">
                  <Field label="Min selections" optional>
                    <Input
                      placeholder="No minimum"
                      value={draft.minSelections}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, minSelections: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Max selections" optional>
                    <Input
                      placeholder="No maximum"
                      value={draft.maxSelections}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, maxSelections: event.target.value }))
                      }
                    />
                  </Field>
                </div>
              )}
            </section>
          )}

          {draft.type === "RATING" && (
            <section className="space-y-3 border-t border-border pt-5">
              <h3 className="text-meta uppercase text-muted-foreground">Rating scale</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Min value">
                  <Input
                    placeholder="1"
                    value={draft.ratingMin}
                    onChange={(event) => setDraft((current) => ({ ...current, ratingMin: event.target.value }))}
                  />
                </Field>
                <Field label="Max value">
                  <Input
                    placeholder="5"
                    value={draft.ratingMax}
                    onChange={(event) => setDraft((current) => ({ ...current, ratingMax: event.target.value }))}
                  />
                </Field>
                <Field label="Min label" optional>
                  <Input
                    placeholder="e.g. Not likely"
                    value={draft.minLabel}
                    onChange={(event) => setDraft((current) => ({ ...current, minLabel: event.target.value }))}
                  />
                </Field>
                <Field label="Max label" optional>
                  <Input
                    placeholder="e.g. Very likely"
                    value={draft.maxLabel}
                    onChange={(event) => setDraft((current) => ({ ...current, maxLabel: event.target.value }))}
                  />
                </Field>
              </div>
            </section>
          )}

          {draft.type === "RANKING" && (
            <section className="space-y-3 border-t border-border pt-5">
              <h3 className="text-meta uppercase text-muted-foreground">Endpoint labels</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Best label" optional>
                  <Input
                    placeholder="Best"
                    value={draft.bestLabel}
                    onChange={(event) => setDraft((current) => ({ ...current, bestLabel: event.target.value }))}
                  />
                </Field>
                <Field label="Worst label" optional>
                  <Input
                    placeholder="Worst"
                    value={draft.worstLabel}
                    onChange={(event) => setDraft((current) => ({ ...current, worstLabel: event.target.value }))}
                  />
                </Field>
              </div>
            </section>
          )}

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-meta uppercase text-muted-foreground">Quality control</h3>
            <p className="text-sm text-muted-foreground">
              {draft.type === "RANKING"
                ? "Ranking questions aren't eligible as an attention check or trap duplicate."
                : "A question can be an attention check or a trap duplicate, not both."}
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              <label
                className={`flex min-h-11 items-center gap-2 text-sm ${
                  draft.isTrapDuplicate || draft.type === "RANKING" ? "text-muted-foreground" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={draft.isAttentionCheck}
                  disabled={draft.isTrapDuplicate || draft.type === "RANKING"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      isAttentionCheck: event.target.checked,
                      // The two checks are mutually exclusive; picking one clears the other.
                      isTrapDuplicate: event.target.checked ? false : current.isTrapDuplicate,
                      trapSourceId: event.target.checked ? "" : current.trapSourceId,
                    }))
                  }
                />
                Attention check
              </label>
              <label
                className={`flex min-h-11 items-center gap-2 text-sm ${
                  draft.isAttentionCheck || draft.type === "RANKING" ? "text-muted-foreground" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={draft.isTrapDuplicate}
                  disabled={draft.isAttentionCheck || draft.type === "RANKING"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      isTrapDuplicate: event.target.checked,
                      isAttentionCheck: event.target.checked ? false : current.isAttentionCheck,
                      trapSourceId: event.target.checked ? current.trapSourceId : "",
                    }))
                  }
                />
                Trap duplicate
              </label>
              <Field label="Trap source question">
                <Select
                  aria-label="Trap source question"
                  value={draft.trapSourceId}
                  disabled={!draft.isTrapDuplicate}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, trapSourceId: event.target.value }))
                  }
                >
                  <option value="">Trap source question</option>
                  {test.questions
                    .filter((question) => question.id !== draft.id)
                    .map((question) => (
                      <option key={question.id} value={question.id}>
                        #{question.order} {question.prompt}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
          </section>

          {error && <Alert>{error}</Alert>}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => questionDialogRef.current?.close()} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={saveQuestion} disabled={saving || !draft.prompt.trim()}>
            {saving ? "Saving..." : "Save Question"}
          </Button>
        </DialogFooter>
      </Dialog>

      <ConfirmDialog
        ref={closeTestDialogRef}
        title="Close Test"
        description="Are you sure you want to close the test? The test cannot be reopened once closed."
        confirmLabel="Close Test"
        tone="danger"
        busy={saving}
        onConfirm={() => {
          closeTestDialogRef.current?.close();
          changeStatus("CLOSED");
        }}
      />

      <ConfirmDialog
        ref={deactivateDialogRef}
        title="Deactivate test"
        description="Deactivate (pause) this test? Evaluators will stop receiving it until you reactivate."
        confirmLabel="Deactivate"
        busy={saving}
        onConfirm={() => {
          deactivateDialogRef.current?.close();
          changeStatus("PAUSED");
        }}
      />

      <ConfirmDialog
        ref={deleteDraftDialogRef}
        title="Delete draft"
        description="This draft and its questions will be permanently removed."
        confirmLabel="Delete Draft"
        tone="danger"
        busy={saving}
        onConfirm={() => {
          deleteDraftDialogRef.current?.close();
          void deleteTest();
        }}
      />

      <ConfirmDialog
        ref={deleteQuestionDialogRef}
        title="Delete question"
        description="This question will be removed from the test."
        confirmLabel="Delete"
        tone="danger"
        busy={saving}
        onCancel={() => setPendingDeleteQuestionId(null)}
        onConfirm={() => {
          deleteQuestionDialogRef.current?.close();
          if (pendingDeleteQuestionId) void deleteQuestion(pendingDeleteQuestionId);
          setPendingDeleteQuestionId(null);
        }}
      />
    </div>
  );
}
