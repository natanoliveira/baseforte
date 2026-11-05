-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('VEREADOR', 'PREFEITO');

-- CreateEnum
CREATE TYPE "CampaignMode" AS ENUM ('CAMPANHA', 'MANDATO');

-- CreateEnum
CREATE TYPE "RetentionPolicy" AS ENUM ('ANONIMIZAR', 'APAGAR');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA', 'AUDITOR');

-- CreateEnum
CREATE TYPE "LeaderStatus" AS ENUM ('ATIVO', 'FRIO', 'INATIVO');

-- CreateEnum
CREATE TYPE "GeocodeStatus" AS ENUM ('PENDING', 'OK', 'FAILED');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'VEREADOR',
    "mode" "CampaignMode" NOT NULL DEFAULT 'CAMPANHA',
    "spendingLimit" DECIMAL(14,2),
    "retentionPolicy" "RetentionPolicy" NOT NULL DEFAULT 'ANONIMIZAR',
    "closedAt" TIMESTAMP(3),
    "dpoName" TEXT,
    "dpoEmail" TEXT,
    "dpoContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT,
    "refreshHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Neighborhood" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geom" geometry(MultiPolygon,4326),
    "centroid" geometry(Point,4326),

    CONSTRAINT "Neighborhood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leader" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "coordinatorId" TEXT,
    "neighborhoodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneEnc" BYTEA,
    "zones" TEXT[],
    "sections" TEXT[],
    "goal" INTEGER NOT NULL DEFAULT 0,
    "statusOverride" "LeaderStatus",
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supporter" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneEnc" BYTEA,
    "cpfEnc" BYTEA,
    "addressEnc" BYTEA,
    "locationEnc" BYTEA,
    "mapPoint" geometry(Point,4326),
    "jitterSeed" INTEGER NOT NULL,
    "geocodeStatus" "GeocodeStatus" NOT NULL DEFAULT 'PENDING',
    "anonymizedAt" TIMESTAMP(3),
    "removalToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "supporterId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "textAccepted" TEXT NOT NULL,
    "collectedById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "Role",
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'OK',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemovalRecord" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "supporterHash" TEXT NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingPlace" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" geometry(Point,4326),

    CONSTRAINT "VotingPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_campaignId_idx" ON "User"("campaignId");

-- CreateIndex
CREATE INDEX "Region_campaignId_idx" ON "Region"("campaignId");

-- CreateIndex
CREATE INDEX "Neighborhood_campaignId_idx" ON "Neighborhood"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Leader_userId_key" ON "Leader"("userId");

-- CreateIndex
CREATE INDEX "Leader_campaignId_idx" ON "Leader"("campaignId");

-- CreateIndex
CREATE INDEX "Leader_parentId_idx" ON "Leader"("parentId");

-- CreateIndex
CREATE INDEX "Leader_neighborhoodId_idx" ON "Leader"("neighborhoodId");

-- CreateIndex
CREATE UNIQUE INDEX "Supporter_removalToken_key" ON "Supporter"("removalToken");

-- CreateIndex
CREATE INDEX "Supporter_campaignId_idx" ON "Supporter"("campaignId");

-- CreateIndex
CREATE INDEX "Supporter_leaderId_idx" ON "Supporter"("leaderId");

-- CreateIndex
CREATE INDEX "Supporter_neighborhoodId_idx" ON "Supporter"("neighborhoodId");

-- CreateIndex
CREATE INDEX "Consent_campaignId_idx" ON "Consent"("campaignId");

-- CreateIndex
CREATE INDEX "Consent_supporterId_idx" ON "Consent"("supporterId");

-- CreateIndex
CREATE INDEX "AccessLog_campaignId_at_idx" ON "AccessLog"("campaignId", "at");

-- CreateIndex
CREATE INDEX "RemovalRecord_campaignId_idx" ON "RemovalRecord"("campaignId");

-- CreateIndex
CREATE INDEX "VotingPlace_campaignId_idx" ON "VotingPlace"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "GeocodeCache_queryHash_key" ON "GeocodeCache"("queryHash");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Neighborhood" ADD CONSTRAINT "Neighborhood_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Neighborhood" ADD CONSTRAINT "Neighborhood_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leader" ADD CONSTRAINT "Leader_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leader" ADD CONSTRAINT "Leader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leader" ADD CONSTRAINT "Leader_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leader" ADD CONSTRAINT "Leader_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Leader"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leader" ADD CONSTRAINT "Leader_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supporter" ADD CONSTRAINT "Supporter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supporter" ADD CONSTRAINT "Supporter_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Leader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supporter" ADD CONSTRAINT "Supporter_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_supporterId_fkey" FOREIGN KEY ("supporterId") REFERENCES "Supporter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemovalRecord" ADD CONSTRAINT "RemovalRecord_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingPlace" ADD CONSTRAINT "VotingPlace_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingPlace" ADD CONSTRAINT "VotingPlace_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

