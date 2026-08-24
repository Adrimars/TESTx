import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/session";
import { queryClient } from "@/lib/queryClient";
import { theme } from "@/lib/theme";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
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
            <Stack.Screen name="feed" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ title: "Profile" }} />
          </Stack>
        </SafeAreaProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
