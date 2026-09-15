-- CreateTable: MediaFolder with self-referential parent/child tree
CREATE TABLE "MediaFolder" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add folderId + textContent to Media (nullable, migration-safe)
ALTER TABLE "Media" ADD COLUMN "folderId" UUID,
                   ADD COLUMN "textContent" TEXT;

-- CreateIndex: folder parent lookup
CREATE INDEX "MediaFolder_parentId_idx" ON "MediaFolder"("parentId");

-- CreateIndex: unique name among siblings (partial — one index per null/non-null parentId
--   because PostgreSQL treats NULL != NULL in a composite unique index, so two root folders
--   with the same name would not be caught by a plain composite index alone).
CREATE UNIQUE INDEX "MediaFolder_root_name_key"   ON "MediaFolder"("name") WHERE "parentId" IS NULL;
CREATE UNIQUE INDEX "MediaFolder_child_name_key"   ON "MediaFolder"("parentId", "name") WHERE "parentId" IS NOT NULL;

-- CreateIndex: Media folder lookup
CREATE INDEX "Media_folderId_idx" ON "Media"("folderId");

-- AddForeignKey: self-referential folder tree (SET NULL so deleting a parent orphans children to root)
ALTER TABLE "MediaFolder" ADD CONSTRAINT "MediaFolder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: media belongs to folder (SET NULL keeps media at root if folder is deleted)
ALTER TABLE "Media" ADD CONSTRAINT "Media_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
