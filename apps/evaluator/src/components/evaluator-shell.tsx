"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Coins, LogOut } from "lucide-react";
import { Avatar, Button } from "@testx/ui";
import { useAuth } from "./auth-provider";

export function EvaluatorShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const balance = user?.evaluatorProfile?.balance ?? 0;
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      if (!isAuthPage) router.replace("/login");
      return;
    }
    if (!user.evaluatorProfile && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
    if (user.evaluatorProfile && pathname === "/onboarding") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, isAuthPage, pathname, router]);

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/testxlogo.jpg" alt="TESTx" className="h-7 w-auto" />
            <span className="hidden text-sm text-muted-foreground sm:inline">Evaluator workspace</span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold tabular-nums text-primary"
              title="Your point balance"
            >
              <Coins className="size-4" aria-hidden />
              {balance}
              <span className="font-normal">pts</span>
            </span>
            <Avatar className="size-9 bg-muted text-xs">
              {user?.email?.charAt(0).toUpperCase() ?? "E"}
            </Avatar>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign Out">
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
