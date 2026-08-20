"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Combobox, Input } from "@testx/ui";
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
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Complete your profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Demographics</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Age</label>
                <Combobox options={AGE_OPTIONS} value={age} onChange={setAge} placeholder="Select age…" searchPlaceholder="Search age…" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Gender</label>
                <Select aria-label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="UNDISCLOSED">Prefer not to say</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Country</label>
                <Combobox options={COUNTRIES} value={country} onChange={handleCountryChange} placeholder="Select country…" searchPlaceholder="Search country…" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">City (optional)</label>
                <Combobox
                  options={cityOptions}
                  value={city}
                  onChange={setCity}
                  placeholder={country ? "Select city…" : "Select country first"}
                  searchPlaceholder="Search city…"
                  disabled={!country || cityOptions.length === 0}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Language</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Native Language (optional)</label>
                <Combobox
                  options={LANGUAGE_OPTIONS}
                  value={nativeLanguage}
                  onChange={handleNativeLanguageChange}
                  placeholder="Select language…"
                  searchPlaceholder="Search language…"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Foreign Languages (optional)</label>
                <MultiCombobox
                  options={foreignLanguageOptions}
                  value={foreignLanguages}
                  onChange={setForeignLanguages}
                  placeholder="Select languages…"
                  searchPlaceholder="Search language…"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Background</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Current Occupation (optional)</label>
                <Input
                  placeholder="e.g. Software Engineer, Student…"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Education Level (optional)</label>
                <Select aria-label="Education level" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                  <option value="">Select level…</option>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Artificial Intelligence</h3>
            <div className="grid gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">What are you using AI for? (optional, multiple)</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AI_USE_CASES.map((uc) => (
                    <label key={uc.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                        checked={aiUseCases.includes(uc.value)}
                        onChange={(e) =>
                          setAiUseCases((prev) =>
                            e.target.checked ? [...prev, uc.value] : prev.filter((v) => v !== uc.value)
                          )
                        }
                      />
                      <span className="text-sm">{uc.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">How long have you been using AI? (optional)</label>
                  <Select aria-label="AI experience" value={aiExperience} onChange={(e) => setAiExperience(e.target.value)}>
                    <option value="">Select…</option>
                    {AI_EXPERIENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">How often do you use AI? (optional)</label>
                  <Select aria-label="AI frequency" value={aiFrequency} onChange={(e) => setAiFrequency(e.target.value)}>
                    <option value="">Select…</option>
                    {AI_FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
            {isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
