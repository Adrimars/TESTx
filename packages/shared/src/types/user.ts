import type { Gender, UserRole } from "../constants";

export type User = {
  id: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  /** Index into AVATAR_PRESET_IDS, or null if the evaluator has not picked one. */
  avatarId: number | null;
  /**
   * When the KVKK Article 10 disclosure was acknowledged, or null if it never was.
   * Mobile registration stamps this at signup, but a Google-registered account starts
   * null - the mobile app gates on this field to show the disclosure before the
   * dashboard. Server-owned, so a client cannot claim to have seen it.
   */
  aydinlatmaAcknowledgedAt: string | null;
};

export type EvaluatorProfile = {
  id: string;
  userId: string;
  age: number;
  gender: Gender;
  country: string;
  city: string | null;
  nativeLanguage: string | null;
  foreignLanguages: string[];
  occupation: string | null;
  educationLevel: string | null;
  aiUseCases: string[];
  aiExperience: string | null;
  aiFrequency: string | null;
  hobbies: string[];
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type CurrentUser = User & {
  evaluatorProfile?: EvaluatorProfile | null;
};
