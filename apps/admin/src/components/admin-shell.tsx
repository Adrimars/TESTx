"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FileText, FolderOpen, LayoutDashboard, LogOut, Users } from "lucide-react";
import { Avatar, Button, cn } from "@testx/ui";
import { useAuth } from "./auth-provider";

const navigation = [
  {
    group: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tests", label: "Tests", icon: FileText },
    ],
  },
  {
    group: "Library",
    items: [
      { href: "/media", label: "Media Library", icon: FolderOpen },
      { href: "/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    group: "People",
    items: [{ href: "/users", label: "Users", icon: Users }],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  useEffect(() => {
    if (isLoading || isAuthPage) return;
    if (!user) router.replace("/login");
  }, [user, isLoading, isAuthPage, router]);

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col gap-6 border-b border-border bg-card p-4 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <img src="/testxlogo.jpg" alt="TESTx" className="h-7 w-auto" />
            <p className="mt-1 text-xs text-muted-foreground">Admin console</p>
          </div>
        </div>

        <nav className="flex gap-4 overflow-x-auto lg:flex-col lg:gap-5 lg:overflow-visible">
          {navigation.map((section) => (
            <div key={section.group} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
              <p className="hidden px-2 pb-1.5 text-meta uppercase text-muted-foreground lg:block">
                {section.group}
              </p>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-3 border-t border-border pt-4 lg:mt-auto">
          <Avatar className="size-9 shrink-0 text-xs">
            {user?.email?.charAt(0).toUpperCase() ?? "A"}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={user?.email}>
              {user?.email ?? "Admin"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign Out" className="px-2">
            <LogOut className="size-4" aria-hidden />
          </Button>
        </div>
      </aside>

      <main className="p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
