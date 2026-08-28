import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";

/**
 * Auth-check splash. Routes to the home screen, onboarding or the entry screen
 * once the stored token has been validated against the API.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { initializing, user, hasProfile, needsAydinlatma } = useSession();

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/login");
    // The disclosure comes before anything else the app shows: a Google-registered
    // account has never seen it, and it is not something to catch up on later.
    else if (needsAydinlatma) router.replace("/aydinlatma");
    else router.replace(hasProfile ? "/dashboard" : "/profile-onboarding");
  }, [initializing, user, hasProfile, needsAydinlatma, router]);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/testx-logo.png")}
        style={styles.wordmark}
        resizeMode="contain"
      />
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceBase,
    gap: theme.spacing(2),
  },
  wordmark: {
    width: 150,
    height: 40,
  },
});
