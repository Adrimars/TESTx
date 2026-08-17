import type { Gender, UserRole } from "../constants";

export type User = {
  id: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EvaluatorProfile = {
  id: string;
  userId: string;
  age: number;
  gender: Gender;
  country: string;
  city: string | null;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type CurrentUser = User & {
  evaluatorProfile?: EvaluatorProfile | null;
};
