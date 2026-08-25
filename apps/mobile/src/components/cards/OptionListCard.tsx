import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { resolveMediaUrl } from "@/lib/env";
import type { EvaluatorOption, EvaluatorQuestion } from "@/lib/test";
import { theme } from "@/lib/theme";

type OptionListCardProps = {
  question: EvaluatorQuestion;
  isActive: boolean;
  /** Ids currently chosen. Single select passes at most one. */
  selectedIds: string[];
  onToggle: (optionId: string) => void;
  /** Rendered under the options - the multi select's confirm bar in 10.4. */
  footer?: React.ReactNode;
};

/**
 * The card for questions with too many options to map onto a swipe: the card itself is
 * inert and the choice is a tap. Three or more options have no natural left/right
 * meaning, and inventing gestures for them would make the deck less predictable, not
 * more expressive.
 *
 * Media options are laid out as a grid of tiles rather than a list of rows, because the
 * whole point of an image option is being able to see it.
 */
export function OptionListCard({
  question,
  isActive,
  selectedIds,
  onToggle,
  footer,
}: OptionListCardProps) {
  const isMedia = question.mediaType != null && question.mediaType !== "TEXT";

  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{question.prompt}</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.list, isMedia && styles.grid]}
        showsVerticalScrollIndicator={false}
      >
        {question.options.map((option) => (
          <OptionShell
            key={option.id}
            option={option}
            isMedia={isMedia}
            selected={selectedIds.includes(option.id)}
            disabled={!isActive}
            onPress={() => onToggle(option.id)}
          />
        ))}
      </ScrollView>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

function OptionShell({
  option,
  isMedia,
  selected,
  disabled,
  onPress,
}: {
  option: EvaluatorOption;
  isMedia: boolean;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const url = resolveMediaUrl(option.media?.url ?? option.mediaUrl);
  const label = option.label ?? option.media?.fileName ?? "Option";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        isMedia ? styles.optionTile : styles.optionRow,
        selected && styles.optionSelected,
        pressed && !disabled && styles.optionPressed,
      ]}
    >
      {isMedia && url ? (
        <Image source={{ uri: url }} style={styles.tileImage} resizeMode="cover" />
      ) : null}

      <Text style={[styles.optionLabel, isMedia && styles.tileLabel]} numberOfLines={2}>
        {label}
      </Text>

      {selected ? (
        <View style={[styles.check, NO_TOUCH]}>
          <Text style={styles.checkMark}>{"✓"}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Inert overlay: the deprecated pointerEvents prop moved onto style. */
const NO_TOUCH = { pointerEvents: "none" } as const;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
    overflow: "hidden",
  },
  prompt: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    padding: theme.spacing(2),
  },
  scroll: { flex: 1 },
  list: {
    gap: theme.spacing(1),
    paddingHorizontal: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  option: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceBase,
    overflow: "hidden",
  },
  // 48 is the minimum comfortable touch target; rows can grow past it for long labels.
  optionRow: { minHeight: 48, justifyContent: "center", padding: theme.spacing(1.5) },
  optionTile: { width: "48%", aspectRatio: 0.85 },
  optionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.withAlpha(theme.colors.accent, 0.14),
  },
  optionPressed: { opacity: 0.75 },
  tileImage: { flex: 1, width: "100%" },
  optionLabel: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "500" },
  tileLabel: { padding: theme.spacing(1), fontSize: 13 },
  check: {
    position: "absolute",
    top: theme.spacing(1),
    right: theme.spacing(1),
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
  },
  checkMark: { color: theme.colors.accentContrast, fontSize: 14, fontWeight: "700" },
  footer: {
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderHairline,
  },
});
