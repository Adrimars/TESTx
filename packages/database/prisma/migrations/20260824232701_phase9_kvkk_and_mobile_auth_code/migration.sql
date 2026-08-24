-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acikRizaAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "aydinlatmaAcknowledgedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MobileAuthCode" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileAuthCode_code_key" ON "MobileAuthCode"("code");

-- CreateIndex
CREATE INDEX "MobileAuthCode_expiresAt_idx" ON "MobileAuthCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "MobileAuthCode" ADD CONSTRAINT "MobileAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
