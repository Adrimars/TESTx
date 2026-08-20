-- Phase 8: Extended evaluator profile fields

ALTER TABLE "EvaluatorProfile"
  ADD COLUMN IF NOT EXISTS "nativeLanguage"   TEXT,
  ADD COLUMN IF NOT EXISTS "foreignLanguages" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "occupation"       TEXT,
  ADD COLUMN IF NOT EXISTS "educationLevel"   TEXT,
  ADD COLUMN IF NOT EXISTS "aiUseCases"       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "aiExperience"     TEXT,
  ADD COLUMN IF NOT EXISTS "aiFrequency"      TEXT;
