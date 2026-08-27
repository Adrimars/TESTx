import { Alert } from "react-native";
import { Tabs, router } from "expo-router";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { LayoutGrid, Play, Settings, ShoppingBag, User } from "lucide-react-native";
import { prefetchNextTest } from "@/lib/test";
import { confirmLeavingUnsavedProfileChanges } from "@/lib/unsavedProfileChanges";
import { theme } from "@/lib/theme";

/**
 * Guards a tab press against leaving Profile with unsaved edits still on screen. Tab
 * switches don't unmount the screen being left (React Navigation keeps inactive tabs
 * mounted), so there's no `beforeRemove`-style event to hook here - `tabPress` is the
 * actual moment of intent, and `preventDefault` is what makes it cancellable at all.
 *
 * Registered on every tab except Profile's own: pressing Profile while already on
 * Profile has nothing to guard, and pressing it *from* another tab is entering, not
 * leaving. `confirmLeavingUnsavedProfileChanges` itself resolves immediately when
 * nothing is dirty, so this is a no-op the vast majority of the time.
 */
type MinimalTabNavigation = { navigate: (routeName: string) => void };

function guardedTabListeners({
  navigation,
  route,
}: {
  navigation: MinimalTabNavigation;
  route: { name: string };
}) {
  return {
    tabPress: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      void confirmLeavingUnsavedProfileChanges().then((canLeave) => {
        if (canLeave) navigation.navigate(route.name);
      });
    },
  };
}

/**
 * The Tests tab is a launcher, not a destination: pressing it never switches to a screen
 * of its own (tests.tsx is only the restored-state fallback) - it pushes straight into
 * /feed, the same full-screen deck the old Dashboard "Start" button opened.
 *
 * Whether there is anything to open is checked *before* pushing, not left for /feed to
 * discover: prefetchNextTest reuses whatever Dashboard already warmed on mount if it's
 * still fresh (same 30s default staleTime as every other query), so this is normally free.
 * Without this check, tapping Tests with nothing available used to push into /feed and
 * immediately bounce back to Dashboard via its own empty-state redirect - which reads as
 * "the Tests tab is broken", not as "there's nothing to answer". An alert and staying put
 * says the actual thing.
 */
function makeTestsTabListeners(queryClient: QueryClient) {
  return () => ({
    tabPress: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      void (async () => {
        const canLeave = await confirmLeavingUnsavedProfileChanges();
        if (!canLeave) return;

        try {
          const next = await prefetchNextTest(queryClient);
          if (!next) {
            Alert.alert(
              "No tests available",
              "There's nothing to answer right now. New tests appear here as they open."
            );
            return;
          }
        } catch {
          // Fetch failed (offline, server error) - push through anyway rather than
          // silently doing nothing; /feed has its own "Could not load a test / Try
          // again" screen for exactly this.
        }
        router.push("/feed");
      })();
    },
  });
}

/**
 * The persistent bottom tab bar: Dashboard/Shop/Tests/Profile/Settings, replacing the old
 * stack-of-screens-plus-footer-buttons pattern (`home.tsx`'s footer row, `profile.tsx`'s
 * own in-screen danger zone). `feed.tsx` and every auth/onboarding screen stay outside this
 * group as full-screen stack routes - a test in progress should never show tab chrome, which
 * is also why Tests is a launcher rather than a screen: see makeTestsTabListeners below.
 */
export default function TabsLayout() {
  const queryClient = useQueryClient();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceRaised,
          borderTopColor: theme.colors.borderHairline,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} strokeWidth={1.5} />,
        }}
        listeners={guardedTabListeners}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} strokeWidth={1.5} />,
        }}
        listeners={guardedTabListeners}
      />
      <Tabs.Screen
        name="tests"
        options={{
          title: "Tests",
          tabBarIcon: ({ color, size }) => <Play color={color} size={size} strokeWidth={1.5} />,
        }}
        listeners={makeTestsTabListeners(queryClient)}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.5} />,
        }}
        listeners={guardedTabListeners}
      />
    </Tabs>
  );
}
