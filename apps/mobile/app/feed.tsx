import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { CardStack } from "@/components/cards/CardStack";
import { QuestionCard } from "@/components/cards/QuestionCard";
import { useDeck } from "@/lib/deck";
import { useSession } from "@/lib/session";
import { useEvaluatorTest, useNextTest } from "@/lib/test";
import { theme } from "@/lib/theme";

export default function FeedScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  // An explicit testId opens that test instead of whatever is next in line. Phase 11 owns
  // real feed orchestration; until then this is how a specific test gets opened, and it is
  // the seam a deep link into a test would use.
  const { testId } = useLocalSearchParams<{ testId?: string }>();
  const nextTest = useNextTest();
  const test = useEvaluatorTest(testId ?? nextTest.data?.id);
  const deck = useDeck(test.data?.questions ?? []);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  if ((!testId && nextTest.isPending) || test.isPending) {
    return (
      <Shell>
        <ActivityIndicator color={theme.colors.textSecondary} />
      </Shell>
    );
  }

  if ((!testId && nextTest.isError) || test.isError) {
    return (
      <Shell>
        <Text style={styles.title}>Could not load a test</Text>
        <Text style={styles.subtitle}>
          {(nextTest.error ?? test.error)?.message ?? "Something went wrong."}
        </Text>
        <Button label="Try again" onPress={() => void nextTest.refetch()} />
      </Shell>
    );
  }

  if (!test.data) {
    return (
      <Shell>
        <Text style={styles.title}>Nothing to answer right now</Text>
        <Text style={styles.subtitle}>New tests show up here as they open.</Text>
        <Button label="Profile" variant="secondary" onPress={() => router.push("/profile")} />
        <Button label="Sign out" variant="quiet" onPress={handleSignOut} />
      </Shell>
    );
  }

  if (deck.isComplete) {
    // Submission and the reward screen are phase 11; this is the seam they plug into.
    return (
      <Shell>
        <Text style={styles.title}>Deck finished</Text>
        <Text style={styles.subtitle}>
          {Object.keys(deck.answers).length} of {test.data.questionCount} answered. Submitting
          lands in phase 11.
        </Text>
        <Button label="Profile" variant="secondary" onPress={() => router.push("/profile")} />
      </Shell>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.testTitle} numberOfLines={1}>
          {test.data.title}
        </Text>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to the previous question"
            accessibilityState={{ disabled: !deck.canGoBack }}
            disabled={!deck.canGoBack}
            onPress={deck.back}
            style={({ pressed }) => [
              styles.backButton,
              !deck.canGoBack && styles.backDisabled,
              pressed && deck.canGoBack && styles.backPressed,
            ]}
          >
            <Text style={styles.backLabel}>{"← Back"}</Text>
          </Pressable>
          <Text style={styles.counter}>
            {deck.index + 1} / {test.data.questions.length}
          </Text>
        </View>
      </View>

      <CardStack
        items={test.data.questions}
        activeIndex={deck.index}
        keyExtractor={(question) => question.id}
        renderCard={(question, isActive) => (
          <QuestionCard question={question} isActive={isActive} onAnswer={deck.answer} />
        )}
      />
    </SafeAreaView>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.centered}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    gap: theme.spacing(1.5),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
  },
  testTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600", flexShrink: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1.5) },
  backButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceRaised,
  },
  backDisabled: { opacity: 0.35 },
  backPressed: { opacity: 0.7 },
  backLabel: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  counter: { color: theme.colors.textSecondary, fontSize: 14, fontVariant: ["tabular-nums"] },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, textAlign: "center" },
});
