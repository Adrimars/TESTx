import type { Metadata } from "next";
import "./globals.css";
import { AdminShell } from "@/components/admin-shell";
import { AuthProvider } from "@/components/auth-provider";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "TESTx Admin",
  description: "Admin console for TESTx",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthProvider>
            <AdminShell>{children}</AdminShell>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
