-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDeviceFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationDeviceId" TEXT;

-- CreateIndex
CREATE INDEX "User_registrationDeviceId_idx" ON "User"("registrationDeviceId");
