"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Clock, ListChecks, RefreshCw, SearchX } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Combobox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
} from "@testx/ui";
import { MultiCombobox } from "@testx/ui";
import type { ComboboxOption } from "@testx/ui";
import { COUNTRIES, CITIES_BY_COUNTRY, LANGUAGES } from "@testx/shared";
import { EDUCATION_LEVELS, AI_USE_CASES, AI_EXPERIENCE_OPTIONS, AI_FREQUENCY_OPTIONS } from "@testx/shared";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import type { NextTest } from "@/lib/test-types";

const AGE_OPTIONS: ComboboxOption[] = Array.from({ length: 88 }, (_, i) => {
  const age = i + 13;
  return { value: String(age), label: String(age) };
});

const LANGUAGE_OPTIONS: ComboboxOption[] = LANGUAGES.map((l) => ({ value: l.value, label: l.label }));

/** Section divider inside the edit-profile dialog. */
function DialogSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-meta uppercase text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [editAge, setEditAge] = useState("");
  const [editGender, setEditGender] = useState("UNDISCLOSED");
  const [editCountry, setEditCountry] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editNativeLanguage, setEditNativeLanguage] = useState("");
  const [editForeignLanguages, setEditForeignLanguages] = useState<string[]>([]);
  const [editOccupation, setEditOccupation] = useState("");
  const [editEducationLevel, setEditEducationLevel] = useState("");
  const [editAiUseCases, setEditAiUseCases] = useState<string[]>([]);
  const [editAiExperience, setEditAiExperience] = useState("");
  const [editAiFrequency, setEditAiFrequency] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const editCityOptions = useMemo(() => {
    const cities = CITIES_BY_COUNTRY[editCountry] ?? [];
    return cities.map((c) => ({ value: c, label: c }));
  }, [editCountry]);

  const editForeignLanguageOptions: ComboboxOption[] = useMemo(
    () => LANGUAGE_OPTIONS.filter((l) => l.value !== editNativeLanguage),
    [editNativeLanguage]
  );

  function openEditDialog() {
    const profile = user?.evaluatorProfile;
    setEditAge(profile?.age ? String(profile.age) : "");
    setEditGender(profile?.gender ?? "UNDISCLOSED");
    setEditCountry(profile?.country ?? "");
    setEditCity(profile?.city ?? "");
    setEditNativeLanguage(profile?.nativeLanguage ?? "");
    setEditForeignLanguages(profile?.foreignLanguages ?? []);
    setEditOccupation(profile?.occupation ?? "");
    setEditEducationLevel(profile?.educationLevel ?? "");
    setEditAiUseCases(profile?.aiUseCases ?? []);
    setEditAiExperience(profile?.aiExperience ?? "");
    setEditAiFrequency(profile?.aiFrequency ?? "");
    setEditError("");
    editDialogRef.current?.showModal();
  }

  function handleEditCountryChange(value: string) {
    setEditCountry(value);
    setEditCity("");
  }

  function handleEditNativeLanguageChange(value: string) {
    setEditNativeLanguage(value);
    setEditForeignLanguages((prev) => prev.filter((l) => l !== value));
  }

  async function saveProfile() {
    if (!editAge) { setEditError("Please select your age."); return; }
    if (!editCountry) { setEditError("Please select your country."); return; }
    setEditSaving(true);
    setEditError("");
    try {
      await apiFetch("/evaluator/profile", {
        method: "PUT",
        body: JSON.stringify({
          age: Number(editAge),
          gender: editGender,
          country: editCountry,
          city: editCity || undefined,
          nativeLanguage: editNativeLanguage || undefined,
          foreignLanguages: editForeignLanguages,
          occupation: editOccupation.trim() || undefined,
          educationLevel: editEducationLevel || undefined,
          aiUseCases: editAiUseCases,
          aiExperience: editAiExperience || undefined,
          aiFrequency: editAiFrequency || undefined,
        }),
      });
      await refreshUser();
      editDialogRef.current?.close();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setEditSaving(false);
    }
  }

  const [nextTest, setNextTest] = useState<NextTest | null | undefined>(undefined);

  const balance = user?.evaluatorProfile?.balance ?? 0;

  async function fetchNextTest() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<NextTest | null>("/evaluator/next-test");
      setNextTest(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchNextTest(); }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-page-title text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Pick up your next test and track your points.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        {/* Next test — the primary action on this screen. */}
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-surface px-5 py-2.5">
            <p className="text-meta uppercase text-muted-foreground">Next test</p>
          </div>

          <CardContent className="space-y-5 p-5 sm:p-6">
            {loading && (
              <div className="space-y-2">
                <p className="text-section-title text-foreground">Searching for a suitable test…</p>
                <p className="text-sm text-muted-foreground">Please wait…</p>
              </div>
            )}

            {!loading && nextTest && (
              <>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold leading-snug text-foreground">{nextTest.title}</h2>
                  {nextTest.description && (
                    <p className="text-sm text-muted-foreground">{nextTest.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 text-sm text-muted-foreground">
                    <ListChecks className="size-4" aria-hidden />
                    {nextTest.questionCount} questions
                  </span>
                  {nextTest.advisoryTimeMin && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 text-sm text-muted-foreground">
                      <Clock className="size-4" aria-hidden />
                      ~{nextTest.advisoryTimeMin} min
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-sm font-medium text-primary">
                    <Award className="size-4" aria-hidden />
                    {nextTest.rewardPoints} points
                  </span>
                </div>

                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => router.push(`/tests/${nextTest.id}`)}
                >
                  Start Test
                </Button>
              </>
            )}

            {!loading && nextTest === null && (
              <div className="flex flex-col items-start gap-4">
                <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <SearchX className="size-5" aria-hidden />
                </div>
                <div className="space-y-1">
                  <p className="text-section-title text-foreground">No test available</p>
                  <p className="text-sm text-muted-foreground">
                    Currently, no suitable tests are available.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={fetchNextTest}
                  disabled={loading}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Search for suitable tests
                </Button>
              </div>
            )}

            {error && <Alert>{error}</Alert>}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardContent className="p-5">
              <p className="text-meta uppercase text-muted-foreground">Points earned</p>
              <p className="mt-1.5 text-stat tabular-nums text-primary">{balance}</p>
              <Button variant="secondary" size="sm" disabled className="mt-4 w-full">
                Withdraw — Coming Soon
              </Button>
            </CardContent>
          </Card>

          {user?.evaluatorProfile && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Your profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-0">
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="sr-only">Email</dt>
                    <dd className="truncate font-medium text-foreground" title={user.email}>
                      {user.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="sr-only">Demographics</dt>
                    <dd className="text-muted-foreground">
                      {user.evaluatorProfile.gender} · {user.evaluatorProfile.country}
                      {user.evaluatorProfile.city ? ` · ${user.evaluatorProfile.city}` : ""}
                    </dd>
                  </div>
                </dl>
                <Button variant="secondary" size="sm" className="w-full" onClick={openEditDialog}>
                  Edit Profile
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog ref={editDialogRef} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <DialogSection title="Demographics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Age">
                <Combobox
                  options={AGE_OPTIONS}
                  value={editAge}
                  onChange={setEditAge}
                  placeholder="Select age…"
                  searchPlaceholder="Search age…"
                />
              </Field>
              <Field label="Gender">
                <Select aria-label="Gender" value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="UNDISCLOSED">Prefer not to say</option>
                </Select>
              </Field>
              <Field label="Country">
                <Combobox
                  options={COUNTRIES}
                  value={editCountry}
                  onChange={handleEditCountryChange}
                  placeholder="Select country…"
                  searchPlaceholder="Search country…"
                />
              </Field>
              <Field label="City">
                <Combobox
                  options={editCityOptions}
                  value={editCity}
                  onChange={setEditCity}
                  placeholder={editCountry ? "Select city…" : "Select country first…"}
                  searchPlaceholder="Search city…"
                  disabled={!editCountry || editCityOptions.length === 0}
                />
              </Field>
            </div>
          </DialogSection>

          <DialogSection title="Language">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Native language">
                <Combobox
                  options={LANGUAGE_OPTIONS}
                  value={editNativeLanguage}
                  onChange={handleEditNativeLanguageChange}
                  placeholder="Select language…"
                  searchPlaceholder="Search language…"
                />
              </Field>
              <Field label="Foreign languages">
                <MultiCombobox
                  options={editForeignLanguageOptions}
                  value={editForeignLanguages}
                  onChange={setEditForeignLanguages}
                  placeholder="Select languages…"
                  searchPlaceholder="Search language…"
                />
              </Field>
            </div>
          </DialogSection>

          <DialogSection title="Background">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Current occupation">
                <Input
                  placeholder="e.g. Software Engineer, Student…"
                  value={editOccupation}
                  onChange={(e) => setEditOccupation(e.target.value)}
                />
              </Field>
              <Field label="Education level">
                <Select
                  aria-label="Education level"
                  value={editEducationLevel}
                  onChange={(e) => setEditEducationLevel(e.target.value)}
                >
                  <option value="">Select level…</option>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </DialogSection>

          <DialogSection title="Artificial intelligence">
            <div className="space-y-4">
              <Field label="What are you using AI for?">
                <div className="grid gap-2 sm:grid-cols-2">
                  {AI_USE_CASES.map((uc) => {
                    const checked = editAiUseCases.includes(uc.value);
                    return (
                      <label
                        key={uc.value}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                          checked ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-accent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-input accent-primary"
                          checked={checked}
                          onChange={(e) =>
                            setEditAiUseCases((prev) =>
                              e.target.checked ? [...prev, uc.value] : prev.filter((v) => v !== uc.value)
                            )
                          }
                        />
                        <span>{uc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="How long have you been using AI?">
                  <Select
                    aria-label="AI experience"
                    value={editAiExperience}
                    onChange={(e) => setEditAiExperience(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {AI_EXPERIENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="How often do you use AI?">
                  <Select
                    aria-label="AI frequency"
                    value={editAiFrequency}
                    onChange={(e) => setEditAiFrequency(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {AI_FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </DialogSection>

          {editError && <Alert>{editError}</Alert>}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => editDialogRef.current?.close()} disabled={editSaving}>
            Cancel
          </Button>
          <Button onClick={saveProfile} disabled={editSaving}>
            {editSaving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
