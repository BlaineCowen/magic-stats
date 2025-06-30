import { PrismaClient, type Prisma } from "@prisma/client";
import axios from "axios";
import { parse } from "csv-parse";
import { Readable } from "stream";

const prisma = new PrismaClient({
  log: ["error"],
});

interface NFLPlayerWeeklyStats {
  id: string;
  season: number;
  week: number;
  seasonType: string;
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  opponent: string;
  fantasyPoints: number;
  fantasyPointsPPR: number;
  completions: number;
  attempts: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  sacks: number;
  sackYards: number;
  sackFumbles: number;
  sackFumblesLost: number;
  passingAirYards: number;
  passingYardsAfterCatch: number;
  passingFirstDowns: number;
  passingEPA: number;
  passing2PtConversions: number;
  carries: number;
  rushingYards: number;
  rushingTouchdowns: number;
  rushingFumbles: number;
  rushingFumblesLost: number;
  rushingFirstDowns: number;
  rushingEPA: number;
  rushing2PtConversions: number;
  receptions: number;
  targets: number;
  receivingYards: number;
  receivingTouchdowns: number;
  receivingFumbles: number;
  receivingFumblesLost: number;
  receivingAirYards: number;
  receivingYardsAfterCatch: number;
  receivingFirstDowns: number;
  receivingEPA: number;
  receiving2PtConversions: number;
  racr: number | null;
  targetShare: number | null;
  airYardsShare: number | null;
  wopr: number | null;
  pacr: number | null;
  dakota: number | null;
  specialTeamsTouchdowns: number;
}

interface CSVRecord {
  player_id: string;
  player_name: string;
  position: string;
  recent_team: string;
  season: string;
  week: string;
  season_type: string;
  opponent_team: string;
  fantasy_points: string;
  fantasy_points_ppr: string;
  completions: string;
  attempts: string;
  passing_yards: string;
  passing_tds: string;
  interceptions: string;
  sacks: string;
  sack_yards: string;
  sack_fumbles: string;
  sack_fumbles_lost: string;
  passing_air_yards: string;
  passing_yards_after_catch: string;
  passing_first_downs: string;
  passing_epa: string;
  passing_2pt_conversions: string;
  carries: string;
  rushing_yards: string;
  rushing_tds: string;
  rushing_fumbles: string;
  rushing_fumbles_lost: string;
  rushing_first_downs: string;
  rushing_epa: string;
  rushing_2pt_conversions: string;
  receptions: string;
  targets: string;
  receiving_yards: string;
  receiving_tds: string;
  receiving_fumbles: string;
  receiving_fumbles_lost: string;
  receiving_air_yards: string;
  receiving_yards_after_catch: string;
  receiving_first_downs: string;
  receiving_epa: string;
  receiving_2pt_conversions: string;
  racr: string;
  target_share: string;
  air_yards_share: string;
  wopr: string;
  pacr: string;
  dakota: string;
  special_teams_tds: string;
}

async function downloadWeeklyStats(year: number): Promise<string> {
  try {
    console.log(`Downloading weekly stats for ${year}...`);
    const url = `https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_${year}.csv`;
    const response = await axios.get<string>(url, { responseType: "text" });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to download weekly stats for ${year}: ${error.message}`,
      );
    }
    throw new Error(
      `Failed to download weekly stats for ${year}: Unknown error occurred`,
    );
  }
}

async function parseCSV(data: string): Promise<NFLPlayerWeeklyStats[]> {
  return new Promise((resolve, reject) => {
    const stats: NFLPlayerWeeklyStats[] = [];

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });

    const stream = Readable.from(data);
    stream
      .pipe(parser)
      .on("data", (record: CSVRecord) => {
        const stat: NFLPlayerWeeklyStats = {
          id: `${record.season}_${record.week}_${record.player_id}`,
          season: parseInt(record.season),
          week: parseInt(record.week),
          seasonType: record.season_type || "REG",
          playerId: record.player_id,
          playerName: record.player_name,
          position: record.position,
          team: record.recent_team,
          opponent: record.opponent_team,
          fantasyPoints: parseFloat(record.fantasy_points) || 0,
          fantasyPointsPPR: parseFloat(record.fantasy_points_ppr) || 0,
          completions: parseInt(record.completions) || 0,
          attempts: parseInt(record.attempts) || 0,
          passingYards: parseInt(record.passing_yards) || 0,
          passingTouchdowns: parseInt(record.passing_tds) || 0,
          interceptions: parseInt(record.interceptions) || 0,
          sacks: parseInt(record.sacks) || 0,
          sackYards: parseInt(record.sack_yards) || 0,
          sackFumbles: parseInt(record.sack_fumbles) || 0,
          sackFumblesLost: parseInt(record.sack_fumbles_lost) || 0,
          passingAirYards: parseInt(record.passing_air_yards) || 0,
          passingYardsAfterCatch:
            parseInt(record.passing_yards_after_catch) || 0,
          passingFirstDowns: parseInt(record.passing_first_downs) || 0,
          passingEPA: parseFloat(record.passing_epa) || 0,
          passing2PtConversions: parseInt(record.passing_2pt_conversions) || 0,
          carries: parseInt(record.carries) || 0,
          rushingYards: parseInt(record.rushing_yards) || 0,
          rushingTouchdowns: parseInt(record.rushing_tds) || 0,
          rushingFumbles: parseInt(record.rushing_fumbles) || 0,
          rushingFumblesLost: parseInt(record.rushing_fumbles_lost) || 0,
          rushingFirstDowns: parseInt(record.rushing_first_downs) || 0,
          rushingEPA: parseFloat(record.rushing_epa) || 0,
          rushing2PtConversions: parseInt(record.rushing_2pt_conversions) || 0,
          receptions: parseInt(record.receptions) || 0,
          targets: parseInt(record.targets) || 0,
          receivingYards: parseInt(record.receiving_yards) || 0,
          receivingTouchdowns: parseInt(record.receiving_tds) || 0,
          receivingFumbles: parseInt(record.receiving_fumbles) || 0,
          receivingFumblesLost: parseInt(record.receiving_fumbles_lost) || 0,
          receivingAirYards: parseInt(record.receiving_air_yards) || 0,
          receivingYardsAfterCatch:
            parseInt(record.receiving_yards_after_catch) || 0,
          receivingFirstDowns: parseInt(record.receiving_first_downs) || 0,
          receivingEPA: parseFloat(record.receiving_epa) || 0,
          receiving2PtConversions:
            parseInt(record.receiving_2pt_conversions) || 0,
          racr: record.racr ? parseFloat(record.racr) : null,
          targetShare: record.target_share
            ? parseFloat(record.target_share)
            : null,
          airYardsShare: record.air_yards_share
            ? parseFloat(record.air_yards_share)
            : null,
          wopr: record.wopr ? parseFloat(record.wopr) : null,
          pacr: record.pacr ? parseFloat(record.pacr) : null,
          dakota: record.dakota ? parseFloat(record.dakota) : null,
          specialTeamsTouchdowns: parseInt(record.special_teams_tds) || 0,
        };
        stats.push(stat);
      })
      .on("end", () => resolve(stats))
      .on("error", (error) => reject(error));
  });
}

async function importWeeklyStats(year: number) {
  try {
    const data = await downloadWeeklyStats(year);
    const stats = await parseCSV(data);

    console.log(`Processing ${stats.length} weekly stats for ${year}...`);
    let statsCreated = 0;

    // Process in chunks of 100
    for (let i = 0; i < stats.length; i += 100) {
      const statsChunk = stats.slice(i, i + 100);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const stat of statsChunk) {
          try {
            const existingStat = await tx.playerWeeklyStats.findUnique({
              where: {
                playerId_season_week_seasonType: {
                  playerId: stat.playerId,
                  season: stat.season,
                  week: stat.week,
                  seasonType: stat.seasonType,
                },
              },
            });

            if (!existingStat) {
              await tx.playerWeeklyStats.create({
                data: stat,
              });
              statsCreated++;
            }
          } catch (error) {
            console.error(
              `Error processing stats for player ${stat.playerId} in week ${stat.week}:`,
              error,
            );
            continue;
          }
        }
      });

      if (statsCreated % 1000 === 0) {
        console.log(`Created ${statsCreated} weekly stats...`);
      }
    }

    console.log(
      `Completed importing weekly stats for ${year}. Created ${statsCreated} stats.`,
    );
  } catch (error) {
    console.error(`Failed to import weekly stats for ${year}:`, error);
    throw error;
  }
}

async function main() {
  try {
    console.log("Starting weekly stats import...");
    // Import weekly stats for years 1999-2024
    for (let year = 1999; year <= 2024; year++) {
      console.log(`Processing year ${year}...`);
      await importWeeklyStats(year);
    }
    console.log("Weekly stats import completed");
  } catch (error) {
    console.error("Failed to import weekly stats:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
