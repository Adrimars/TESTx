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
import { COUNTRIES, CITIES_BY_COUNTRY, autoAttentionCheckCount } from "@testx/shared";
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
  /** The media the question is about, as opposed to the media its options offer. */
  questionMediaId: string;
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
  topLabel: string;
  bottomLabel: string;
};

const EMPTY_QUESTION: QuestionDraft = {
  type: "SINGLE_SELECT",
  prompt: "",
  mediaType: "TEXT",
  questionMediaId: "",
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
  topLabel: "",
  bottomLabel: "",
};

/** Types answered through a list of options — selection questions and ordering alike. */
function usesOptions(type: QuestionType) {
  return type === "SINGLE_SELECT" || type === "MULTI_SELECT" || type === "ORDERING";
}

/** Only select questions can carry an attention check's "pick this exact option" grading key. */
function canBeAttentionCheck(type: QuestionType) {
  return type === "SINGLE_SELECT" || type === "MULTI_SELECT";
}

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
    questionMediaId: question.mediaId ?? "",
    options:
      question.options.length > 0
        ? question.options.map((option) => ({ label: option.label ?? "", mediaId: option.mediaId ?? "" }))
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
    topLabel: configString(question.config.topLabel),
    bottomLabel: configString(question.config.bottomLabel),
  };
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
    if (draft.type === "ORDERING") {
      if (draft.topLabel.trim()) config.topLabel = draft.topLabel.trim();
      if (draft.bottomLabel.trim()) config.bottomLabel = draft.bottomLabel.trim();
    }

    const options = usesOptions(draft.type)
      ? draft.options.map((option, index) => ({
          label: option.label.trim() || undefined,
          mediaId: option.mediaId || undefined,
          order: index + 1,
        }))
      : [];

    return {
      type: draft.type,
      prompt: draft.prompt.trim(),
      mediaType: draft.mediaType,
      mediaId: draft.mediaType === "TEXT" ? null : draft.questionMediaId || null,
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

  // A rating question on a file media type has nothing to rate without its media, which the
  // API rejects — so the button says so before the round trip.
  const needsQuestionMedia =
    draft.type === "RATING" && draft.mediaType !== "TEXT" && !draft.questionMediaId;
  const canSaveQuestion = Boolean(draft.prompt.trim()) && !needsQuestionMedia;

  if (loading) return <p className="text-sm text-muted-foreground">Loading test...</p>;
  if (!test) return <Alert>{error || "Test not found"}</Alert>;

  const totalMinimum = Number(minTimePerQuestion || 0) * test.questions.length;

  // Activation tops the test up to the attention-check quota its length earns. Admins had no
  // way to know a question they never wrote was about to appear, so it is stated up front.
  const scoredQuestionCount = test.questions.filter(
    (question) => !question.isAttentionCheck && !question.isTrapDuplicate
  ).length;
  const attentionCheckCount = test.questions.filter((question) => question.isAttentionCheck).length;
  const plannedAttentionChecks = Math.max(
    0,
    autoAttentionCheckCount(scoredQuestionCount) - attentionCheckCount
  );

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
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Attention checks</dt>
                <dd className="tabular-nums">{attentionCheckCount}</dd>
              </div>
            </dl>

            {isDraft && (
              <p className="text-xs text-muted-foreground">
                {plannedAttentionChecks > 0
                  ? `${plannedAttentionChecks} attention check${
                      plannedAttentionChecks === 1 ? "" : "s"
                    } will be added on activation (${scoredQuestionCount} scored question${
                      scoredQuestionCount === 1 ? "" : "s"
                    }).`
                  : `No attention checks will be added on activation (${scoredQuestionCount} scored question${
                      scoredQuestionCount === 1 ? "" : "s"
                    }).`}
              </p>
            )}

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
                      // Rating and ordering questions cannot carry an attention check's
                      // "pick this exact option" key, so the flag goes with the type.
                      isAttentionCheck: canBeAttentionCheck(type) ? current.isAttentionCheck : false,
                    }));
                  }}
                >
                  <option value="SINGLE_SELECT">Single select</option>
                  <option value="MULTI_SELECT">Multi select</option>
                  <option value="RATING">Rating</option>
                  <option value="ORDERING">Ordering</option>
                </Select>
              </Field>
              <Field
                label={draft.type === "RATING" ? "Media type" : "Option media"}
                hint={
                  draft.type === "RATING"
                    ? "The kind of media evaluators will be rating."
                    : "Changing this clears the options."
                }
              >
                <Select
                  aria-label="Option media type"
                  value={draft.mediaType}
                  onChange={(event) => {
                    const mediaType = event.target.value as MediaType;
                    setDraft((current) => ({
                      ...current,
                      mediaType,
                      questionMediaId: "",
                      options: [{ label: "", mediaId: "" }, { label: "", mediaId: "" }],
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

            {/*
              What the question is *about*, as opposed to what its options offer. A rating
              question cannot carry options at all, so this is the only place the thing being
              rated can come from.
            */}
            {draft.mediaType !== "TEXT" && (
              <Field
                label={draft.type === "RATING" ? "Media to rate" : "Question media"}
                optional={draft.type !== "RATING"}
                hint={
                  draft.type === "RATING"
                    ? "Shown above the rating scale."
                    : "Shown above the options — the media the question asks about."
                }
              >
                <Select
                  aria-label="Question media"
                  value={draft.questionMediaId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, questionMediaId: event.target.value }))
                  }
                >
                  <option value="">
                    {media.length === 0
                      ? `No ${draft.mediaType.toLowerCase()} media in the library`
                      : "Select media"}
                  </option>
                  {media.map((item) => (
                    <option key={item.id} value={item.id}>{item.fileName}</option>
                  ))}
                </Select>
              </Field>
            )}
          </section>

          {usesOptions(draft.type) && (
            <section className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-meta uppercase text-muted-foreground">
                  Options ({draft.options.length})
                </h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      options: [...current.options, { label: "", mediaId: "" }],
                    }))
                  }
                  disabled={draft.options.length >= 10}
                >
                  <Plus className="size-4" aria-hidden />
                  Add Option
                </Button>
              </div>

              {draft.options.map((option, index) => (
                <div key={index} className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                  <Input
                    placeholder={`Option ${index + 1} label`}
                    aria-label={`Option ${index + 1} label`}
                    value={option.label}
                    onChange={(event) => updateOption(index, { label: event.target.value })}
                  />
                  {draft.mediaType === "TEXT" ? (
                    <Input value="Text option" aria-label="Option media" disabled />
                  ) : (
                    <Select
                      aria-label={`Option ${index + 1} media`}
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
                    aria-label={`Remove option ${index + 1}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        options: current.options.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    disabled={draft.options.length <= 2}
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

          {draft.type === "ORDERING" && (
            <section className="space-y-3 border-t border-border pt-5">
              <h3 className="text-meta uppercase text-muted-foreground">Ranking labels</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Instruction"
                  optional
                  hint="Shown above the list. Defaults to “Drag the options into order — best first.”"
                >
                  <Input
                    placeholder="e.g. Rank these from most to least realistic"
                    value={draft.topLabel}
                    onChange={(event) => setDraft((current) => ({ ...current, topLabel: event.target.value }))}
                  />
                </Field>
                <Field label="Note below the list" optional>
                  <Input
                    placeholder="e.g. Last place is the least realistic"
                    value={draft.bottomLabel}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, bottomLabel: event.target.value }))
                    }
                  />
                </Field>
              </div>
            </section>
          )}

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-meta uppercase text-muted-foreground">Quality control</h3>
            <p className="text-sm text-muted-foreground">
              A question can be an attention check or a trap duplicate, not both.
              {!canBeAttentionCheck(draft.type) &&
                " Only single and multi select questions can be attention checks."}
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              <label
                className={`flex min-h-11 items-center gap-2 text-sm ${
                  draft.isTrapDuplicate || !canBeAttentionCheck(draft.type) ? "text-muted-foreground" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={draft.isAttentionCheck}
                  disabled={draft.isTrapDuplicate || !canBeAttentionCheck(draft.type)}
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
                  draft.isAttentionCheck ? "text-muted-foreground" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={draft.isTrapDuplicate}
                  disabled={draft.isAttentionCheck}
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
          <Button onClick={saveQuestion} disabled={saving || !canSaveQuestion}>
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
