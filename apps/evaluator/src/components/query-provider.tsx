"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

/**
 * Mirrors apps/mobile's queryClient.ts conventions (30s staleTime, no retry on a 4xx —
 * it won't fix itself), with two Next.js-App-Router-specific differences: the client is
 * created once per component instance via useState rather than as a module-level
 * singleton (a module singleton would leak state across users/requests under SSR), and
 * `networkMode` is left at react-query's default ("online") rather than mobile's
 * "always" — that override exists there specifically because React Native's own
 * `onlineManager` believes the device is offline when it isn't and never self-corrects;
 * the browser's online detection has no such bug.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
