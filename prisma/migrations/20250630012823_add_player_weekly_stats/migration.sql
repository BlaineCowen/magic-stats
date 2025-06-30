/*
  Warnings:

  - You are about to drop the column `fantasyPointsPPR` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `opponent` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `passingEPA` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `passingTouchdowns` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `receivingEPA` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `receivingTouchdowns` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `rushingEPA` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `rushingTouchdowns` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `specialTeamsTouchdowns` on the `PlayerWeeklyStats` table. All the data in the column will be lost.
  - You are about to drop the column `team` on the `PlayerWeeklyStats` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "PlayerWeeklyStats_team_idx";

-- AlterTable
ALTER TABLE "PlayerWeeklyStats" DROP COLUMN "fantasyPointsPPR",
DROP COLUMN "opponent",
DROP COLUMN "passingEPA",
DROP COLUMN "passingTouchdowns",
DROP COLUMN "receivingEPA",
DROP COLUMN "receivingTouchdowns",
DROP COLUMN "rushingEPA",
DROP COLUMN "rushingTouchdowns",
DROP COLUMN "specialTeamsTouchdowns",
DROP COLUMN "team",
ADD COLUMN     "fantasyPointsPpr" DOUBLE PRECISION,
ADD COLUMN     "headshotUrl" TEXT,
ADD COLUMN     "opponentTeam" TEXT,
ADD COLUMN     "passingEpa" DOUBLE PRECISION,
ADD COLUMN     "passingTds" INTEGER,
ADD COLUMN     "playerDisplayName" TEXT,
ADD COLUMN     "positionGroup" TEXT,
ADD COLUMN     "receivingEpa" DOUBLE PRECISION,
ADD COLUMN     "receivingTds" INTEGER,
ADD COLUMN     "recentTeam" TEXT,
ADD COLUMN     "rushingEpa" DOUBLE PRECISION,
ADD COLUMN     "rushingTds" INTEGER,
ADD COLUMN     "specialTeamsTds" INTEGER,
ALTER COLUMN "playerName" DROP NOT NULL,
ALTER COLUMN "position" DROP NOT NULL,
ALTER COLUMN "fantasyPoints" DROP NOT NULL,
ALTER COLUMN "fantasyPoints" DROP DEFAULT,
ALTER COLUMN "completions" DROP NOT NULL,
ALTER COLUMN "completions" DROP DEFAULT,
ALTER COLUMN "attempts" DROP NOT NULL,
ALTER COLUMN "attempts" DROP DEFAULT,
ALTER COLUMN "passingYards" DROP NOT NULL,
ALTER COLUMN "passingYards" DROP DEFAULT,
ALTER COLUMN "interceptions" DROP NOT NULL,
ALTER COLUMN "interceptions" DROP DEFAULT,
ALTER COLUMN "sacks" DROP NOT NULL,
ALTER COLUMN "sacks" DROP DEFAULT,
ALTER COLUMN "sackYards" DROP NOT NULL,
ALTER COLUMN "sackYards" DROP DEFAULT,
ALTER COLUMN "sackFumbles" DROP NOT NULL,
ALTER COLUMN "sackFumbles" DROP DEFAULT,
ALTER COLUMN "sackFumblesLost" DROP NOT NULL,
ALTER COLUMN "sackFumblesLost" DROP DEFAULT,
ALTER COLUMN "passingAirYards" DROP NOT NULL,
ALTER COLUMN "passingAirYards" DROP DEFAULT,
ALTER COLUMN "passingYardsAfterCatch" DROP NOT NULL,
ALTER COLUMN "passingYardsAfterCatch" DROP DEFAULT,
ALTER COLUMN "passingFirstDowns" DROP NOT NULL,
ALTER COLUMN "passingFirstDowns" DROP DEFAULT,
ALTER COLUMN "passing2PtConversions" DROP NOT NULL,
ALTER COLUMN "passing2PtConversions" DROP DEFAULT,
ALTER COLUMN "carries" DROP NOT NULL,
ALTER COLUMN "carries" DROP DEFAULT,
ALTER COLUMN "rushingYards" DROP NOT NULL,
ALTER COLUMN "rushingYards" DROP DEFAULT,
ALTER COLUMN "rushingFumbles" DROP NOT NULL,
ALTER COLUMN "rushingFumbles" DROP DEFAULT,
ALTER COLUMN "rushingFumblesLost" DROP NOT NULL,
ALTER COLUMN "rushingFumblesLost" DROP DEFAULT,
ALTER COLUMN "rushingFirstDowns" DROP NOT NULL,
ALTER COLUMN "rushingFirstDowns" DROP DEFAULT,
ALTER COLUMN "rushing2PtConversions" DROP NOT NULL,
ALTER COLUMN "rushing2PtConversions" DROP DEFAULT,
ALTER COLUMN "receptions" DROP NOT NULL,
ALTER COLUMN "receptions" DROP DEFAULT,
ALTER COLUMN "targets" DROP NOT NULL,
ALTER COLUMN "targets" DROP DEFAULT,
ALTER COLUMN "receivingYards" DROP NOT NULL,
ALTER COLUMN "receivingYards" DROP DEFAULT,
ALTER COLUMN "receivingFumbles" DROP NOT NULL,
ALTER COLUMN "receivingFumbles" DROP DEFAULT,
ALTER COLUMN "receivingFumblesLost" DROP NOT NULL,
ALTER COLUMN "receivingFumblesLost" DROP DEFAULT,
ALTER COLUMN "receivingAirYards" DROP NOT NULL,
ALTER COLUMN "receivingAirYards" DROP DEFAULT,
ALTER COLUMN "receivingYardsAfterCatch" DROP NOT NULL,
ALTER COLUMN "receivingYardsAfterCatch" DROP DEFAULT,
ALTER COLUMN "receivingFirstDowns" DROP NOT NULL,
ALTER COLUMN "receivingFirstDowns" DROP DEFAULT,
ALTER COLUMN "receiving2PtConversions" DROP NOT NULL,
ALTER COLUMN "receiving2PtConversions" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "PlayerWeeklyStats_recentTeam_idx" ON "PlayerWeeklyStats"("recentTeam");
