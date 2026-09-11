-- DropIndex
DROP INDEX "Test_status_idx";

-- CreateIndex
CREATE INDEX "MobileAuthCode_userId_idx" ON "MobileAuthCode"("userId");

-- CreateIndex: [status, createdAt] replaces the old standalone [status] index — a strict
-- superset via leftmost-prefix, matching /next-test's `WHERE status = 'ACTIVE' ORDER BY
-- createdAt ASC` exactly (plan.md 17.9 / OPTIMIZATIONS.md Finding 11).
CREATE INDEX "Test_status_createdAt_idx" ON "Test"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Question_trapSourceId_idx" ON "Question"("trapSourceId");

-- CreateIndex
CREATE INDEX "QuestionOption_mediaId_idx" ON "QuestionOption"("mediaId");

-- CreateIndex
CREATE INDEX "Media_sourceUrl_idx" ON "Media"("sourceUrl");
