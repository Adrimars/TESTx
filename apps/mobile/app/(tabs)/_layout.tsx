import { Tabs } from "expo-router";
import { LayoutGrid, Settings, ShoppingBag, User } from "lucide-react-native";
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
 * The persistent bottom tab bar (16.4): Dashboard/Shop/Profile/Settings, replacing the old
 * stack-of-screens-plus-footer-buttons pattern (`home.tsx`'s footer row, `profile.tsx`'s
 * own in-screen danger zone). `feed.tsx` and every auth/onboarding screen stay outside this
 * group as full-screen stack routes - a test in progress should never show tab chrome.
 */
export default function TabsLayout() {
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
