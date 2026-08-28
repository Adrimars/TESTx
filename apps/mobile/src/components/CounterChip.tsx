import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { CARD_REJECT_SPRING } from "@/lib/motion";
import { theme } from "@/lib/theme";

type CounterChipProps = {
  count: number;
  label: string;
};

/**
 * The counter chip pattern from prd.md §16.6: a surface-raised pill with a
 * text-secondary label and a text-primary number, pulsing on decrement.
 */
export function CounterChip({ count, label }: CounterChipProps) {
  const pulse = useSharedValue(1);
  const previousCount = useRef(count);

  useEffect(() => {
    if (count < previousCount.current) {
      pulse.value = withSequence(withSpring(1.2, CARD_REJECT_SPRING), withSpring(1, CARD_REJECT_SPRING));
    }
    previousCount.current = count;
  }, [count, pulse]);

  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.chip}>
      <Animated.Text style={[styles.number, numberStyle]}>{count}</Animated.Text>
      <Animated.Text style={styles.label}>{label}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing(0.5),
    minHeight: 36,
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceRaised,
  },
  number: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  label: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "500" },
});
