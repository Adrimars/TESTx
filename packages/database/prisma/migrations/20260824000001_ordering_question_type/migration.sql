-- Ordering questions: evaluators rank the options instead of picking among them.
-- The ranking is stored in the existing "Answer"."selectedOptions" array, whose element
-- order carries the answer, so no new column is needed.

ALTER TYPE "QuestionType" ADD VALUE 'ORDERING';
