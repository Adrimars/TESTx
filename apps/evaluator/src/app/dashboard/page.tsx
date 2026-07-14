"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
} from "@testx/ui";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

type NextTestResponse = {
  test: {
    id: string;
    title: string;
    description: string | null;
    advisoryTimeMin: number | null;
    rewardPoints: number;
    questionCount: number;
  } | null;
};

type BalanceResponse = { balance: number };

export default function DashboardPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const loadBalance = useCallback(async () => {
    try {
      const result = await apiFetch<BalanceResponse>("/evaluator/balance");
      setBalance(result.balance);
    } catch {
      setBalance(user?.evaluatorProfile?.balance ?? 0);
    }
  }, [user]);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    setErrorMessage(null);
    setEmptyMessage(null);
    try {
      const result = await apiFetch<NextTestResponse>("/evaluator/next-test");
      if (!result.test) {
        setEmptyMessage("No tests available right now. Check back later!");
        return;
      }
      router.push(`/tests/${result.test.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load next test");
    } finally {
      setIsStarting(false);
    }
  }, [router]);

  const openWithdraw = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const closeWithdraw = useCallback(() => {
    dialogRef.current?.close();
    void refreshUser();
  }, [refreshUser]);

  const profile = user?.evaluatorProfile;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Start your next evaluation</CardTitle>
            <CardDescription>
              We match you to tests based on your profile and assign one at a time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full sm:w-auto"
              onClick={handleStart}
              disabled={isStarting}
            >
              {isStarting ? "Finding a test..." : "Start Next Test"}
            </Button>
            {emptyMessage && (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            )}
            {errorMessage && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Points balance</CardTitle>
            <CardDescription>Total earned across all valid evaluations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">
                {balance ?? "—"}
              </span>
              <span className="text-sm text-muted-foreground">pts</span>
            </div>
            <Button variant="secondary" onClick={openWithdraw}>
              Withdraw
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>Demographics drive your test assignments.</CardDescription>
          </div>
          <Button variant="ghost" onClick={() => router.push("/onboarding")}>
            Edit profile
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <ProfileField label="Email" value={user?.email ?? "—"} />
          <ProfileField
            label="Gender"
            value={profile?.gender ? formatGender(profile.gender) : "—"}
          />
          <ProfileField label="Country" value={profile?.country ?? "—"} />
          <ProfileField label="City" value={profile?.city ?? "—"} />
          <ProfileField
            label="Date of birth"
            value={profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : "—"}
          />
          <ProfileField
            label="Status"
            value={<Badge>{user?.isVerified ? "Verified" : "Pending"}</Badge>}
          />
        </CardContent>
      </Card>

      <Dialog ref={dialogRef}>
        <div className="space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Withdraw — Coming Soon</h2>
            <p className="text-sm text-muted-foreground">
              Cash-out will be available soon. Keep earning points by completing tests — your
              balance is preserved.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={closeWithdraw}>Got it</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function formatGender(gender: string) {
  const map: Record<string, string> = {
    MALE: "Male",
    FEMALE: "Female",
    OTHER: "Other",
    UNDISCLOSED: "Prefer not to say",
  };
  return map[gender] ?? gender;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}
