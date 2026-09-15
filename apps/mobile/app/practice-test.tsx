import { useEffect } from "react";
import { useRouter } from "expo-router";
import { PartyPopper } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { CardStack } from "@/components/cards/CardStack";
import { QuestionCard } from "@/components/cards/QuestionCard";
import { ProgressBar } from "@/components/feed/ProgressBar";
import { useDeck } from "@/lib/deck";
import type { EvaluatorQuestion } from "@/lib/test";
import { markGestureHintsSeen } from "@/lib/tutorial";
import { theme } from "@/lib/theme";

/**
 * One synthetic question per gesture the real deck can ask for, in the same order the
 * deck itself tends to introduce them: the universal gesture first, then the two novel
 * drag-to-target ones last, since those are the ones worth practicing before they count.
 *
 * These are never sent anywhere - no test, no session token, no submission - so the
 * content only has to be legible and harmless, not authored to any admin standard.
 * `mediaType: null` and every option's `mediaUrl: null` land on CardMedia's text-label
 * fallback, the same path a real question with no photo takes. Each step's own card
 * carries the instruction (TwoOptionCard's DragHint, OptionListCard's TapHint, etc.) -
 * there is no separate banner here narrating the gesture in words a second time.
 */
const PRACTICE_QUESTIONS: EvaluatorQuestion[] = [
  {
    id: "practice-two-option",
    testId: "practice",
    type: "SINGLE_SELECT",
    prompt: "Pizza or burger?",
    mediaType: null,
    mediaId: null,
    mediaUrl: null,
    order: 0,
    config: {},
    isReviewHidden: false,
    options: [
      { id: "practice-two-option-a", questionId: "practice-two-option", label: "🍕 Pizza", mediaId: null, order: 0, mediaUrl: null, media: null },
      { id: "practice-two-option-b", questionId: "practice-two-option", label: "🍔 Burger", mediaId: null, order: 1, mediaUrl: null, media: null },
    ],
  },
  {
    id: "practice-option-list",
    testId: "practice",
    type: "SINGLE_SELECT",
    prompt: "Pick your favorite season",
    mediaType: null,
    mediaId: null,
    mediaUrl: null,
    order: 1,
    config: {},
    isReviewHidden: false,
    options: [
      { id: "practice-option-list-a", questionId: "practice-option-list", label: "🌸 Spring", mediaId: null, order: 0, mediaUrl: null, media: null },
      { id: "practice-option-list-b", questionId: "practice-option-list", label: "☀️ Summer", mediaId: null, order: 1, mediaUrl: null, media: null },
      { id: "practice-option-list-c", questionId: "practice-option-list", label: "🍁 Autumn", mediaId: null, order: 2, mediaUrl: null, media: null },
      { id: "practice-option-list-d", questionId: "practice-option-list", label: "❄️ Winter", mediaId: null, order: 3, mediaUrl: null, media: null },
    ],
  },
  {
    id: "practice-multi-select",
    testId: "practice",
    type: "MULTI_SELECT",
    prompt: "Which of these do you enjoy?",
    mediaType: null,
    mediaId: null,
    mediaUrl: null,
    order: 2,
    config: {},
    isReviewHidden: false,
    options: [
      { id: "practice-multi-select-a", questionId: "practice-multi-select", label: "📚 Reading", mediaId: null, order: 0, mediaUrl: null, media: null },
      { id: "practice-multi-select-b", questionId: "practice-multi-select", label: "🎮 Gaming", mediaId: null, order: 1, mediaUrl: null, media: null },
      { id: "practice-multi-select-c", questionId: "practice-multi-select", label: "🎵 Music", mediaId: null, order: 2, mediaUrl: null, media: null },
      { id: "practice-multi-select-d", questionId: "practice-multi-select", label: "🏀 Sports", mediaId: null, order: 3, mediaUrl: null, media: null },
    ],
  },
  {
    id: "practice-rating",
    testId: "practice",
    type: "RATING",
    prompt: "How would you rate this?",
    mediaType: null,
    mediaId: null,
    mediaUrl: null,
    order: 3,
    config: {},
    isReviewHidden: false,
    options: [
      { id: "practice-rating-a", questionId: "practice-rating", label: "⭐ Sample photo", mediaId: null, order: 0, mediaUrl: null, media: null },
    ],
  },
  {
    id: "practice-ranking",
    testId: "practice",
    type: "RANKING",
    prompt: "Put these in your favorite order",
    mediaType: null,
    mediaId: null,
    mediaUrl: null,
    order: 4,
    config: {},
    isReviewHidden: false,
    options: [
      { id: "practice-ranking-a", questionId: "practice-ranking", label: "☕ Coffee", mediaId: null, order: 0, mediaUrl: null, media: null },
      { id: "practice-ranking-b", questionId: "practice-ranking", label: "🍵 Tea", mediaId: null, order: 1, mediaUrl: null, media: null },
      { id: "practice-ranking-c", questionId: "practice-ranking", label: "🧃 Juice", mediaId: null, order: 2, mediaUrl: null, media: null },
    ],
  },
];

/**
 * The mandatory, hands-on first-run walkthrough, run once between registration and the
 * very first Dashboard view (see register.tsx -> profile-onboarding.tsx -> here ->
 * /dashboard). Replaces the old slide-only FirstTestWalkthrough: every step is a real
 * card from the real deck components, driven by the actual gesture rather than a tap to
 * advance a slide, so what gets practiced here is exactly the muscle memory the first
 * real test will ask for.
 *
 * Deliberately reached only from that one signup path, not gated behind a persisted
 * "have I seen this" flag the way the old walkthrough was: a returning evaluator signing
 * in again, even on a new device, never passes through here, matching "only for first-time
 * new registrants" exactly rather than the looser "hasn't seen it on this install" the old
 * flag-based gate actually enforced. The tradeoff is that quitting mid-practice skips it
 * for good - Dashboard's own hasProfile check has already been satisfied by the time this
 * screen is reached, so relaunching goes straight past it.
 */
export default function PracticeTestScreen() {
  const router = useRouter();
  const deck = useDeck(PRACTICE_QUESTIONS);

  // Also retires the mid-test drag hints for Rating/Ranking (useGestureTutorial) - this
  // screen already demonstrated both gestures, so the narrower in-card hint on a real
  // Rating/Ranking question would only repeat what was just practiced. A side effect, not
  // something to fire during render.
  useEffect(() => {
    if (deck.isComplete) void markGestureHintsSeen();
  }, [deck.isComplete]);

  if (deck.isComplete) {
    // A held screen with its own explicit continue, not an auto-redirect like the real
    // deck's equivalent (RedirectToDashboard) - this is the one moment worth congratulating
    // rather than hopping straight past.
    return <PracticeCompleteScreen onContinue={() => router.replace("/dashboard")} />;
  }

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <ProgressBar total={PRACTICE_QUESTIONS.length} index={deck.index} />

      <View style={styles.header}>
        <Text style={styles.title}>Quick practice</Text>
        <Text style={styles.stepCount}>
          {deck.index + 1} of {PRACTICE_QUESTIONS.length}
        </Text>
      </View>

      <CardStack
        items={deck.questions}
        activeIndex={deck.index}
        keyExtractor={(question) => question.id}
        renderCard={(question, isActive) => (
          <QuestionCard question={question} isActive={isActive} onAnswer={deck.answer} />
        )}
      />
    </SafeAreaView>
  );
}

/** Shown once, after the last practice step - see PracticeTestScreen's own doc for why
 * this holds instead of redirecting straight through. */
function PracticeCompleteScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <View style={styles.completeContainer}>
        <PartyPopper size={48} color={theme.colors.accent} strokeWidth={1.5} />
        <Text style={styles.completeTitle}>Nice work!</Text>
        <Text style={styles.completeBody}>
          That's every kind of question you'll see. You're ready to start solving real
          tests and earning points.
        </Text>
        <Button label="Start solving tests" onPress={onContinue} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  completeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(3),
  },
  completeTitle: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700" },
  completeBody: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: theme.spacing(1),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  title: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" },
  stepCount: { color: theme.colors.textSecondary, fontSize: 13 },
});
