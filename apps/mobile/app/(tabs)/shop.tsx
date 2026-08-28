import { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { resolveMediaUrl } from "@/lib/env";
import { useBalance } from "@/lib/test";
import { useCoupons, type EvaluatorCoupon } from "@/lib/coupons";
import { theme } from "@/lib/theme";

/**
 * The Rewards / Shop screen (prd.md §15.10): browse the admin-managed catalog against the
 * evaluator's own balance. Redemption is explicitly deferred (§10.2a/§15.11) - tapping an
 * item's redeem action only ever shows "Coming Soon", the same pattern as the web
 * dashboard's Withdraw button, never a balance mutation.
 */
export default function ShopScreen() {
  const balance = useBalance();
  const coupons = useCoupons();

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Shop</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your balance</Text>
          {balance.isPending ? (
            <ActivityIndicator color={theme.colors.textSecondary} />
          ) : (
            <Text style={styles.balanceValue}>
              {balance.data?.balance ?? 0} <Text style={styles.balanceUnit}>points</Text>
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Catalog</Text>

        {coupons.isPending ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={theme.colors.textSecondary} />
          </View>
        ) : coupons.isError ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Could not load the catalog</Text>
            <Text style={styles.stateBody}>{coupons.error.message}</Text>
            <Button label="Try again" variant="secondary" onPress={() => void coupons.refetch()} />
          </View>
        ) : !coupons.data || coupons.data.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Nothing in the catalog yet</Text>
            <Text style={styles.stateBody}>Check back later for rewards to spend your points on.</Text>
          </View>
        ) : (
          coupons.data.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} balance={balance.data?.balance ?? 0} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CouponCard({ coupon, balance }: { coupon: EvaluatorCoupon; balance: number }) {
  const [comingSoon, setComingSoon] = useState(false);
  const resolvedImage = resolveMediaUrl(coupon.imageUrl);
  const canAfford = balance >= coupon.pointsCost;

  return (
    <View style={styles.couponCard}>
      <View style={styles.couponImage}>
        {resolvedImage ? (
          <Image source={{ uri: resolvedImage }} style={styles.couponImage} resizeMode="cover" />
        ) : (
          <View style={[styles.couponImage, styles.couponImageFallback]}>
            <Text style={styles.couponImageFallbackGlyph}>🎁</Text>
          </View>
        )}
      </View>
      <View style={styles.couponBody}>
        <Text style={styles.couponTitle}>{coupon.title}</Text>
        {coupon.description ? (
          <Text style={styles.couponDescription} numberOfLines={2}>
            {coupon.description}
          </Text>
        ) : null}
        <View style={styles.couponFooter}>
          <Text style={[styles.couponCost, !canAfford && styles.couponCostShort]}>
            {coupon.pointsCost} pts
          </Text>
          <Button
            label={comingSoon ? "Coming Soon" : "Redeem"}
            variant="secondary"
            onPress={() => setComingSoon(true)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  content: { padding: theme.spacing(2.5), gap: theme.spacing(2) },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  balanceCard: {
    gap: theme.spacing(0.5),
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
  },
  balanceLabel: { color: theme.colors.accentContrast, fontSize: 13, opacity: 0.85 },
  balanceValue: { color: theme.colors.accentContrast, fontSize: 32, fontWeight: "800" },
  balanceUnit: { fontSize: 15, fontWeight: "600" },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  stateCard: {
    gap: theme.spacing(1),
    padding: theme.spacing(2.5),
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  stateTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600" },
  stateBody: { color: theme.colors.textSecondary, fontSize: 14, textAlign: "center" },
  couponCard: {
    flexDirection: "row",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  couponImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceOverlay,
  },
  couponImageFallback: { alignItems: "center", justifyContent: "center" },
  couponImageFallbackGlyph: { fontSize: 32 },
  couponBody: { flex: 1, justifyContent: "space-between", gap: theme.spacing(0.5) },
  couponTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" },
  couponDescription: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  couponFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing(0.5),
  },
  couponCost: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" },
  couponCostShort: { color: theme.colors.textSecondary },
});
