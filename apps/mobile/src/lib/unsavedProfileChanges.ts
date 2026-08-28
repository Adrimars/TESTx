import { Alert } from "react-native";

/**
 * Bridges the Profile screen's dirty-form state up to the tab bar and the hardware back
 * button, neither of which the screen can reach into directly. Only one form in this app
 * can ever be mid-edit at a time, so a single module-level slot - set while Profile is
 * mounted, cleared when it isn't - is simpler than threading a context through every tab.
 */
type UnsavedProfileChangesGuard = {
  isDirty: () => boolean;
  /** Persists the pending edits. Resolves false if the save failed - the caller then
   * knows leaving is not actually safe yet. */
  save: () => Promise<boolean>;
  /** Reverts the form to its last-saved values without calling the API. */
  discard: () => void;
};

let current: UnsavedProfileChangesGuard | null = null;

export function registerUnsavedProfileChanges(guard: UnsavedProfileChangesGuard | null): void {
  current = guard;
}

/**
 * Call before any navigation away from a screen that might be holding unsaved profile
 * edits - a tab press, the Android back button, or a launcher action like the Tests tab.
 * Resolves true when it is safe to proceed: nothing was dirty, or the user chose to
 * discard or successfully save. Resolves false when the navigation should be cancelled -
 * the user chose Cancel, or a Save attempt failed.
 */
export function confirmLeavingUnsavedProfileChanges(): Promise<boolean> {
  const guard = current;
  if (!guard || !guard.isDirty()) return Promise.resolve(true);

  return new Promise((resolve) => {
    Alert.alert(
      "Unsaved changes",
      "You have profile changes that haven't been saved yet. What would you like to do?",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            guard.discard();
            resolve(true);
          },
        },
        {
          text: "Save",
          onPress: () => {
            void guard.save().then(resolve);
          },
        },
      ]
    );
  });
}
