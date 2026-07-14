"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Gender, MediaType, QuestionType, TestStatus } from "@testx/shared";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  Input,
  Select,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
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
  minChars: string;
  maxChars: string;
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
  minChars: "",
  maxChars: "",
};

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"];
const FILE_MEDIA_TYPES: Array<Exclude<MediaType, "TEXT">> = ["IMAGE", "VIDEO", "AUDIO"];

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
    minChars: configNumber(question.config.minChars),
    maxChars: configNumber(question.config.maxChars),
  };
}

function numberOrUndefined(value: string) {
  return value.trim() ? Number(value) : undefined;
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function TestEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const questionDialogRef = useRef<HTMLDialogElement>(null);
  const [test, setTest] = useState<AdminTestDetail | null>(null);
  const [media, setMedia] = useState<AdminMedia[]>([]);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_QUESTION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responseCap, setResponseCap] = useState("");
  const [advisoryTimeMin, setAdvisoryTimeMin] = useState("");
  const [minTimePerQuestion, setMinTimePerQuestion] = useState("60");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [selectedGenders, setSelectedGenders] = useState<Gender[]>([]);
  const [countries, setCountries] = useState("");
  const [cities, setCities] = useState("");

  const testId = params.id;
  const isDraft = test?.status === "DRAFT";

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
    setCountries(next.demographicFilters?.countries?.join(", ") ?? "");
    setCities(next.demographicFilters?.cities?.join(", ") ?? "");
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
    if (draft.type === "FREE_TEXT") {
      const minChars = numberOrUndefined(draft.minChars);
      const maxChars = numberOrUndefined(draft.maxChars);
      if (minChars) config.minChars = minChars;
      if (maxChars) config.maxChars = maxChars;
    }

    const options =
      draft.type === "SINGLE_SELECT" || draft.type === "MULTI_SELECT"
        ? draft.options.map((option, index) => ({
            label: option.label.trim() || undefined,
            mediaId: option.mediaId || undefined,
            order: index + 1,
          }))
        : [];

    return {
      type: draft.type,
      prompt: draft.prompt.trim(),
      mediaType: draft.type === "FREE_TEXT" ? null : draft.mediaType,
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
        countries: splitList(countries).length ? splitList(countries) : undefined,
        cities: splitList(cities).length ? splitList(cities) : undefined,
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

  async function activateTest() {
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<AdminTestDetail>(`/admin/tests/${testId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "ACTIVE" satisfies TestStatus }),
      });
      applyTest(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate test");
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
  if (!test) return <p className="text-sm text-destructive">{error || "Test not found"}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{test.title}</h1>
            <Badge>{test.status}</Badge>
            <Badge>{test.rewardPoints} pts</Badge>
          </div>
          <p className="text-muted-foreground">Edit draft settings, questions, media options, and lifecycle.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/tests/${test.id}/preview`}><Button variant="secondary">Preview</Button></Link>
          {isDraft && <Button onClick={activateTest} disabled={saving}>Activate</Button>}
          {isDraft && <Button variant="secondary" onClick={deleteTest} disabled={saving}>Delete Draft</Button>}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} disabled={!isDraft} />
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            disabled={!isDraft}
          />
          <Input
            type="number"
            min={1}
            placeholder="Response cap"
            value={responseCap}
            onChange={(event) => setResponseCap(event.target.value)}
            disabled={!isDraft}
          />
          <Input
            type="number"
            min={1}
            placeholder="Advisory time in minutes"
            value={advisoryTimeMin}
            onChange={(event) => setAdvisoryTimeMin(event.target.value)}
            disabled={!isDraft}
          />
          <Input
            type="number"
            min={0}
            placeholder="Min seconds per question"
            value={minTimePerQuestion}
            onChange={(event) => setMinTimePerQuestion(event.target.value)}
            disabled={!isDraft}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Age min" value={ageMin} onChange={(event) => setAgeMin(event.target.value)} disabled={!isDraft} />
            <Input placeholder="Age max" value={ageMax} onChange={(event) => setAgeMax(event.target.value)} disabled={!isDraft} />
          </div>
          <Input placeholder="Countries, comma-separated" value={countries} onChange={(event) => setCountries(event.target.value)} disabled={!isDraft} />
          <Input placeholder="Cities, comma-separated" value={cities} onChange={(event) => setCities(event.target.value)} disabled={!isDraft} />
          <div className="flex flex-wrap gap-3 lg:col-span-2">
            {GENDERS.map((gender) => (
              <label key={gender} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedGenders.includes(gender)}
                  disabled={!isDraft}
                  onChange={(event) => {
                    setSelectedGenders((current) =>
                      event.target.checked ? [...current, gender] : current.filter((item) => item !== gender)
                    );
                  }}
                />
                {gender}
              </label>
            ))}
          </div>
          {isDraft && (
            <div className="lg:col-span-2">
              <Button onClick={saveSettings} disabled={saving || !title.trim()}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Questions</CardTitle>
          {isDraft && <Button onClick={() => openQuestionDialog()}>Add Question</Button>}
        </CardHeader>
        <CardContent className="space-y-3">
          {test.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions yet.</p>
          ) : (
            test.questions.map((question, index) => (
              <div key={question.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge>#{question.order}</Badge>
                      <Badge>{question.type}</Badge>
                      {question.mediaType && <Badge>{question.mediaType}</Badge>}
                      {question.isAttentionCheck && <Badge>Attention</Badge>}
                      {question.isTrapDuplicate && <Badge>Trap</Badge>}
                    </div>
                    <p className="font-medium">{question.prompt}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{question.options.length} options</p>
                  </div>
                  {isDraft && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => moveQuestion(question.id, -1)} disabled={saving || index === 0}>Up</Button>
                      <Button variant="secondary" onClick={() => moveQuestion(question.id, 1)} disabled={saving || index === test.questions.length - 1}>Down</Button>
                      <Button variant="secondary" onClick={() => openQuestionDialog(question)} disabled={saving}>Edit</Button>
                      <Button variant="secondary" onClick={() => deleteQuestion(question.id)} disabled={saving}>Delete</Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog ref={questionDialogRef} className="w-full max-w-4xl">
        <div className="space-y-5 p-6">
          <CardHeader className="p-0">
            <CardTitle>{draft.id ? "Edit question" : "Add question"}</CardTitle>
          </CardHeader>

          <div className="grid gap-3 lg:grid-cols-3">
            <Select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as QuestionType }))}>
              <option value="SINGLE_SELECT">Single select</option>
              <option value="MULTI_SELECT">Multi select</option>
              <option value="RATING">Rating</option>
              <option value="FREE_TEXT">Free text</option>
            </Select>
            <Select
              value={draft.mediaType}
              disabled={draft.type === "FREE_TEXT"}
              onChange={(event) => {
                const mediaType = event.target.value as MediaType;
                setDraft((current) => ({ ...current, mediaType, options: [{ label: "", mediaId: "" }, { label: "", mediaId: "" }] }));
                void fetchMedia(mediaType);
              }}
            >
              <option value="TEXT">Text</option>
              {FILE_MEDIA_TYPES.map((mediaType) => <option key={mediaType} value={mediaType}>{mediaType}</option>)}
            </Select>
            <Input
              placeholder="Question prompt"
              value={draft.prompt}
              onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
            />
          </div>

          {(draft.type === "SINGLE_SELECT" || draft.type === "MULTI_SELECT") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Options</h3>
                <Button
                  variant="secondary"
                  onClick={() => setDraft((current) => ({ ...current, options: [...current.options, { label: "", mediaId: "" }] }))}
                  disabled={draft.options.length >= 10}
                >
                  Add Option
                </Button>
              </div>
              {draft.options.map((option, index) => (
                <div key={index} className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                  <Input placeholder="Label" value={option.label} onChange={(event) => updateOption(index, { label: event.target.value })} />
                  {draft.mediaType === "TEXT" ? (
                    <Input value="Text option" disabled />
                  ) : (
                    <Select value={option.mediaId} onChange={(event) => updateOption(index, { mediaId: event.target.value })}>
                      <option value="">Select media</option>
                      {media.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}
                    </Select>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => setDraft((current) => ({ ...current, options: current.options.filter((_, itemIndex) => itemIndex !== index) }))}
                    disabled={draft.options.length <= 2}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {draft.type === "MULTI_SELECT" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Min selections" value={draft.minSelections} onChange={(event) => setDraft((current) => ({ ...current, minSelections: event.target.value }))} />
                  <Input placeholder="Max selections" value={draft.maxSelections} onChange={(event) => setDraft((current) => ({ ...current, maxSelections: event.target.value }))} />
                </div>
              )}
            </div>
          )}

          {draft.type === "RATING" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Min value" value={draft.ratingMin} onChange={(event) => setDraft((current) => ({ ...current, ratingMin: event.target.value }))} />
              <Input placeholder="Max value" value={draft.ratingMax} onChange={(event) => setDraft((current) => ({ ...current, ratingMax: event.target.value }))} />
              <Input placeholder="Min label" value={draft.minLabel} onChange={(event) => setDraft((current) => ({ ...current, minLabel: event.target.value }))} />
              <Input placeholder="Max label" value={draft.maxLabel} onChange={(event) => setDraft((current) => ({ ...current, maxLabel: event.target.value }))} />
            </div>
          )}

          {draft.type === "FREE_TEXT" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Min characters" value={draft.minChars} onChange={(event) => setDraft((current) => ({ ...current, minChars: event.target.value }))} />
              <Input placeholder="Max characters" value={draft.maxChars} onChange={(event) => setDraft((current) => ({ ...current, maxChars: event.target.value }))} />
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isAttentionCheck} onChange={(event) => setDraft((current) => ({ ...current, isAttentionCheck: event.target.checked }))} />
              Attention check
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isTrapDuplicate} onChange={(event) => setDraft((current) => ({ ...current, isTrapDuplicate: event.target.checked }))} />
              Trap duplicate
            </label>
            <Select
              value={draft.trapSourceId}
              disabled={!draft.isTrapDuplicate}
              onChange={(event) => setDraft((current) => ({ ...current, trapSourceId: event.target.value }))}
            >
              <option value="">Trap source question</option>
              {test.questions.filter((question) => question.id !== draft.id).map((question) => (
                <option key={question.id} value={question.id}>#{question.order} {question.prompt}</option>
              ))}
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => questionDialogRef.current?.close()} disabled={saving}>Cancel</Button>
            <Button onClick={saveQuestion} disabled={saving || !draft.prompt.trim()}>
              {saving ? "Saving..." : "Save Question"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
