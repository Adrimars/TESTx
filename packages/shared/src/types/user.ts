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
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type CurrentUser = User & {
  evaluatorProfile?: EvaluatorProfile | null;
};
