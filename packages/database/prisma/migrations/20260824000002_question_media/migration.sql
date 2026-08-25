-- Question subject media: the image being rated, the clip being ranked. A rating question
-- cannot carry options, so before this there was nowhere to put the thing being rated.

ALTER TABLE "Question" ADD COLUMN "mediaId" UUID;

CREATE INDEX "Question_mediaId_idx" ON "Question"("mediaId");

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_mediaId_fkey" FOREIGN KEY ("mediaId")
  REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
