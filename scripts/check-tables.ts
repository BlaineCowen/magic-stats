import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Get counts for each table
    const gameCounts = await prisma.game.count();
    const playCounts = await prisma.play.count();
    const playDetailsCounts = await prisma.playDetails.count();
    const playParticipantsCounts = await prisma.playParticipants.count();
    const playAdvancedStatsCounts = await prisma.playAdvancedStats.count();
    const playGameInfoCounts = await prisma.playGameInfo.count();
    const playSpecialTeamsCounts = await prisma.playSpecialTeams.count();

    // Print counts
    console.log("Table Counts:");
    console.log("--------------");
    console.log(`Games: ${gameCounts}`);
    console.log(`Plays: ${playCounts}`);
    console.log(`Play Details: ${playDetailsCounts}`);
    console.log(`Play Participants: ${playParticipantsCounts}`);
    console.log(`Play Advanced Stats: ${playAdvancedStatsCounts}`);
    console.log(`Play Game Info: ${playGameInfoCounts}`);
    console.log(`Play Special Teams: ${playSpecialTeamsCounts}`);

    // Get sample counts by year
    const years = [1999, 2000, 2023];
    for (const year of years) {
      const yearPlays = await prisma.play.count({
        where: {
          gameId: {
            startsWith: String(year),
          },
        },
      });
      console.log(`\nPlays from ${year}: ${yearPlays}`);

      // Get related table counts for this year's plays
      const yearDetails = await prisma.playDetails.count({
        where: {
          play: {
            gameId: {
              startsWith: String(year),
            },
          },
        },
      });
      const yearParticipants = await prisma.playParticipants.count({
        where: {
          play: {
            gameId: {
              startsWith: String(year),
            },
          },
        },
      });
      const yearAdvancedStats = await prisma.playAdvancedStats.count({
        where: {
          play: {
            gameId: {
              startsWith: String(year),
            },
          },
        },
      });
      const yearGameInfo = await prisma.playGameInfo.count({
        where: {
          play: {
            gameId: {
              startsWith: String(year),
            },
          },
        },
      });
      const yearSpecialTeams = await prisma.playSpecialTeams.count({
        where: {
          play: {
            gameId: {
              startsWith: String(year),
            },
          },
        },
      });

      console.log(`Details: ${yearDetails}`);
      console.log(`Participants: ${yearParticipants}`);
      console.log(`Advanced Stats: ${yearAdvancedStats}`);
      console.log(`Game Info: ${yearGameInfo}`);
      console.log(`Special Teams: ${yearSpecialTeams}`);
    }
  } catch (error) {
    console.error("Error checking tables:", error);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
