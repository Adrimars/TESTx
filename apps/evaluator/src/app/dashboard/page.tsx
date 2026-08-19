"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Combobox, Dialog, Input, Select } from "@testx/ui";
import type { ComboboxOption } from "@testx/ui";
import { COUNTRIES, CITIES_BY_COUNTRY } from "@testx/shared";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import type { NextTest } from "@/lib/test-types";

const AGE_OPTIONS: ComboboxOption[] = Array.from({ length: 88 }, (_, i) => {
  const age = i + 13;
  return { value: String(age), label: String(age) };
});

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
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const editCityOptions = useMemo(() => {
    const cities = CITIES_BY_COUNTRY[editCountry] ?? [];
    return cities.map((c) => ({ value: c, label: c }));
  }, [editCountry]);

  function openEditDialog() {
    const profile = user?.evaluatorProfile;
    setEditAge(profile?.age ? String(profile.age) : "");
    setEditGender(profile?.gender ?? "UNDISCLOSED");
    setEditCountry(profile?.country ?? "");
    setEditCity(profile?.city ?? "");
    setEditError("");
    editDialogRef.current?.showModal();
  }

  function handleEditCountryChange(value: string) {
    setEditCountry(value);
    setEditCity("");
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

      <Dialog ref={editDialogRef}>
        <div className="space-y-5 p-6">
          <h2 className="text-lg font-semibold">Edit Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
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
          {editError && <p className="text-sm text-destructive">{editError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => editDialogRef.current?.close()} disabled={editSaving}>Cancel</Button>
            <Button onClick={saveProfile} disabled={editSaving}>{editSaving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
