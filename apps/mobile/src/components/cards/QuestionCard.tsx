import { StyleSheet, Text, View } from "react-native";
import { MultiSelectCard } from "./MultiSelectCard";
import { OptionListCard } from "./OptionListCard";
import { RankingCard } from "./RankingCard";
import { RatingCard } from "./RatingCard";
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

  if (question.type === "MULTI_SELECT") {
    return (
      <MultiSelectCard
        question={question}
        isActive={isActive}
        onAnswer={(optionIds) =>
          onAnswer({ questionId: question.id, selectedOptionIds: optionIds })
        }
      />
    );
  }

  if (question.type === "RATING") {
    return (
      <RatingCard
        question={question}
        isActive={isActive}
        onAnswer={(ratingValue) =>
          onAnswer({ questionId: question.id, selectedOptionIds: [], ratingValue })
        }
      />
    );
  }

  if (question.type === "RANKING") {
    return (
      <RankingCard
        question={question}
        isActive={isActive}
        onAnswer={(orderedOptionIds) =>
          onAnswer({ questionId: question.id, selectedOptionIds: orderedOptionIds })
        }
      />
    );
  }

  return <UnsupportedCard question={question} />;
}

/**
 * Fallback for a question type this build has no card for.
 *
 * Every type the API can currently return is handled above, so reaching this means the
 * server has shipped a new one - which the minimum-version gate is meant to catch on
 * launch. This is the second line of that defence: if a build ever does meet a question
 * it cannot render, it says so and leaves the rest of the deck usable, rather than
 * crashing partway through a test the evaluator has already spent time on.
 */
function UnsupportedCard({ question }: { question: EvaluatorQuestion }) {
  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <Text style={styles.note}>
          This version of the app cannot show this question. Update TESTx to answer it.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { flex: 1, ...theme.card.shadow },
  card: {
    ...theme.card.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(3),
  },
  prompt: {
    color: theme.colors.textPrimary,
    ...theme.type.prompt,
    textAlign: "center",
  },
  note: { color: theme.colors.textSecondary, fontSize: 13, textAlign: "center" },
});
