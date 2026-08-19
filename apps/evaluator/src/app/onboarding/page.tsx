"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Combobox } from "@testx/ui";
import type { ComboboxOption } from "@testx/ui";
import { COUNTRIES, CITIES_BY_COUNTRY } from "@testx/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

const AGE_OPTIONS: ComboboxOption[] = Array.from({ length: 88 }, (_, i) => {
  const age = i + 13;
  return { value: String(age), label: String(age) };
});

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
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const cityOptions = useMemo(() => getCityOptions(country), [country]);

  function handleCountryChange(value: string) {
    setCountry(value);
    setCity("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!age) {
      setError("Please select your age.");
      return;
    }
    if (!country) {
      setError("Please select your country.");
      return;
    }
    setIsPending(true);
    try {
      await apiFetch("/evaluator/profile", {
        method: "PUT",
        body: JSON.stringify({
          age: Number(age),
          gender,
          country,
          city: city || undefined,
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
        <CardTitle>Complete demographic profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Age</label>
            <Combobox
              options={AGE_OPTIONS}
              value={age}
              onChange={setAge}
              placeholder="Select age…"
              searchPlaceholder="Search age…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Gender</label>
            <Select
              aria-label="Gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="UNDISCLOSED">Prefer not to say</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Country</label>
            <Combobox
              options={COUNTRIES}
              value={country}
              onChange={handleCountryChange}
              placeholder="Select country…"
              searchPlaceholder="Search country…"
            />
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

          {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
          <Button type="submit" className="sm:col-span-2" disabled={isPending}>
            {isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
