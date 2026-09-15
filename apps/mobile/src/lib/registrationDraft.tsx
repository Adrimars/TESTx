import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * The half-filled registration form, held in memory so it survives a remount of the
 * register screen (e.g. navigating back to /login and forward again).
 *
 * This exists specifically so the password never travels as a navigation param. Expo
 * Router params land in the route state - on Android that means the activity intent and
 * the task backstack, which are readable from task snapshots and get attached to crash
 * reports. A plaintext password has no business in either.
 *
 * Nothing here is persisted: a killed app drops the draft, which is the correct outcome
 * for an unsubmitted signup form.
 */
export type RegistrationDraft = {
  email: string;
  password: string;
  confirmPassword: string;
  ageConfirmed: boolean;
};

const EMPTY_DRAFT: RegistrationDraft = {
  email: "",
  password: "",
  confirmPassword: "",
  ageConfirmed: false,
};

type RegistrationDraftValue = {
  draft: RegistrationDraft;
  /** Merges fields into the draft; omitted fields keep their current value. */
  updateDraft: (patch: Partial<RegistrationDraft>) => void;
  /** Drops the credentials from memory. Called once the account exists. */
  clearDraft: () => void;
};

const RegistrationDraftContext = createContext<RegistrationDraftValue | null>(null);

export function RegistrationDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_DRAFT);

  const updateDraft = useCallback((patch: Partial<RegistrationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const clearDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  const value = useMemo(
    () => ({ draft, updateDraft, clearDraft }),
    [draft, updateDraft, clearDraft]
  );

  return (
    <RegistrationDraftContext.Provider value={value}>{children}</RegistrationDraftContext.Provider>
  );
}

export function useRegistrationDraft(): RegistrationDraftValue {
  const value = useContext(RegistrationDraftContext);
  if (!value) {
    throw new Error("useRegistrationDraft must be used inside RegistrationDraftProvider");
  }
  return value;
}
