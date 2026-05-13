"use client";

import { Avatar, Badge } from "@testx/ui";
import { useAuth } from "./auth-provider";

export function EvaluatorShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const balance = user?.evaluatorProfile?.balance ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xl font-bold tracking-tight">TESTx</p>
            <p className="text-xs text-muted-foreground">Evaluator workspace</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge>{balance} pts</Badge>
            <Avatar>{user?.email?.charAt(0).toUpperCase() ?? "E"}</Avatar>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
