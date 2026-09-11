import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { EvaluatorShell } from "@/components/evaluator-shell";
import { QueryProvider } from "@/components/query-provider";
import { TestSessionProvider } from "@/components/test-session-provider";
import { ThemeProvider, type Theme } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "TESTx Evaluator",
  description: "Evaluator app for TESTx",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieValue = (await cookies()).get("testx-theme")?.value;
  const initialTheme: Theme | null =
    cookieValue === "light" || cookieValue === "dark" ? cookieValue : null;

  return (
    <html lang="en" data-theme={initialTheme ?? undefined}>
      <body>
        <QueryProvider>
          <AuthProvider>
            <TestSessionProvider>
              <ThemeProvider initialTheme={initialTheme}>
                <EvaluatorShell>{children}</EvaluatorShell>
              </ThemeProvider>
            </TestSessionProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
