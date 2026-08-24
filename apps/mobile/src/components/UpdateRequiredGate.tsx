import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { Button } from "./Button";
import {
  currentAppVersion,
  fetchMinVersion,
  isVersionBelow,
  type MinVersionInfo,
} from "@/lib/appVersion";
import { theme } from "@/lib/theme";

/**
 * Blocks the whole app when the running build is below the server's minimum.
 *
 * This is deliberately all-or-nothing rather than degrading per question type:
 * a build that cannot render a newly shipped QuestionType would otherwise break
 * partway through a feed, after the evaluator has already invested time.
 *
 * There is no dismiss action by design. If the check cannot complete (offline,
 * API down) the app is left usable rather than locked out.
 */
export function UpdateRequiredGate({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<MinVersionInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchMinVersion();
      if (cancelled) return;
      setInfo(result);
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const outdated =
    checked && info != null && isVersionBelow(currentAppVersion, info.minVersion);

  if (!outdated) return <>{children}</>;

  const storeUrl =
    Platform.OS === "ios" ? info.storeUrls.ios : info.storeUrls.android;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Update required</Text>
      <Text style={styles.body}>
        This version of TESTx is no longer supported. Update to continue.
      </Text>
      <Text style={styles.versions}>
        You have {currentAppVersion} — {info.minVersion} or newer is required.
      </Text>
      {storeUrl ? (
        <Button label="Update now" onPress={() => void Linking.openURL(storeUrl)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    gap: theme.spacing(1.5),
    backgroundColor: theme.colors.surfaceBase,
  },
  title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700" },
  body: { color: theme.colors.textSecondary, fontSize: 15, textAlign: "center" },
  versions: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginBottom: theme.spacing(1),
  },
});
