import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Which novel gestures the evaluator has been shown. Swipe-left/right needs no
 * explanation - it is universal muscle memory - but drag-to-target is a gesture most
 * people have never met, and an unexplained first encounter produces careless answers,
 * which is exactly the signal the quality service is trying to read.
 */
export type TutorialGesture = "rating" | "ranking";

const KEYS: Record<TutorialGesture, string> = {
  rating: "testx.hasSeenRatingTutorial",
  ranking: "testx.hasSeenRankingTutorial",
};

/**
 * Device-local by design, not server state. It tracks whether this install has explained
 * itself, which is a property of the app on this phone rather than of the account - and
 * keeping it off the server means it costs no request on the path into a test.
 */
const isWeb = Platform.OS === "web";

function webStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

async function readFlag(key: string): Promise<boolean> {
  if (isWeb) return webStorage()?.getItem(key) === "1";
  try {
    return (await SecureStore.getItemAsync(key)) === "1";
  } catch {
    return false;
  }
}

async function writeFlag(key: string): Promise<void> {
  if (isWeb) {
    webStorage()?.setItem(key, "1");
    return;
  }
  await SecureStore.setItemAsync(key, "1").catch(() => undefined);
}

export type TutorialState = {
  /** True only while the hint should be on screen. */
  shouldShow: boolean;
  /** Marks the gesture explained; the hint never returns. */
  dismiss: () => void;
};

/**
 * Decides whether to explain a gesture on this card.
 *
 * Starts closed and only opens once the stored flag has been read. Showing the hint
 * first and hiding it a frame later would flash an overlay at every evaluator who has
 * already seen it, which is worse than being slightly late for the one who has not.
 */
export function useGestureTutorial(gesture: TutorialGesture, enabled: boolean): TutorialState {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const seen = await readFlag(KEYS[gesture]);
      if (!cancelled && !seen) setShouldShow(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [gesture, enabled]);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    void writeFlag(KEYS[gesture]);
  }, [gesture]);

  return { shouldShow, dismiss };
}

/**
 * Retires the mid-test drag hints for both Rating and Ranking at once. Called when the
 * mandatory hands-on practice test (see app/practice-test.tsx) completes: it already
 * demonstrated both gestures for real, so the narrower in-card hint on a real Rating or
 * Ranking question later would only repeat what was just practiced.
 */
export async function markGestureHintsSeen(): Promise<void> {
  await Promise.all([writeFlag(KEYS.rating), writeFlag(KEYS.ranking)]);
}
