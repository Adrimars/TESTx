"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, PasswordInput } from "@testx/ui";
import { AuthCard } from "@/components/auth-card";
import { useAuth } from "@/components/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // One toggle drives both password fields, as it did before.
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsPending(true);
    try {
      await register(email, password);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AuthCard
      title="Create evaluator account"
      description="Takes a minute — then you can start earning points."
      footer={
        <>
          Already have an account?{" "}
          <a href="/login" className="font-medium text-primary underline underline-offset-4">
            Sign in
          </a>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            visible={showPassword}
            onVisibleChange={setShowPassword}
          />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword">
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
            visible={showPassword}
            onVisibleChange={setShowPassword}
          />
        </Field>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Creating account…" : "Register"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        className="w-full"
        variant="secondary"
        onClick={() => {
          window.location.href = `${API_URL}/auth/google`;
        }}
      >
        Continue with Google
      </Button>
    </AuthCard>
  );
}
