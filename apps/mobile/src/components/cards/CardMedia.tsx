import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { resolveMediaUrl } from "@/lib/env";
import { theme } from "@/lib/theme";

type CardMediaProps = {
  /** The question's MediaType. TEXT (or null) means the label carries the whole option. */
  mediaType: string | null;
  /** Server-relative media path, as sent by the API. */
  url: string | null;
  label: string | null;
  /** Only the card the evaluator is looking at should play. */
  isActive: boolean;
};

/**
 * Renders one option's media inside a card.
 *
 * Video and audio each get their own component because their players are hooks, and a
 * hook cannot be called behind a branch — switching on `mediaType` inside a single
 * component would change the hook order as the deck advances between types.
 */
export function CardMedia({ mediaType, url, label, isActive }: CardMediaProps) {
  const resolved = resolveMediaUrl(url);

  if (!resolved || mediaType === "TEXT") {
    return (
      <View style={styles.textFill}>
        <Text style={styles.textLabel}>{label ?? ""}</Text>
      </View>
    );
  }

  if (mediaType === "VIDEO") return <CardVideo uri={resolved} isActive={isActive} />;
  if (mediaType === "AUDIO") return <CardAudio uri={resolved} label={label} isActive={isActive} />;

  return <CardImage uri={resolved} />;
}

function CardImage({ uri }: { uri: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  if (failed) return <MediaFallback message="Image unavailable" />;

  return (
    <View style={styles.fill}>
      <Image
        source={{ uri }}
        style={styles.fill}
        resizeMode="cover"
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading ? (
        <View style={styles.overlayCenter} pointerEvents="none">
          <ActivityIndicator color={theme.colors.textSecondary} />
        </View>
      ) : null}
    </View>
  );
}

function CardVideo({ uri, isActive }: { uri: string; isActive: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  // A peeking card is on screen but not being answered; letting it play would put two or
  // three videos on the GPU at once and pull attention off the active card.
  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      style={styles.fill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

function CardAudio({ uri, label, isActive }: { uri: string; label: string | null; isActive: boolean }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  // Audio never autoplays - an unexpected noise while swiping is worse than a tap - but a
  // card that stops being the active one must not keep playing behind the next question.
  useEffect(() => {
    if (!isActive) {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <View style={styles.audioFill}>
      <Text style={styles.textLabel}>{label ?? "Audio clip"}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause audio" : "Play audio"}
        onPress={() => {
          if (status.playing) {
            player.pause();
            return;
          }
          player.seekTo(0);
          player.play();
        }}
        style={({ pressed }) => [styles.audioButton, pressed && styles.audioButtonPressed]}
      >
        <Text style={styles.audioButtonLabel}>{status.playing ? "Pause" : "Play"}</Text>
      </Pressable>
    </View>
  );
}

function MediaFallback({ message }: { message: string }) {
  return (
    <View style={styles.textFill}>
      <Text style={styles.fallbackLabel}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  overlayCenter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  textFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(2),
    backgroundColor: theme.colors.surfaceBase,
  },
  audioFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.colors.surfaceBase,
  },
  textLabel: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  fallbackLabel: { color: theme.colors.textSecondary, fontSize: 15 },
  audioButton: {
    minHeight: 48,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
  },
  audioButtonPressed: { opacity: 0.75 },
  audioButtonLabel: { color: theme.colors.accentContrast, fontSize: 16, fontWeight: "600" },
});
