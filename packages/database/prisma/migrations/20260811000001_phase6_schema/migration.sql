-- Phase 6: Remove FREE_TEXT question type and replace dateOfBirth with age

-- 1. Clean up FREE_TEXT answers and questions (data migration)
DELETE FROM "Answer" WHERE "questionId" IN (
  SELECT id FROM "Question" WHERE type = 'FREE_TEXT'::"QuestionType"
);
DELETE FROM "Question" WHERE type = 'FREE_TEXT'::"QuestionType";

-- 2. Drop textValue column from Answer
ALTER TABLE "Answer" DROP COLUMN IF EXISTS "textValue";

-- 3. Update QuestionType enum — PostgreSQL requires recreating the type
ALTER TYPE "QuestionType" RENAME TO "QuestionType_old";
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_SELECT', 'MULTI_SELECT', 'RATING');
ALTER TABLE "Question" ALTER COLUMN "type" TYPE "QuestionType" USING "type"::text::"QuestionType";
DROP TYPE "QuestionType_old";

-- 4. Add age column to EvaluatorProfile
ALTER TABLE "EvaluatorProfile" ADD COLUMN "age" INTEGER;

-- 5. Backfill age from dateOfBirth using PostgreSQL AGE function
UPDATE "EvaluatorProfile"
SET "age" = EXTRACT(YEAR FROM AGE("dateOfBirth"))::INTEGER;

-- 6. Safety: set sensible default for any nulls
UPDATE "EvaluatorProfile" SET "age" = 25 WHERE "age" IS NULL;

-- 7. Make age NOT NULL
ALTER TABLE "EvaluatorProfile" ALTER COLUMN "age" SET NOT NULL;

-- 8. Drop dateOfBirth column
ALTER TABLE "EvaluatorProfile" DROP COLUMN "dateOfBirth";
