import { useEffect } from "react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AlertHost } from "@/components/AlertHost";
import { UpdateRequiredGate } from "@/components/UpdateRequiredGate";
import { SessionProvider, useSession } from "@/lib/session";
import { queryClient } from "@/lib/queryClient";
import { DESKTOP_MAX_WIDTH, DESKTOP_TABS_MAX_WIDTH, useIsDesktopWeb } from "@/lib/responsive";
import { RegistrationDraftProvider } from "@/lib/registrationDraft";
import { retryPendingSubmissionOnce } from "@/lib/submissionQueue";
import { theme } from "@/lib/theme";

/** Routes that get the wider desktop column (`DESKTOP_TABS_MAX_WIDTH`) instead of the
 * gesture deck's narrower one - the `(tabs)` group (its Expo Router group segment is
 * dropped from the URL) plus profile-onboarding, a demographic form shaped like
 * `(tabs)/profile.tsx`'s and squeezed the same way at the deck's width. Listed here so
 * `DesktopWebShell` can tell them apart from everything else - see its own doc for why.
 * Kept in one place rather than duplicated, since `(tabs)/_layout.tsx`'s sidebar has no
 * separate need to know this same list (it only ever renders its own five links). */
const WIDE_DESKTOP_ROUTES = ["/dashboard", "/shop", "/tests", "/profile", "/settings", "/profile-onboarding"];

/**
 * Desktop web gets the same phone-shaped app, run in a centered column rather than
 * stretched edge to edge across a monitor - this app was designed as a single mobile
 * layout throughout (prd.md §16), not a responsive one, so "fill the window" would
 * misread as broken rather than as a deliberate desktop layout. Native and narrow (phone)
 * web are untouched: this only ever renders once `useIsDesktopWeb` is true, so a phone
 * browser gets exactly what it got before this existed.
 *
 * `WIDE_DESKTOP_ROUTES` gets a wider column than everywhere else - none of them are the
 * gesture deck, and a form/dashboard/catalog reads as unfinished rather than deliberate
 * squeezed into a phone-width column on a monitor. Everywhere else (login/register/the
 * Aydinlatma Metni gate, the deck itself) stays at the narrower `DESKTOP_MAX_WIDTH` -
 * every gesture threshold computed from "screen width" (swipe distance, drag-to-target
 * radius) has to size itself off that same number, via `useContentWidth` in
 * lib/responsive.ts, which every card in the deck uses instead of reading
 * `useWindowDimensions` directly.
 */
function DesktopWebShell({ children }: { children: ReactNode }) {
  const isDesktopWeb = useIsDesktopWeb();
  const pathname = usePathname();
  if (!isDesktopWeb) return <>{children}</>;

  const isWideRoute = WIDE_DESKTOP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const maxWidth = isWideRoute ? DESKTOP_TABS_MAX_WIDTH : DESKTOP_MAX_WIDTH;

  return (
    <View style={styles.desktopBackdrop}>
      <View style={[styles.desktopColumn, { maxWidth }]}>{children}</View>
    </View>
  );
}

/**
 * A test finished last session can still have its submission queued if the app was
 * killed or offline before it confirmed (plan.md 11.4) - one silent attempt here,
 * not tied to any screen, is the "retry on next launch" half of that.
 *
 * Waits for the signed-in user to be known (16.10) rather than firing at launch the
 * way this used to: `retryPendingSubmissionOnce` reads a per-user storage key, so
 * firing before `initializing` resolves - or with no user at all - has nothing to
 * scope the read to.
 */
function PendingSubmissionRetry() {
  const { user, initializing } = useSession();

  useEffect(() => {
    if (initializing || !user) return;
    void retryPendingSubmissionOnce(queryClient, user.id);
  }, [initializing, user]);

  return null;
}

export default function RootLayout() {
  return (
    // Every gesture in the swipe engine is routed through this root view; without it
    // react-native-gesture-handler silently receives no touches on Android.
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <PendingSubmissionRetry />
          <SafeAreaProvider>
            <StatusBar style="light" />
            <UpdateRequiredGate>
            <RegistrationDraftProvider>
            <DesktopWebShell>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: theme.colors.surfaceBase },
                headerTintColor: theme.colors.textPrimary,
                contentStyle: { backgroundColor: theme.colors.surfaceBase },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="register" options={{ title: "Create account" }} />
              <Stack.Screen name="aydinlatma" options={{ title: "Aydinlatma Metni" }} />
              <Stack.Screen
                name="profile-onboarding"
                options={{ title: "Your profile", headerBackVisible: false }}
              />
              <Stack.Screen name="practice-test" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="feed" options={{ headerShown: false }} />
            </Stack>
            </DesktopWebShell>
            </RegistrationDraftProvider>
            </UpdateRequiredGate>
            <AlertHost />
          </SafeAreaProvider>
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  desktopBackdrop: {
    flex: 1,
    alignItems: "center",
    backgroundColor: theme.colors.surfaceBase,
  },
  desktopColumn: {
    flex: 1,
    width: "100%",
  },
});
