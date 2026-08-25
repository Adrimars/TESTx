import { StyleSheet, Text, View } from "react-native";
import { OptionListCard } from "./OptionListCard";
import { TwoOptionCard } from "./TwoOptionCard";
import type { DeckAnswer } from "@/lib/deck";
import type { EvaluatorQuestion } from "@/lib/test";
import { theme } from "@/lib/theme";

type QuestionCardProps = {
  question: EvaluatorQuestion;
  isActive: boolean;
  onAnswer: (answer: Omit<DeckAnswer, "timeSpentSeconds">) => void;
};

/**
 * Picks the card interaction for a question type. Each type gets its own component
 * rather than a branching mega-card, because the gesture is what differs between them.
 *
 * Attention checks and trap duplicates deliberately get no special treatment. They are
 * only worth anything while the evaluator cannot tell them apart from a real question,
 * so they route through exactly the same cards as everything else.
 */
export function QuestionCard({ question, isActive, onAnswer }: QuestionCardProps) {
  if (question.type === "SINGLE_SELECT") {
    // Two options map cleanly onto left and right; more than two do not.
    if (question.options.length === 2) {
      return (
        <TwoOptionCard
          question={question}
          isActive={isActive}
          onAnswer={(optionId) =>
            onAnswer({ questionId: question.id, selectedOptionIds: [optionId] })
          }
        />
      );
    }

    return (
      <OptionListCard
        question={question}
        isActive={isActive}
        selectedIds={[]}
        onToggle={(optionId) =>
          onAnswer({ questionId: question.id, selectedOptionIds: [optionId] })
        }
      />
    );
  }

  return <UnbuiltCard question={question} />;
}

/**
 * Placeholder for the question types whose cards land later in phase 10. It renders the
 * real question so the deck can still be walked end to end, and is removed type by type
 * as 10.3 through 10.6 land.
 */
function UnbuiltCard({ question }: { question: EvaluatorQuestion }) {
  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{question.prompt}</Text>
      <Text style={styles.note}>
        {question.type} with {question.options.length} options — card not built yet
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(3),
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  prompt: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  note: { color: theme.colors.textSecondary, fontSize: 13, textAlign: "center" },
});
