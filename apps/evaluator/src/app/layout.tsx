import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { EvaluatorShell } from "@/components/evaluator-shell";
import { QueryProvider } from "@/components/query-provider";
import { TestSessionProvider } from "@/components/test-session-provider";

export const metadata: Metadata = {
  title: "TESTx Evaluator",
  description: "Evaluator app for TESTx",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthProvider>
            <TestSessionProvider>
              <EvaluatorShell>{children}</EvaluatorShell>
            </TestSessionProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
