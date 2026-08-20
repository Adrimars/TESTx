"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, PasswordInput } from "@testx/ui";
import { AuthCard } from "@/components/auth-card";
import { useAuth } from "@/components/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsPending(true);
    try {
      const user = await login(email, password);
      router.push(user.evaluatorProfile ? "/dashboard" : "/onboarding");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AuthCard
      title="Evaluator login"
      description="Sign in to pick up your next test."
      footer={
        <>
          No account?{" "}
          <a href="/register" className="font-medium text-primary underline underline-offset-4">
            Register
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

        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
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
        Sign in with Google
      </Button>
    </AuthCard>
  );
}
