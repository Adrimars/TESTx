import { Alert } from "react-native";
import type { AlertButton } from "react-native";

/**
 * Thin wrapper so call sites import one thing regardless of platform - see
 * alert.web.ts for why web needs its own implementation rather than reaching
 * `Alert.alert` directly.
 */
export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  Alert.alert(title, message, buttons);
}
