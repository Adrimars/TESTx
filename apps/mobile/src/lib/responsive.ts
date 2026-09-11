import { Platform, useWindowDimensions } from "react-native";

/**
 * Width of the centered content column on a wide (desktop-class) web viewport -
 * app/_layout.tsx caps the whole app shell to this so the deck doesn't stretch edge to
 * edge on a monitor. Exported rather than hardcoded again elsewhere: every gesture
 * threshold computed from "screen width" (swipe distance, drag-to-target radius, tilt)
 * has to agree with this same number on desktop web, or a threshold sized for a phone
 * screen becomes nearly unreachable inside a 480px column on a 1920px window.
 */
export const DESKTOP_MAX_WIDTH = 480;

/**
 * Width of the centered content column for the `(tabs)` group specifically (Dashboard,
 * Shop, Profile, Settings) on desktop web - these aren't the gesture deck, so they aren't
 * bound to `DESKTOP_MAX_WIDTH`'s phone-card sizing. `app/_layout.tsx`'s `DesktopWebShell`
 * picks between the two based on the current route.
 */
export const DESKTOP_TABS_MAX_WIDTH = 1040;

/**
 * Width of a self-contained form/settings screen's own centered column on desktop web,
 * narrower than `DESKTOP_TABS_MAX_WIDTH` - a short button list ((tabs)/settings.tsx) or a
 * demographic form (profile-onboarding.tsx) reads as unfinished stretched to the tabs
 * group's full width, but still benefits from more room than the deck's phone-width
 * `DESKTOP_MAX_WIDTH` (wide enough for `FormRow`'s side-by-side pairs to be worth pairing
 * at all). These screens sit inside the wider `DESKTOP_TABS_MAX_WIDTH` shell and re-cap
 * themselves to this, rather than getting their own entry in `app/_layout.tsx`'s route
 * list.
 */
export const DESKTOP_FORM_MAX_WIDTH = 640;

/** Below this window width, a web visitor is treated as a phone browser and every desktop
 * treatment (column capping, the tabs sidebar) stays off. Shared by `DesktopWebShell` and
 * `(tabs)/_layout.tsx`'s sidebar so the same window width switches both at once. */
export const DESKTOP_BREAKPOINT = 720;

/** True once a web viewport is wide enough to be treated as desktop - false on native and
 * on a narrow (phone-sized) web viewport. */
export function useIsDesktopWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
}

/**
 * The width gesture and layout math should use, in place of `useWindowDimensions().width`
 * directly. On native and on a narrow (phone-sized) web viewport this is just the real
 * window width, unchanged. On a wide web viewport it's capped to `DESKTOP_MAX_WIDTH` -
 * matching what the app shell actually renders at, since `useWindowDimensions` on
 * react-native-web reads `document.documentElement.clientWidth` (see Dimensions' own
 * `update()`), not any particular container's measured size, so it keeps reporting the
 * full monitor width regardless of how narrow the centered column is drawn.
 *
 * Only for the gesture deck's own cards - a screen capped to `DESKTOP_TABS_MAX_WIDTH`
 * instead (see `app/_layout.tsx`) needs its own `Math.min(width, DESKTOP_TABS_MAX_WIDTH)`
 * if it ever does width-based math, rather than reusing this.
 */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" ? Math.min(width, DESKTOP_MAX_WIDTH) : width;
}
