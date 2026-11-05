ALTER TABLE "Supporter" ADD COLUMN "phoneHash" TEXT;
CREATE INDEX "Supporter_campaignId_phoneHash_idx" ON "Supporter"("campaignId", "phoneHash");
