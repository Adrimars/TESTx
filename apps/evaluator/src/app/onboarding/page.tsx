"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, Combobox, Field, Input, Select } from "@testx/ui";
import { MultiCombobox } from "@testx/ui";
import type { ComboboxOption } from "@testx/ui";
import { COUNTRIES, CITIES_BY_COUNTRY, LANGUAGES } from "@testx/shared";
import { EDUCATION_LEVELS, AI_USE_CASES, AI_EXPERIENCE_OPTIONS, AI_FREQUENCY_OPTIONS } from "@testx/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

const AGE_OPTIONS: ComboboxOption[] = Array.from({ length: 88 }, (_, i) => {
  const age = i + 13;
  return { value: String(age), label: String(age) };
});

const LANGUAGE_OPTIONS: ComboboxOption[] = LANGUAGES.map((l) => ({ value: l.value, label: l.label }));

function getCityOptions(countryCode: string): ComboboxOption[] {
  const cities = CITIES_BY_COUNTRY[countryCode] ?? [];
  return cities.map((c) => ({ value: c, label: c }));
}

/** One titled block of the profile form. */
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h2 className="text-section-title text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function OnboardingPage() {
  const { refreshUser } = useAuth();
  const router = useRouter();

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("UNDISCLOSED");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [foreignLanguages, setForeignLanguages] = useState<string[]>([]);
  const [occupation, setOccupation] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [aiUseCases, setAiUseCases] = useState<string[]>([]);
  const [aiExperience, setAiExperience] = useState("");
  const [aiFrequency, setAiFrequency] = useState("");

  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const cityOptions = useMemo(() => getCityOptions(country), [country]);

  const foreignLanguageOptions: ComboboxOption[] = useMemo(
    () => LANGUAGE_OPTIONS.filter((l) => l.value !== nativeLanguage),
    [nativeLanguage]
  );

  function handleCountryChange(value: string) {
    setCountry(value);
    setCity("");
  }

  function handleNativeLanguageChange(value: string) {
    setNativeLanguage(value);
    setForeignLanguages((prev) => prev.filter((l) => l !== value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!age) { setError("Please select your age."); return; }
    if (!country) { setError("Please select your country."); return; }
    setIsPending(true);
    try {
      await apiFetch("/evaluator/profile", {
        method: "PUT",
        body: JSON.stringify({
          age: Number(age),
          gender,
          country,
          city: city || undefined,
          nativeLanguage: nativeLanguage || undefined,
          foreignLanguages,
          occupation: occupation.trim() || undefined,
          educationLevel: educationLevel || undefined,
          aiUseCases,
          aiExperience: aiExperience || undefined,
          aiFrequency: aiFrequency || undefined,
        }),
      });
      await refreshUser();
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-page-title text-foreground">Complete your profile</h1>
        <p className="text-sm text-muted-foreground">
          Tests are matched to evaluators by these details. Only age and country are required — the rest
          helps us send you more relevant work.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormSection title="Demographics" description="Used to match you with the right tests.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Age">
                  <Combobox
                    options={AGE_OPTIONS}
                    value={age}
                    onChange={setAge}
                    placeholder="Select age…"
                    searchPlaceholder="Search age…"
                  />
                </Field>
                <Field label="Gender">
                  <Select aria-label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="UNDISCLOSED">Prefer not to say</option>
                  </Select>
                </Field>
                <Field label="Country">
                  <Combobox
                    options={COUNTRIES}
                    value={country}
                    onChange={handleCountryChange}
                    placeholder="Select country…"
                    searchPlaceholder="Search country…"
                  />
                </Field>
                <Field label="City" optional>
                  <Combobox
                    options={cityOptions}
                    value={city}
                    onChange={setCity}
                    placeholder={country ? "Select city…" : "Select country first"}
                    searchPlaceholder="Search city…"
                    disabled={!country || cityOptions.length === 0}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Language" description="Some tests are only shown to speakers of a given language.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Native language" optional>
                  <Combobox
                    options={LANGUAGE_OPTIONS}
                    value={nativeLanguage}
                    onChange={handleNativeLanguageChange}
                    placeholder="Select language…"
                    searchPlaceholder="Search language…"
                  />
                </Field>
                <Field label="Foreign languages" optional>
                  <MultiCombobox
                    options={foreignLanguageOptions}
                    value={foreignLanguages}
                    onChange={setForeignLanguages}
                    placeholder="Select languages…"
                    searchPlaceholder="Search language…"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Background" description="What you do outside of TESTx.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Current occupation" optional>
                  <Input
                    placeholder="e.g. Software Engineer, Student…"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                  />
                </Field>
                <Field label="Education level" optional>
                  <Select
                    aria-label="Education level"
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                  >
                    <option value="">Select level…</option>
                    {EDUCATION_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </FormSection>

            <FormSection title="Artificial intelligence" description="How you use AI today.">
              <div className="space-y-4">
                <Field label="What are you using AI for?" optional hint="Pick as many as apply.">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AI_USE_CASES.map((uc) => {
                      const checked = aiUseCases.includes(uc.value);
                      return (
                        <label
                          key={uc.value}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                            checked
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border hover:bg-accent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 rounded border-input accent-primary"
                            checked={checked}
                            onChange={(e) =>
                              setAiUseCases((prev) =>
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
                  <Field label="How long have you been using AI?" optional>
                    <Select
                      aria-label="AI experience"
                      value={aiExperience}
                      onChange={(e) => setAiExperience(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {AI_EXPERIENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="How often do you use AI?" optional>
                    <Select
                      aria-label="AI frequency"
                      value={aiFrequency}
                      onChange={(e) => setAiFrequency(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {AI_FREQUENCY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
            </FormSection>

            {error && <Alert>{error}</Alert>}

            <div className="flex justify-end border-t border-border pt-5">
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isPending}>
                {isPending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
