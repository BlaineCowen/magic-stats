import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { parse } from "csv-parse";
import { Readable } from "stream";

const prisma = new PrismaClient({
  log: ["error"],
});

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const BATCH_SIZE = 500; // Increased from 100 to 500
const DEADLOCK_RETRY_DELAY = 1000; // 1 second
const CONCURRENT_YEARS = 3; // Process 3 years at a time

interface NFLPlayByPlay {
  play_id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  season_type: string;
  week: string;
  season: string;
  posteam: string;
  defteam: string;
  yardline_100: string;
  quarter_seconds_remaining: string;
  half_seconds_remaining: string;
  game_seconds_remaining: string;
  game_half: string;
  qtr: string;
  down: string;
  goal_to_go: string;
  time: string;
  yrdln: string;
  ydstogo: string;
  yards_gained: string;
  desc: string;
  play_type: string;
  shotgun: string;
  no_huddle: string;
  qb_dropback: string;
  qb_kneel: string;
  qb_spike: string;
  qb_scramble: string;
  pass_length: string;
  pass_location: string;
  air_yards: string;
  yards_after_catch: string;
  run_location: string;
  run_gap: string;
  field_goal_result: string;
  kick_distance: string;
  home_timeouts_remaining: string;
  away_timeouts_remaining: string;
  total_home_score: string;
  total_away_score: string;
  epa: string;
  ep: string;
  cpoe: string;
  success: string;
  passer_player_id: string;
  passer_player_name: string;
  receiver_player_id: string;
  receiver_player_name: string;
  rusher_player_id: string;
  rusher_player_name: string;
  passing_yards: string;
  receiving_yards: string;
  rushing_yards: string;
  punt_blocked: string;
  punt_inside_twenty: string;
  punt_in_endzone: string;
  punt_out_of_bounds: string;
  punt_downed: string;
  punt_fair_catch: string;
  kickoff_inside_twenty: string;
  kickoff_in_endzone: string;
  kickoff_out_of_bounds: string;
  kickoff_downed: string;
  kickoff_fair_catch: string;
  return_team: string;
  return_yards: string;
  punter_player_id: string;
  punter_player_name: string;
  kicker_player_id: string;
  kicker_player_name: string;
  stadium: string;
  weather: string;
  surface: string;
  roof: string;
  temp: string;
  wind: string;
  home_coach: string;
  away_coach: string;
  total_home_rush_epa: string;
  total_away_rush_epa: string;
  total_home_pass_epa: string;
  total_away_pass_epa: string;
  air_epa: string;
  yac_epa: string;
  xyac_epa: string;
  xyac_mean_yardage: string;
  xyac_median_yardage: string;
  xyac_success: string;
  xyac_fd: string;
  xpass: string;
  pass_oe: string;
  wp: string;
}

interface ProcessedPlay {
  id: string;
  gameId: string;
  quarter: number;
  down: number | null;
  yardsToGo: number | null;
  yardsGained: number | null;
  playType: string;
  possessionTeam: string | null;
  defensiveTeam: string | null;
  playDescription: string | null;
  epa: number | null;
  cpoe: number | null;
  success: boolean;
  details?: {
    create: {
      id: string;
      yardline100: number | null;
      quarterSecsRemaining: number | null;
      halfSecsRemaining: number | null;
      gameSecsRemaining: number | null;
      goalToGo: boolean | null;
      shotgun: boolean | null;
      noHuddle: boolean | null;
      qbDropback: boolean | null;
      qbKneel: boolean | null;
      qbSpike: boolean | null;
      qbScramble: boolean | null;
      passLength: string | null;
      passLocation: string | null;
      runLocation: string | null;
      runGap: string | null;
      fieldGoalResult: string | null;
      kickDistance: number | null;
    };
  };
  participants?: {
    create: {
      id: string;
      passerId: string | null;
      passerName: string | null;
      receiverId: string | null;
      receiverName: string | null;
      rusherId: string | null;
      rusherName: string | null;
      tacklers: string[];
      assistTacklers: string[];
      blockingPlayers: string[];
      passingYards: number | null;
      receivingYards: number | null;
      rushingYards: number | null;
    };
  };
  advancedStats?: {
    create: {
      id: string;
      airYards: number | null;
      yardsAfterCatch: number | null;
      expectedPoints: number | null;
      winProbability: number | null;
      expectedYards: number | null;
      success: boolean | null;
      successProbability: number | null;
      totalHomeEpa: number | null;
      totalAwayEpa: number | null;
      totalHomeRushEpa: number | null;
      totalAwayRushEpa: number | null;
      totalHomePassEpa: number | null;
      totalAwayPassEpa: number | null;
      airEpa: number | null;
      yacEpa: number | null;
      xyacEpa: number | null;
      xyacMeanYardage: number | null;
      xyacMedianYardage: number | null;
      xyacSuccess: number | null;
      xyacFd: number | null;
      xpass: number | null;
      passOe: number | null;
    };
  };
  gameInfo?: {
    create: {
      id: string;
      homeScore: number | null;
      awayScore: number | null;
      location: string | null;
      stadium: string | null;
      weather: string | null;
      surface: string | null;
      roof: string | null;
      temperature: number | null;
      windSpeed: number | null;
      homeCoach: string | null;
      awayCoach: string | null;
    };
  };
  specialTeams?: {
    create: {
      id: string;
      puntBlocked: boolean | null;
      puntInsideTwenty: boolean | null;
      puntInEndzone: boolean | null;
      puntOutOfBounds: boolean | null;
      puntDowned: boolean | null;
      puntFairCatch: boolean | null;
      kickoffInsideTwenty: boolean | null;
      kickoffInEndzone: boolean | null;
      kickoffOutOfBounds: boolean | null;
      kickoffDowned: boolean | null;
      kickoffFairCatch: boolean | null;
      returnTeam: string | null;
      returnYards: number | null;
      punterPlayerId: string | null;
      punterPlayerName: string | null;
      kickerPlayerId: string | null;
      kickerPlayerName: string | null;
      returnerPlayerId: string | null;
      returnerPlayerName: string | null;
    };
  };
}

interface Game {
  id: string;
  season: number;
  week: number;
  gameType: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadPlayByPlayData(
  year: number,
  retryCount = 0,
): Promise<string> {
  try {
    console.log(`Downloading play-by-play data for ${year}...`);
    const url = `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${year}.csv`;
    const response = await axios.get<string>(url, {
      responseType: "text",
      timeout: 30000, // 30 second timeout
    });
    console.log(`Successfully downloaded data for ${year}`);
    return response.data;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`Retry ${retryCount + 1} for year ${year}...`);
      await sleep(RETRY_DELAY);
      return downloadPlayByPlayData(year, retryCount + 1);
    }
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to download play-by-play data after ${MAX_RETRIES} retries: ${error.message}`,
      );
    }
    throw new Error(
      `Failed to download play-by-play data after ${MAX_RETRIES} retries: Unknown error occurred`,
    );
  }
}

async function parseCSV(data: string): Promise<NFLPlayByPlay[]> {
  return new Promise((resolve, reject) => {
    const records: NFLPlayByPlay[] = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });

    const stream = Readable.from(data);
    stream
      .pipe(parser)
      .on("data", (record: unknown) => {
        // Type guard for NFLPlayByPlay
        if (typeof record === "object" && record !== null) {
          // Log the first skipped record to see what's wrong
          if (records.length === 0) {
            console.log("First record:", record);
          }
          records.push(record as NFLPlayByPlay);
        } else {
          console.warn("Skipping record with invalid format:", record);
        }
      })
      .on("end", () => resolve(records))
      .on("error", (error) => reject(error));
  });
}

async function processGameBatch(games: Map<string, Game>) {
  const operations = Array.from(games.values()).map((game) =>
    prisma.game.upsert({
      where: { id: game.id },
      create: {
        id: game.id,
        season: game.season,
        week: game.week,
        gameType: game.gameType,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
      },
      update: {
        homeScore: game.homeScore,
        awayScore: game.awayScore,
      },
    }),
  );

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      await prisma.$transaction(operations);
      break;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message?.includes("deadlock detected") &&
        retries < MAX_RETRIES - 1
      ) {
        retries++;
        await sleep(DEADLOCK_RETRY_DELAY * retries);
        continue;
      }
      throw error;
    }
  }
}

function processRawPlay(play: NFLPlayByPlay): ProcessedPlay {
  const rawPlayId = String(play.play_id);
  const gameId = String(play.game_id);
  const id = `${gameId}_${rawPlayId}`;

  const processedPlay: ProcessedPlay = {
    id,
    gameId,
    quarter: parseInt(play.qtr) || 1,
    down: play.down ? parseInt(play.down) : null,
    yardsToGo: play.ydstogo ? parseInt(play.ydstogo) : null,
    yardsGained: play.yards_gained ? parseFloat(play.yards_gained) : null,
    playType: play.play_type || "",
    possessionTeam: play.posteam,
    defensiveTeam: play.defteam,
    playDescription: play.desc,
    epa: play.epa ? parseFloat(play.epa) : null,
    cpoe: play.cpoe ? parseFloat(play.cpoe) : null,
    success: parseSuccess(play.success),
  };

  // Add PlayDetails if relevant fields exist
  if (
    play.yardline_100 ||
    play.quarter_seconds_remaining ||
    play.shotgun ||
    play.pass_length
  ) {
    processedPlay.details = {
      create: {
        id: `${id}_details`,
        yardline100: play.yardline_100 ? parseInt(play.yardline_100) : null,
        quarterSecsRemaining: play.quarter_seconds_remaining
          ? parseInt(play.quarter_seconds_remaining)
          : null,
        halfSecsRemaining: play.half_seconds_remaining
          ? parseInt(play.half_seconds_remaining)
          : null,
        gameSecsRemaining: play.game_seconds_remaining
          ? parseInt(play.game_seconds_remaining)
          : null,
        goalToGo: play.goal_to_go === "1",
        shotgun: play.shotgun === "1",
        noHuddle: play.no_huddle === "1",
        qbDropback: play.qb_dropback === "1",
        qbKneel: play.qb_kneel === "1",
        qbSpike: play.qb_spike === "1",
        qbScramble: play.qb_scramble === "1",
        passLength: play.pass_length || null,
        passLocation: play.pass_location || null,
        runLocation: play.run_location || null,
        runGap: play.run_gap || null,
        fieldGoalResult: play.field_goal_result || null,
        kickDistance: play.kick_distance ? parseInt(play.kick_distance) : null,
      },
    };
  }

  // Add PlayParticipants if relevant fields exist
  if (
    play.passer_player_id ||
    play.receiver_player_id ||
    play.rusher_player_id
  ) {
    processedPlay.participants = {
      create: {
        id: `${id}_participants`,
        passerId: play.passer_player_id || null,
        passerName: play.passer_player_name || null,
        receiverId: play.receiver_player_id || null,
        receiverName: play.receiver_player_name || null,
        rusherId: play.rusher_player_id || null,
        rusherName: play.rusher_player_name || null,
        tacklers: [], // Would need to parse from play description
        assistTacklers: [], // Would need to parse from play description
        blockingPlayers: [], // Would need to parse from play description
        passingYards: play.passing_yards ? parseInt(play.passing_yards) : null,
        receivingYards: play.receiving_yards
          ? parseInt(play.receiving_yards)
          : null,
        rushingYards: play.rushing_yards ? parseInt(play.rushing_yards) : null,
      },
    };
  }

  // Add PlayAdvancedStats if relevant fields exist
  if (play.air_yards || play.yards_after_catch || play.epa) {
    processedPlay.advancedStats = {
      create: {
        id: `${id}_advanced_stats`,
        airYards: play.air_yards ? parseInt(play.air_yards) : null,
        yardsAfterCatch: play.yards_after_catch
          ? parseInt(play.yards_after_catch)
          : null,
        expectedPoints: play.ep ? parseFloat(play.ep) : null,
        winProbability: play.wp ? parseFloat(play.wp) : null,
        expectedYards: null, // Not in source data
        success: play.success === "1",
        successProbability: null, // Not in source data
        totalHomeEpa: play.total_home_rush_epa
          ? parseFloat(play.total_home_rush_epa)
          : null,
        totalAwayEpa: play.total_away_rush_epa
          ? parseFloat(play.total_away_rush_epa)
          : null,
        totalHomeRushEpa: play.total_home_rush_epa
          ? parseFloat(play.total_home_rush_epa)
          : null,
        totalAwayRushEpa: play.total_away_rush_epa
          ? parseFloat(play.total_away_rush_epa)
          : null,
        totalHomePassEpa: play.total_home_pass_epa
          ? parseFloat(play.total_home_pass_epa)
          : null,
        totalAwayPassEpa: play.total_away_pass_epa
          ? parseFloat(play.total_away_pass_epa)
          : null,
        airEpa: play.air_epa ? parseFloat(play.air_epa) : null,
        yacEpa: play.yac_epa ? parseFloat(play.yac_epa) : null,
        xyacEpa: play.xyac_epa ? parseFloat(play.xyac_epa) : null,
        xyacMeanYardage: play.xyac_mean_yardage
          ? parseFloat(play.xyac_mean_yardage)
          : null,
        xyacMedianYardage: play.xyac_median_yardage
          ? parseFloat(play.xyac_median_yardage)
          : null,
        xyacSuccess: play.xyac_success ? parseFloat(play.xyac_success) : null,
        xyacFd: play.xyac_fd ? parseFloat(play.xyac_fd) : null,
        xpass: play.xpass ? parseFloat(play.xpass) : null,
        passOe: play.pass_oe ? parseFloat(play.pass_oe) : null,
      },
    };
  }

  // Add PlayGameInfo if relevant fields exist
  if (play.stadium || play.weather || play.temp) {
    processedPlay.gameInfo = {
      create: {
        id: `${id}_game_info`,
        homeScore: play.total_home_score
          ? parseInt(play.total_home_score)
          : null,
        awayScore: play.total_away_score
          ? parseInt(play.total_away_score)
          : null,
        location: null, // Not in source data
        stadium: play.stadium || null,
        weather: play.weather || null,
        surface: play.surface || null,
        roof: play.roof || null,
        temperature: play.temp ? parseInt(play.temp) : null,
        windSpeed: play.wind ? parseInt(play.wind) : null,
        homeCoach: play.home_coach || null,
        awayCoach: play.away_coach || null,
      },
    };
  }

  // Add PlaySpecialTeams if relevant fields exist
  if (
    play.punt_blocked ||
    play.kickoff_inside_twenty ||
    play.punt_inside_twenty
  ) {
    processedPlay.specialTeams = {
      create: {
        id: `${id}_special_teams`,
        puntBlocked: play.punt_blocked === "1",
        puntInsideTwenty: play.punt_inside_twenty === "1",
        puntInEndzone: play.punt_in_endzone === "1",
        puntOutOfBounds: play.punt_out_of_bounds === "1",
        puntDowned: play.punt_downed === "1",
        puntFairCatch: play.punt_fair_catch === "1",
        kickoffInsideTwenty: play.kickoff_inside_twenty === "1",
        kickoffInEndzone: play.kickoff_in_endzone === "1",
        kickoffOutOfBounds: play.kickoff_out_of_bounds === "1",
        kickoffDowned: play.kickoff_downed === "1",
        kickoffFairCatch: play.kickoff_fair_catch === "1",
        returnTeam: play.return_team || null,
        returnYards: play.return_yards ? parseInt(play.return_yards) : null,
        punterPlayerId: play.punter_player_id || null,
        punterPlayerName: play.punter_player_name || null,
        kickerPlayerId: play.kicker_player_id || null,
        kickerPlayerName: play.kicker_player_name || null,
        returnerPlayerId: null, // Not in source data
        returnerPlayerName: null, // Not in source data
      },
    };
  }

  return processedPlay;
}

async function processPlayBatch(plays: NFLPlayByPlay[]) {
  const operations = plays.map((play) => {
    const processedPlay = processRawPlay(play);
    return prisma.play.upsert({
      where: { id: processedPlay.id },
      create: processedPlay,
      update: processedPlay,
    });
  });

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      await prisma.$transaction(operations);
      return;
    } catch (error) {
      if (error instanceof Error && error.message?.includes("deadlock")) {
        retries++;
        if (retries < MAX_RETRIES) {
          console.log(`Deadlock detected, retry ${retries}/${MAX_RETRIES}...`);
          await sleep(DEADLOCK_RETRY_DELAY);
          continue;
        }
      }
      throw error;
    }
  }
}

function parseSuccess(value: unknown): boolean {
  if (typeof value === "string") {
    return value === "1";
  }
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return false;
}

function isValidPlay(play: NFLPlayByPlay): boolean {
  // Skip timeouts, end of quarter, etc.
  if (!play.play_type) {
    return false;
  }

  // Skip plays without a valid ID
  if (!play.play_id) {
    return false;
  }

  // Skip plays without a valid game ID
  if (!play.game_id) {
    return false;
  }

  // Skip plays without a valid quarter
  if (!play.qtr) {
    return false;
  }

  return true;
}

async function importPlayByPlay(year: number) {
  try {
    const data = await downloadPlayByPlayData(year);
    const plays = await parseCSV(data);

    console.log(`Processing ${plays.length} plays for ${year}...`);
    let playsProcessed = 0;
    let playsSkipped = 0;

    // First, process all unique games
    const games = new Map<string, Game>();
    for (const play of plays) {
      const gameId = String(play.game_id);
      if (!games.has(gameId)) {
        games.set(gameId, {
          id: gameId,
          season: parseInt(play.season),
          week: parseInt(play.week),
          gameType: play.season_type,
          homeTeam: play.home_team,
          awayTeam: play.away_team,
          homeScore: parseInt(play.total_home_score) || 0,
          awayScore: parseInt(play.total_away_score) || 0,
        });
      }
    }

    console.log(`Processing ${games.size} games for ${year}...`);
    await processGameBatch(games);

    // Then process plays in smaller batches
    for (let i = 0; i < plays.length; i += BATCH_SIZE) {
      const playBatch = plays.slice(i, i + BATCH_SIZE);
      const processedPlays: NFLPlayByPlay[] = [];

      for (const play of playBatch) {
        try {
          processedPlays.push(play);
          playsProcessed++;
        } catch (error) {
          console.error(`Error processing play ${play.play_id}:`, {
            error: error instanceof Error ? error.message : "Unknown error",
            play: {
              id: play.play_id,
              gameId: play.game_id,
              playType: play.play_type,
              desc: play.desc,
            },
          });
          playsSkipped++;
        }
      }

      if (processedPlays.length > 0) {
        try {
          await processPlayBatch(processedPlays);
          console.log(
            `Year ${year}: Processed ${i + playBatch.length} plays (${playsProcessed} created, ${playsSkipped} skipped)`,
          );

          // Verify play count after each batch
          const playCount = await prisma.play.count({
            where: {
              gameId: {
                startsWith: String(year),
              },
            },
          });
          console.log(`Current play count for ${year}: ${playCount}`);
        } catch (error) {
          console.error(`Error in batch transaction for year ${year}:`, error);
          playsSkipped += playBatch.length;
        }
      }
    }

    // Final verification for this year
    const finalPlayCount = await prisma.play.count({
      where: {
        gameId: {
          startsWith: String(year),
        },
      },
    });
    console.log(`Completed importing plays for ${year}. Final counts:`, {
      processed: playsProcessed,
      skipped: playsSkipped,
      inDatabase: finalPlayCount,
      totalInCSV: plays.length,
    });
  } catch (error) {
    console.error(`Failed to import play-by-play data for ${year}:`, error);
    throw error;
  }
}

async function main() {
  try {
    console.log("Starting play-by-play data import for 1999-2024...");

    const startTime = Date.now();

    // Process years sequentially to avoid deadlocks
    for (let year = 1999; year <= 2024; year++) {
      console.log(`\nProcessing year ${year}...`);
      try {
        await importPlayByPlay(year);
      } catch (error) {
        console.error(`Failed to import data for ${year}:`, error);
        // Continue with next year even if one fails
        continue;
      }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds
    console.log(
      `\nPlay-by-play data import completed in ${duration.toFixed(2)} seconds`,
    );
  } catch (error) {
    console.error("Failed to import play-by-play data:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
