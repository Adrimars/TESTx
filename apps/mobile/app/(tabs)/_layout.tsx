import type { ComponentType } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, router, usePathname } from "expo-router";
import { LayoutGrid, Play, Settings, ShoppingBag, User } from "lucide-react-native";
import { confirmLeavingUnsavedProfileChanges } from "@/lib/unsavedProfileChanges";
import { useIsDesktopWeb } from "@/lib/responsive";
import { theme } from "@/lib/theme";

type NavIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

type NavItem = {
  /** Matches both the `Tabs.Screen` name below and `usePathname()`'s leading segment. */
  name: "dashboard" | "shop" | "tests" | "profile" | "settings";
  title: string;
  Icon: NavIcon;
  /** Tests has no screen of its own to switch to - see `testsTabListeners`' own doc. */
  isLauncher?: boolean;
};

/** Shared between the native tab bar (below) and `DesktopSidebar` so the two never drift
 * out of sync with each other - one source of icons/titles/order for both. */
const NAV_ITEMS: NavItem[] = [
  { name: "dashboard", title: "Dashboard", Icon: LayoutGrid },
  { name: "shop", title: "Shop", Icon: ShoppingBag },
  { name: "tests", title: "Tests", Icon: Play, isLauncher: true },
  { name: "profile", title: "Profile", Icon: User },
  { name: "settings", title: "Settings", Icon: Settings },
];

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
 * Deliberately does NOT wait on a network call before navigating. An earlier version
 * checked `/evaluator/next-test` here first so it could show an alert when nothing was
 * available - but that made the whole tab hostage to that one request: with the API
 * unreachable the press awaited a promise that never settled, so the tab did nothing at
 * all, forever, with no spinner and no error. A dead button is a far worse answer than a
 * screen that loads and then explains itself.
 *
 * /feed owns every one of those states instead (loading, error+retry, and "no tests
 * available"), which it has to anyway - it is reachable from a deep link and from
 * finishing a test, not just from this tab.
 */
function goToTests() {
  void confirmLeavingUnsavedProfileChanges().then((canLeave) => {
    if (canLeave) router.push("/feed");
  });
}

function testsTabListeners() {
  return {
    tabPress: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      goToTests();
    },
  };
}

/**
 * Desktop's stand-in for the bottom tab bar (below, hidden via `tabBarStyle` once this is
 * showing) - the same five destinations as a vertical list down the left edge instead of
 * across the bottom, which is what a "tab bar" reads as on a wide window rather than a
 * phone screen. Drives the same `Tabs` navigator underneath via `router.navigate`, so the
 * active screen, its mounted/unmounted state, and the unsaved-changes guard are all
 * exactly what pressing the (hidden) native tab would have done - this is a different
 * control surface for the same navigation, not a second one.
 */
function DesktopSidebar() {
  const pathname = usePathname();

  function go(item: NavItem) {
    if (item.isLauncher) {
      goToTests();
      return;
    }
    if (pathname === `/${item.name}`) return;
    void confirmLeavingUnsavedProfileChanges().then((canLeave) => {
      if (canLeave) router.navigate(`/${item.name}`);
    });
  }

  return (
    <View style={styles.sidebar}>
      <Image
        source={require("../../assets/images/testx-logo.png")}
        style={styles.sidebarLogo}
        resizeMode="contain"
      />
      <View style={styles.sidebarNav}>
        {NAV_ITEMS.map((item) => {
          const active = !item.isLauncher && pathname === `/${item.name}`;
          return (
            <Pressable
              key={item.name}
              onPress={() => go(item)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.sidebarItem,
                active && styles.sidebarItemActive,
                pressed && styles.sidebarItemPressed,
              ]}
            >
              <item.Icon
                color={active ? theme.colors.accent : theme.colors.textSecondary}
                size={20}
                strokeWidth={1.5}
              />
              <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The persistent navigation for Dashboard/Shop/Tests/Profile/Settings, replacing the old
 * stack-of-screens-plus-footer-buttons pattern (`home.tsx`'s footer row, `profile.tsx`'s
 * own in-screen danger zone). `feed.tsx` and every auth/onboarding screen stay outside this
 * group as full-screen stack routes - a test in progress should never show tab chrome, which
 * is also why Tests is a launcher rather than a screen: see `goToTests`'s own doc.
 *
 * Renders as a bottom tab bar on native and narrow web (unchanged from before desktop had
 * its own treatment), and as `DesktopSidebar` on desktop web - the underlying `Tabs`
 * navigator and its screens are the same either way, only which control drives it changes.
 */
export default function TabsLayout() {
  const isDesktopWeb = useIsDesktopWeb();

  return (
    <View style={isDesktopWeb ? styles.desktopRow : styles.flexFill}>
      {isDesktopWeb ? <DesktopSidebar /> : null}
      <View style={styles.flexFill}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.accent,
            tabBarInactiveTintColor: theme.colors.textSecondary,
            // The sidebar above is this same navigator's tab bar in every way that
            // matters (see its own doc) - hiding the native one rather than running both
            // is what keeps there being exactly one source of truth for "which tab is
            // active" and exactly one navigator handling the press.
            tabBarStyle: isDesktopWeb
              ? styles.hiddenTabBar
              : { backgroundColor: theme.colors.surfaceRaised, borderTopColor: theme.colors.borderHairline },
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
            listeners={testsTabListeners}
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
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 232;

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  desktopRow: { flex: 1, flexDirection: "row" },
  hiddenTabBar: { display: "none" },
  sidebar: {
    width: SIDEBAR_WIDTH,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(2),
    gap: theme.spacing(3),
    backgroundColor: theme.colors.surfaceRaised,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.colors.borderHairline,
  },
  sidebarLogo: { width: 110, height: 30, marginLeft: theme.spacing(1) },
  sidebarNav: { gap: theme.spacing(0.5) },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: 12,
  },
  sidebarItemActive: { backgroundColor: theme.withAlpha(theme.colors.accent, 0.14) },
  sidebarItemPressed: { opacity: 0.75 },
  sidebarLabel: { color: theme.colors.textSecondary, fontSize: 15, fontWeight: "600" },
  sidebarLabelActive: { color: theme.colors.textPrimary },
});
