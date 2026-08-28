import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      /**
       * React Query's default `networkMode: "online"` pauses a query instead of failing
       * it whenever its own `onlineManager` believes the device is offline - and in this
       * app's runtime that belief is wrong and never corrects itself. A request that
       * cannot reach the API (server down, wrong LAN address, dropped wifi) fires exactly
       * once, then the query sits in `pending` forever: no retry, no error, and no
       * recovery even after the API comes back, because no browser/RN "online" event ever
       * fires to un-pause it. Observed directly - every screen just spins indefinitely
       * and the "Could not load ... / Try again" states below never render.
       *
       * "always" takes that judgement out of it: the fetch is attempted regardless, the
       * retry policy below applies, and a genuine failure ends as a real error the UI can
       * show and the evaluator can retry.
       */
      networkMode: "always",
      retry: (failureCount, error) => {
        // A 401 is already handled by apiFetch's refresh-and-retry; anything
        // else in the 4xx range will not fix itself on a retry either.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      // Same reasoning as queries above - a paused mutation is a submit that silently
      // never happens, which the offline submission queue (submissionQueue.ts) is already
      // built to handle properly through its own retry/backoff path.
      networkMode: "always",
    },
  },
});
