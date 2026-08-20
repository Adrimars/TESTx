"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Combobox, Dialog, Input, Select } from "@testx/ui";
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
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            {loading
              ? "Searching for a suitable test…"
              : nextTest
              ? nextTest.title
              : "No test available"}
          </CardTitle>
          {nextTest && nextTest.description && (
            <CardDescription>{nextTest.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Please wait…</p>
          )}
          {!loading && nextTest && (
            <>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{nextTest.questionCount} questions</span>
                {nextTest.advisoryTimeMin && (
                  <span>~{nextTest.advisoryTimeMin} min</span>
                )}
                <span>{nextTest.rewardPoints} points</span>
              </div>
              <Button
                className="w-full sm:w-auto min-h-[44px]"
                onClick={() => router.push(`/tests/${nextTest.id}`)}
              >
                Start Test
              </Button>
            </>
          )}
          {!loading && nextTest === null && (
            <>
              <p className="text-sm text-muted-foreground">
                Currently, no suitable tests are available.
              </p>
              <Button
                variant="secondary"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={fetchNextTest}
                disabled={loading}
              >
                Search for suitable tests
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">{balance}</CardTitle>
            <CardDescription>Points earned</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" disabled className="min-h-[44px]">
              Withdraw — Coming Soon
            </Button>
          </CardContent>
        </Card>

        {user?.evaluatorProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your profile</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div className="space-y-1">
                <p>{user.email}</p>
                <p>
                  {user.evaluatorProfile.gender} · {user.evaluatorProfile.country}
                  {user.evaluatorProfile.city ? ` · ${user.evaluatorProfile.city}` : ""}
                </p>
              </div>
              <Button variant="secondary" className="w-full min-h-[44px]" onClick={openEditDialog}>
                Edit Profile
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog ref={editDialogRef} className="w-full max-w-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">Edit Profile</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => editDialogRef.current?.close()} disabled={editSaving}>Cancel</Button>
            <Button onClick={saveProfile} disabled={editSaving}>{editSaving ? "Saving…" : "Save"}</Button>
          </div>
        </div>

        <div className="space-y-6 p-6 max-h-[75vh] overflow-y-auto">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Demographics</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Age</label>
                <Combobox options={AGE_OPTIONS} value={editAge} onChange={setEditAge} placeholder="Select age…" searchPlaceholder="Search age…" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Gender</label>
                <Select aria-label="Gender" value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="UNDISCLOSED">Prefer not to say</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Country</label>
                <Combobox options={COUNTRIES} value={editCountry} onChange={handleEditCountryChange} placeholder="Select country…" searchPlaceholder="Search country…" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">City</label>
                <Combobox
                  options={editCityOptions}
                  value={editCity}
                  onChange={setEditCity}
                  placeholder={editCountry ? "Select city…" : "Select country first…"}
                  searchPlaceholder="Search city…"
                  disabled={!editCountry || editCityOptions.length === 0}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Language</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Native Language</label>
                <Combobox
                  options={LANGUAGE_OPTIONS}
                  value={editNativeLanguage}
                  onChange={handleEditNativeLanguageChange}
                  placeholder="Select language…"
                  searchPlaceholder="Search language…"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Foreign Languages</label>
                <MultiCombobox
                  options={editForeignLanguageOptions}
                  value={editForeignLanguages}
                  onChange={setEditForeignLanguages}
                  placeholder="Select languages…"
                  searchPlaceholder="Search language…"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Background</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Current Occupation</label>
                <Input
                  placeholder="e.g. Software Engineer, Student…"
                  value={editOccupation}
                  onChange={(e) => setEditOccupation(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Education Level</label>
                <Select aria-label="Education level" value={editEducationLevel} onChange={(e) => setEditEducationLevel(e.target.value)}>
                  <option value="">Select level…</option>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Artificial Intelligence</h3>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">What are you using AI for?</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {AI_USE_CASES.map((uc) => (
                  <label key={uc.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                      checked={editAiUseCases.includes(uc.value)}
                      onChange={(e) =>
                        setEditAiUseCases((prev) =>
                          e.target.checked ? [...prev, uc.value] : prev.filter((v) => v !== uc.value)
                        )
                      }
                    />
                    <span className="text-sm">{uc.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">How long have you been using AI?</label>
                <Select aria-label="AI experience" value={editAiExperience} onChange={(e) => setEditAiExperience(e.target.value)}>
                  <option value="">Select…</option>
                  {AI_EXPERIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">How often do you use AI?</label>
                <Select aria-label="AI frequency" value={editAiFrequency} onChange={(e) => setEditAiFrequency(e.target.value)}>
                  <option value="">Select…</option>
                  {AI_FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </section>

          {editError && <p className="text-sm text-destructive">{editError}</p>}
        </div>
      </Dialog>
    </div>
  );
}
