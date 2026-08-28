"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@testx/ui";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

/**
 * Publicly reachable account-deletion page.
 *
 * Google Play requires a deletion path that works from outside the app, for
 * someone who has already uninstalled it, so this page must stay reachable
 * without signing in - it explains the process either way, and offers the
 * one-click path to anyone with a live session.
 *
 * See appstore-playstore-compliance-research.md section 3.
 */
export default function DeleteAccountPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/users/me", { method: "DELETE" });
      await refreshUser();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the account.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Delete your TESTx account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Deleting your account permanently removes your login, your evaluator profile
            and your answer history. Points you have earned are removed with it. This
            cannot be undone.
          </p>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          {user ? (
            confirming ? (
              <div className="space-y-3">
                <Alert tone="danger">
                  This will permanently delete the account for {user.email}.
                </Alert>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={handleDelete} disabled={busy}>
                    {busy ? "Deleting..." : "Yes, delete my account"}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Delete my account
              </Button>
            )
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Sign in to delete your account immediately. You can also delete it from the
                TESTx mobile app under Profile.
              </p>
              <Button onClick={() => router.push("/login")}>Sign in to continue</Button>
              <p>
                If you can no longer sign in, email{" "}
                <a
                  className="underline"
                  href="mailto:support@testx.app?subject=Account%20deletion%20request"
                >
                  support@testx.app
                </a>{" "}
                from your registered address and we will delete the account for you.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
