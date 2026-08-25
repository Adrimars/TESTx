import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UpdateRequiredGate } from "@/components/UpdateRequiredGate";
import { SessionProvider } from "@/lib/session";
import { queryClient } from "@/lib/queryClient";
import { theme } from "@/lib/theme";

export default function RootLayout() {
  return (
    // Every gesture in the swipe engine is routed through this root view; without it
    // react-native-gesture-handler silently receives no touches on Android.
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <UpdateRequiredGate>
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
              <Stack.Screen name="home" options={{ headerShown: false }} />
              <Stack.Screen name="feed" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ title: "Profile" }} />
            </Stack>
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
