import type { AlertButton } from "react-native";
import { showAlert } from "./alertStore";

/**
 * Shows an in-app popup, matching the rest of the deck's own "Card"/"Popup" chrome
 * (prd.md §16.6) instead of the OS's native alert dialog - and, on web, instead of
 * `window.alert`/`window.confirm`, which used to be the only working option there
 * (`Alert.alert` silently no-ops on web) but reads as a browser error, not part of the
 * app. `AlertHost` (mounted once at the app root) is what actually renders this; calling
 * `alert()` from anywhere - including non-component lib files like submissionQueue.ts and
 * unsavedProfileChanges.ts - just pushes into the shared store it's watching.
 */
export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  showAlert(title, message, buttons);
}
