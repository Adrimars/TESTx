import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { EvaluatorShell } from "@/components/evaluator-shell";

export const metadata: Metadata = {
  title: "TESTx Evaluator",
  description: "Evaluator app for TESTx",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <EvaluatorShell>{children}</EvaluatorShell>
        </AuthProvider>
      </body>
    </html>
  );
}
