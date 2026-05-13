"use client";

import Link from "next/link";
import { Avatar } from "@testx/ui";
import { useAuth } from "./auth-provider";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tests", label: "Tests" },
  { href: "/media", label: "Media Library" },
  { href: "/users", label: "Users" },
  { href: "/templates", label: "Templates" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-card p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="mb-8 flex items-center justify-between lg:block">
          <div>
            <p className="text-xl font-bold tracking-tight">TESTx</p>
            <p className="text-xs text-muted-foreground">Admin console</p>
          </div>
          <Avatar className="lg:mt-4">{user?.email?.charAt(0).toUpperCase() ?? "A"}</Avatar>
        </div>
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-4 lg:p-8">{children}</main>
    </div>
  );
}
