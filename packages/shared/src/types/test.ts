import type { TestStatus } from "../constants";
import type { Question } from "./question";

export type DemographicFilters = {
  ageMin?: number;
  ageMax?: number;
  genders?: string[];
  countries?: string[];
  cities?: string[];
};

export type Test = {
  id: string;
  title: string;
  description: string | null;
  status: TestStatus;
  responseCap: number | null;
  advisoryTimeMin: number | null;
  minTimePerQuestion: number;
  demographicFilters: DemographicFilters | null;
  rewardPoints: number;
  createdAt: string;
  updatedAt: string;
};

export type TestWithQuestions = Test & {
  questions: Question[];
};
