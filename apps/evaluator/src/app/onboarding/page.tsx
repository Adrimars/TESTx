"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

export default function OnboardingPage() {
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("UNDISCLOSED");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsPending(true);
    try {
      await apiFetch("/evaluator/profile", {
        method: "PUT",
        body: JSON.stringify({ dateOfBirth, gender, country, city: city || undefined }),
      });
      await refreshUser();
      router.push("/dashboard");
    } catch {
      setError("Failed to save profile. Please try again.");
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
          <Input
            type="date"
            aria-label="Date of birth"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />
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
          <Input
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
          />
          <Input
            placeholder="City (optional)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
          <Button type="submit" className="sm:col-span-2" disabled={isPending}>
            {isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
