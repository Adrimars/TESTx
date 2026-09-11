import type { AlertButton } from "react-native";

export type AlertState = {
  title: string;
  message?: string;
  buttons: AlertButton[];
} | null;

/**
 * Plain external store (subscribe/getSnapshot), not React state - `alert()` is called from
 * places that aren't components (submissionQueue.ts, unsavedProfileChanges.ts), so the state
 * has to live outside any single component's tree. `AlertHost` reads it with
 * `useSyncExternalStore` and is the one place that actually renders it.
 */
let state: AlertState = null;
const listeners = new Set<() => void>();

export function getAlertState(): AlertState {
  return state;
}

export function subscribeAlert(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  // A default single "OK" dismiss, same fallback `Alert.alert` itself applies when no
  // buttons are given - every alert needs at least one way to close it.
  state = { title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: "OK" }] };
  for (const listener of listeners) listener();
}

export function dismissAlert(): void {
  state = null;
  for (const listener of listeners) listener();
}
