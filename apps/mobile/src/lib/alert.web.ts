import type { AlertButton } from "react-native";

/**
 * `Alert.alert` (react-native/Libraries/Alert/Alert.js) only implements the ios and
 * android branches - on web it silently does nothing, which is worse than doing nothing
 * visibly: every `onPress` wired to a button - including this app's post-alert
 * navigations (profile-onboarding's "Let's go", the delete-account confirm) - would
 * simply never fire, with no error to say why. `window.alert`/`window.confirm` are the
 * closest browser-native equivalent - blocking and unstyled, but they actually run the
 * callback, which is the one thing every call site here depends on.
 *
 * Neither browser dialog offers more than a single yes/no choice, so a 3+ button alert
 * (unsavedProfileChanges.ts's Cancel/Discard/Save) becomes one confirm per non-cancel
 * button in order - declining one moves to the next - rather than one dialog with three
 * choices. Clunkier than native, but every action stays reachable.
 */
export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((button: AlertButton) => button.style === "cancel");
  const actionButtons = buttons.filter((button: AlertButton) => button !== cancelButton);

  for (const button of actionButtons) {
    const prompt = actionButtons.length > 1 ? `${text}\n\nOK for "${button.text ?? "OK"}"?` : text;
    if (window.confirm(prompt)) {
      button.onPress?.();
      return;
    }
  }
  cancelButton?.onPress?.();
}
