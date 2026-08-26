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

const WALKTHROUGH_KEY = "testx.hasSeenFirstTestWalkthrough";

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

export type WalkthroughState = {
  /** True only while the first-run walkthrough should be on screen. */
  shouldShow: boolean;
  /**
   * Marks the walkthrough seen after a full run-through, which also retires the
   * per-type Rating/Ranking gesture hints (10.8/12.1) - the walkthrough already
   * demonstrated both, so the narrower mid-test hints would just repeat it.
   */
  complete: () => void;
  /**
   * Marks only the walkthrough itself seen, leaving the per-type gesture hints as a
   * fallback for whichever novel gesture the evaluator actually meets first - an
   * evaluator who skips the walkthrough still gets taught drag-to-target once, just at
   * the point they need it instead of up front.
   */
  skip: () => void;
};

/**
 * Decides whether to show the first-run, Instagram-style walkthrough that covers every
 * question type before a brand-new evaluator's very first test (15.7) - unlike
 * `useGestureTutorial`, which is scoped to one card type and shown mid-test, this is a
 * one-time, whole-app orientation shown once at the entry point into the feed.
 *
 * Same start-closed-then-open-after-read shape as `useGestureTutorial`, for the same
 * reason: flashing the walkthrough for a frame at every returning evaluator before the
 * stored flag is read back would be worse than showing it a moment late for the one
 * evaluator who has genuinely never seen it.
 */
export function useFirstTestWalkthrough(): WalkthroughState {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const seen = await readFlag(WALKTHROUGH_KEY);
      if (!cancelled && !seen) setShouldShow(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const complete = useCallback(() => {
    setShouldShow(false);
    void writeFlag(WALKTHROUGH_KEY);
    void writeFlag(KEYS.rating);
    void writeFlag(KEYS.ranking);
  }, []);

  const skip = useCallback(() => {
    setShouldShow(false);
    void writeFlag(WALKTHROUGH_KEY);
  }, []);

  return { shouldShow, complete, skip };
}
