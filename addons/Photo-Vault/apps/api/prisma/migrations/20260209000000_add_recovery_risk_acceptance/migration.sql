-- AlterTable
ALTER TABLE "users" ADD COLUMN     "acceptedVaultRecoveryRiskAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_acceptedVaultRecoveryRiskAt_idx" ON "users"("acceptedVaultRecoveryRiskAt");
