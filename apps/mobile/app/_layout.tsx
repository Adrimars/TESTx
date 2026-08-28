import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UpdateRequiredGate } from "@/components/UpdateRequiredGate";
import { SessionProvider, useSession } from "@/lib/session";
import { queryClient } from "@/lib/queryClient";
import { RegistrationDraftProvider } from "@/lib/registrationDraft";
import { retryPendingSubmissionOnce } from "@/lib/submissionQueue";
import { theme } from "@/lib/theme";

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
            </RegistrationDraftProvider>
            </UpdateRequiredGate>
          </SafeAreaProvider>
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
