import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/prefer-regexp-exec */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

const API_BASE_URL = process.env.R_API_URL ?? "http://localhost:8000";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type QueryRequest = {
  query: string;
};

// Initialize Gemini AI
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// AI prompt for converting natural language to nflreadr code
const AI_PROMPT = `You are an expert at converting natural language queries about NFL statistics into R code using the nflreadr package.

IMPORTANT: Return ONLY the R code, no markdown formatting, no backticks, no explanations.

## AVAILABLE NFLREADR FUNCTIONS:

### Core Data Functions:
- load_player_stats(season) - Player weekly stats (1999-2024) - includes both regular season and playoffs
- load_rosters(season) - Player rosters and info
- load_schedules(season) - Game schedules and results
- load_pbp(season) - Play-by-play data (1999-2024)
- load_teams() - Team information and logos

### Additional Data:
- load_combine() - NFL Combine data
- load_contracts() - Player contracts
- load_draft_picks() - Draft picks
- load_injuries() - Injury reports
- load_nextgen_stats() - Next Gen Stats
- load_officials() - Game officials
- load_participation() - Player participation
- load_snap_counts() - Snap counts
- load_trades() - Player trades

### Utility Functions:
- get_current_season() - Returns current year
- clean_player_names() - Clean player names
- clean_team_abbrs() - Clean team abbreviations

## COMPLETE COLUMN DICTIONARIES:

### PLAYER_STATS COLUMNS:
- player_id: ID of the player. Use this to join to other sources.
- player_name: Name of the player
- recent_team: Most recent team player appears in pbp with.
- season: Official NFL season
- week: Game week number
- season_type: REG for regular season, POST for postseason
- completions: The number of completed passes.
- attempts: The number of pass attempts as defined by the NFL.
- passing_yards: Yards gained on pass plays.
- passing_tds: The number of passing touchdowns.
- interceptions: The number of interceptions thrown.
- sacks: The Number of times sacked.
- sack_yards: Yards lost on sack plays.
- sack_fumbles: The number of sacks with a fumble.
- sack_fumbles_lost: The number of sacks with a lost fumble.
- passing_air_yards: Passing air yards (includes incomplete passes).
- passing_yards_after_catch: Yards after the catch gained on plays in which player was the passer
- passing_first_downs: First downs on pass attempts.
- passing_epa: Total expected points added on pass attempts and sacks.
- passing_2pt_conversions: Two-point conversion passes.
- dakota: Adjusted EPA + CPOE composite based on coefficients which best predict adjusted EPA/play in the following year.
- carries: The number of official rush attempts (incl. scrambles and kneel downs).
- rushing_yards: Yards gained when rushing with the ball (incl. scrambles and kneel downs).
- rushing_tds: The number of rushing touchdowns (incl. scrambles).
- rushing_fumbles: The number of rushes with a fumble.
- rushing_fumbles_lost: The number of rushes with a lost fumble.
- rushing_first_downs: First downs on rush attempts (incl. scrambles).
- rushing_epa: Expected points added on rush attempts (incl. scrambles and kneel downs).
- rushing_2pt_conversions: Two-point conversion rushes
- receptions: The number of pass receptions. Lateral receptions officially don't count as reception.
- targets: The number of pass plays where the player was the targeted receiver.
- receiving_yards: Yards gained after a pass reception.
- receiving_tds: The number of touchdowns following a pass reception.
- receiving_air_yards: Receiving air yards (incl. incomplete passes).
- receiving_yards_after_catch: Yards after the catch gained on plays in which player was receiver
- receiving_fumbles: The number of fumbles after a pass reception.
- receiving_fumbles_lost: The number of fumbles lost after a pass reception.
- receiving_2pt_conversions: Two-point conversion receptions
- fantasy_points: Standard fantasy points.
- fantasy_points_ppr: PPR fantasy points.
- air_yards_share: Player's share of the team's air yards in this game
- pacr: Passing (yards) Air (yards) Conversion Ratio - the number of passing yards per air yards thrown per game
- racr: Receiving (yards) Air (yards) Conversion Ratio - the number of receiving yards per air yards targeted per game
- receiving_epa: Total EPA on plays where this receiver was targeted
- receiving_first_downs: Total number of first downs gained on receptions
- special_teams_tds: Total number of kick/punt return touchdowns
- wopr: Weighted OPportunity Rating - 1.5 x target_share + 0.7 x air_yards_share
- target_share: Player's share of team receiving targets in this game

### PLAY-BY-PLAY KEY COLUMNS:
- play_id: Unique identifier for each play
- game_id: Unique identifier for each game
- home_team: Home team abbreviation
- away_team: Away team abbreviation
- season_type: REG or POST
- week: Week number
- posteam: Team with possession
- defteam: Defending team
- yardline_100: Yard line (1-100, where 1 is goal line)
- qtr: Quarter number
- down: Down number
- ydstogo: Yards to go for first down
- desc: Play description
- play_type: Type of play (pass, run, punt, etc.)
- yards_gained: Yards gained on the play
- epa: Expected Points Added
- wp: Win Probability
- passer_player_name: Name of passer
- receiver_player_name: Name of receiver
- rusher_player_name: Name of rusher
- touchdown: Boolean for touchdown
- pass_touchdown: Boolean for passing touchdown
- rush_touchdown: Boolean for rushing touchdown
- interception: Boolean for interception
- fumble: Boolean for fumble
- sack: Boolean for sack
- complete_pass: Boolean for completed pass
- rush_attempt: Boolean for rush attempt
- pass_attempt: Boolean for pass attempt

### ROSTERS KEY COLUMNS:
- season: NFL season. Defaults to current year after March, otherwise is previous year.
- team: NFL team. Uses official abbreviations as per NFL.com
- position: Primary position as reported by NFL.com
- depth_chart_position: Position assigned on depth chart. Not always accurate!
- jersey_number: Jersey number. Often useful for joins by name/team/jersey.
- status: Roster status: describes things like Active, Inactive, Injured Reserve, Practice Squad etc
- full_name: Full name as per NFL.com
- first_name: First name as per NFL.com
- last_name: Last name as per NFL.com
- birth_date: Birthdate, as recorded by Sleeper API
- height: Official height, in inches
- weight: Official weight, in pounds
- college: Official college (usually the last one attended)
- high_school: High school
- gsis_id: Game Stats and Info Service ID: the primary ID for play-by-play data.
- headshot_url: A URL string that points to player photos used by NFL.com (or sometimes ESPN)
- sleeper_id: Player ID for Sleeper API
- espn_id: Player ID for ESPN API
- yahoo_id: Player ID for Yahoo API
- rotowire_id: Player ID for Rotowire
- pff_id: Player ID for Pro Football Focus
- fantasy_data_id: Player ID for FantasyData
- years_exp: Years played in league
- sportradar_id: Player ID for Sportradar API
- pfr_id: Player ID for Pro Football Reference

### SCHEDULES KEY COLUMNS:
- game_id: A human-readable game ID. It consists of: the season, an underscore, the two-digit week number, an underscore, the away team, an underscore, the home team.
- season: The year of the NFL season. This represents the whole season, so regular season games that happen in January as well as playoff games will occur in the year after this number.
- game_type: What type of game? One of REG, WC, DIV, CON, SB
- week: The week of the NFL season the game occurs in. Please note that the game_type will differ for weeks >= 18 because of the season expansion in 2021. Please use game_type to filter for regular season or postseason.
- gameday: The date on which the game occurred.
- weekday: The day of the week on which the game occcured.
- gametime: The kickoff time of the game. This is represented in 24-hour time and the Eastern time zone, regardless of what time zone the game was being played in.
- away_team: The away team.
- away_score: The number of points the away team scored. Is NA for games which haven't yet been played.
- home_team: The home team. Note that this contains the designated home team for games which no team is playing at home such as Super Bowls or NFL International games.
- home_score: The number of points the home team scored. Is NA for games which haven't yet been played.
- location: Either Home if the home team is playing in their home stadium, or Neutral if the game is being played at a neutral location.
- result: The number of points the home team scored minus the number of points the visiting team scored. Equals h_score - v_score. Is NA for games which haven't yet been played. Convenient for evaluating against the spread bets.
- total: The sum of each team's score in the game. Equals h_score + v_score. Is NA for games which haven't yet been played. Convenient for evaluating over/under total bets.
- overtime: Binary indicator of whether or not game went to overtime.
- spread_line: The spread line for the game. A positive number means the home team was favored by that many points, a negative number means the away team was favored by that many points.
- total_line: The total line for the game.
- div_game: Binary indicator of whether or not game was played by 2 teams in the same division.
- roof: What was the status of the stadium's roof? One of outdoors, open, closed, dome
- surface: What type of ground the game was played on
- temp: The temperature at the stadium (for outdoors and open only)
- wind: The speed of the wind in miles/hour (for outdoors and open only)
- away_qb_id: GSIS Player ID for away team starting quarterback.
- home_qb_id: GSIS Player ID for home team starting quarterback.
- away_qb_name: Name of away team starting QB.
- home_qb_name: Name of home team starting QB.
- away_coach: Name of the head coach of the away team
- home_coach: Name of the head coach of the home team
- referee: Name of the game's referee (head official)
- stadium_id: ID of Stadium that game took place in
- stadium: Name of the stadium

### TEAM ABBREVIATIONS:
Use standard 2-3 letter codes: KC, DAL, SF, NE, GB, BUF, CIN, BAL, LAC, LAR, TB, MIA, NYJ, NYG, WAS, PHI, PIT, CLE, IND, HOU, JAX, TEN, ATL, CAR, NO, CHI, DET, MIN, GB, ARI, SEA, LV, DEN

## CONVERSION RULES:
1. Always use dplyr for data manipulation
2. Use proper aggregation (sum, mean, count) when needed
3. Limit results to reasonable amounts (max 50 rows for leaders)
4. Handle team names properly (use abbreviations)
5. Use na.rm=TRUE in aggregations
6. Return clean, readable data frames
7. For playoff data, filter by season_type == "POST" after loading player_stats
8. For regular season data, filter by season_type == "REG" after loading player_stats
9. Filter by week for specific weeks
10. Use player_name for player lookups
11. Use recent_team for team filtering in player_stats
12. Use team for team filtering in rosters and schedules
13. IMPORTANT: load_player_stats() returns weekly data, not season totals. Always group_by(player_name, recent_team) and summarise() when looking for season totals or filtering by cumulative stats like total attempts, yards, etc.
14. For season leaders, first group_by and summarise to get totals, then filter and arrange
15. CRITICAL: When filtering by cumulative stats (like "at least 200 attempts"), you MUST first group_by and summarise to get season totals, THEN filter. Never filter weekly data directly for cumulative thresholds.

## EXAMPLE CONVERSIONS:

"How many touchdowns did the Chiefs score in 2023?"
→ load_player_stats(season = 2023) %>% filter(recent_team == "KC") %>% summarise(total_tds = sum(passing_tds + rushing_tds + receiving_tds, na.rm = TRUE))

"Show me the top 10 passing yard leaders in 2024"
→ load_player_stats(season = 2024) %>% group_by(player_name, recent_team) %>% summarise(total_yards = sum(passing_yards, na.rm = TRUE)) %>% arrange(desc(total_yards)) %>% head(10)

"What was Tom Brady's completion percentage in 2022?"
→ load_player_stats(season = 2022) %>% filter(player_name == "T.Brady") %>% group_by(player_name, recent_team) %>% summarise(completion_pct = sum(completions, na.rm = TRUE) / sum(attempts, na.rm = TRUE) * 100)

"Show me all Cowboys games in 2024"
→ load_schedules(season = 2024) %>% filter(home_team == "DAL" | away_team == "DAL")

"Who had the most fantasy points in week 1 of 2024?"
→ load_player_stats(season = 2024) %>% filter(season_type == "REG", week == 1) %>% arrange(desc(fantasy_points)) %>% head(10)

"Show me all passing touchdowns in the 2023 playoffs"
→ load_pbp(season = 2023) %>% filter(season_type == "POST", pass_touchdown == TRUE) %>% select(game_id, week, posteam, passer_player_name, receiver_player_name, desc)

"Which team had the most sacks in 2024?"
→ load_player_stats(season = 2024) %>% group_by(recent_team) %>% summarise(total_sacks = sum(sacks, na.rm = TRUE)) %>% arrange(desc(total_sacks))

"Show me all quarterbacks on the Chiefs roster in 2024"
→ load_rosters(season = 2024) %>% filter(team == "KC", position == "QB")

"Show me quarterbacks with at least 200 attempts ranked by EPA per attempt"
→ load_player_stats(season = 2024) %>% group_by(player_name, recent_team) %>% summarise(total_attempts = sum(attempts, na.rm = TRUE), total_passing_epa = sum(passing_epa, na.rm = TRUE)) %>% filter(total_attempts >= 200) %>% mutate(epa_per_attempt = total_passing_epa / total_attempts) %>% arrange(desc(epa_per_attempt))

Return ONLY the R code, no markdown formatting, no backticks, no explanations.`;

// Generate a simple, natural interpretation of the query
function generateSimpleInterpretation(query: string, rCode: string): string {
  // Extract key information from the R code to create a natural description
  const lowerQuery = query.toLowerCase();

  // Common patterns for different types of queries
  if (rCode.includes("load_player_stats") && rCode.includes("arrange(desc(")) {
    if (lowerQuery.includes("top") || lowerQuery.includes("leader")) {
      const match = /head\((\d+)\)/.exec(rCode);
      const limit = match ? match[1] : "10";

      if (rCode.includes("passing_yards")) {
        return `Top ${limit} quarterbacks in passing yards`;
      } else if (rCode.includes("rushing_yards")) {
        return `Top ${limit} running backs in rushing yards`;
      } else if (rCode.includes("receiving_yards")) {
        return `Top ${limit} receivers in receiving yards`;
      } else if (rCode.includes("fantasy_points")) {
        return `Top ${limit} players in fantasy points`;
      } else if (rCode.includes("touchdown")) {
        return `Top ${limit} players in touchdowns`;
      } else if (rCode.includes("sacks")) {
        return `Top ${limit} players in sacks`;
      }
    }
  }

  if (rCode.includes("summarise") && rCode.includes("sum(")) {
    if (lowerQuery.includes("how many") || lowerQuery.includes("total")) {
      if (rCode.includes("touchdown")) {
        return `Total touchdowns`;
      } else if (rCode.includes("yards")) {
        return `Total yards`;
      } else if (rCode.includes("sacks")) {
        return `Total sacks`;
      }
    }
  }

  if (rCode.includes("load_schedules")) {
    return `Game results and schedules`;
  }

  if (rCode.includes("load_rosters")) {
    return `Player roster information`;
  }

  if (rCode.includes("load_pbp")) {
    return `Play-by-play data`;
  }

  // Default fallback - clean up the original query
  return query.replace(/[?]/g, "").trim();
}

// Helper function to call R API with custom code
async function executeRCode(rCode: string) {
  const response = await fetch(`${API_BASE_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: rCode }),
  });

  if (!response.ok) {
    throw new Error(`R API error: ${response.statusText}`);
  }
  return response.json() as Promise<unknown>;
}

// Convert natural language to R code using AI
async function convertToRCode(query: string): Promise<string> {
  if (!GEMINI_API_KEY || !genAI) {
    throw new Error("Gemini API key not configured");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(
    `${AI_PROMPT}\n\nUser query: ${query}`,
  );
  const response = result.response;
  let rCode = response.text().trim();

  // Clean up any markdown formatting
  rCode = rCode
    .replace(/```r?\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  console.log("Generated R code:", rCode);
  return rCode;
}

export async function POST(request: Request) {
  try {
    console.log("API_BASE_URL:", API_BASE_URL);

    const body = (await request.json()) as QueryRequest;
    const query = body.query;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    console.log("Processing query:", query);

    // Convert natural language to R code using AI
    const rCode = await convertToRCode(query);

    // Execute the R code on the VPS
    console.log("Executing R code on VPS...");
    console.log("R code to execute:", rCode);

    const vpsResponse = await executeRCode(rCode);
    console.log("VPS response:", JSON.stringify(vpsResponse, null, 2));

    // Extract the actual results from the VPS response
    const rawResult =
      (vpsResponse as { result?: unknown }).result ?? vpsResponse;

    // Transform the result to match frontend expectations
    // If it's an object with arrays, convert to array of objects
    let results;
    if (
      rawResult &&
      typeof rawResult === "object" &&
      !Array.isArray(rawResult)
    ) {
      // Check if values are arrays (like {"total_tds": [15]})
      const firstValue = Object.values(rawResult)[0];
      if (Array.isArray(firstValue)) {
        // Convert {"total_tds": [15]} to [{"total_tds": 15}]
        const keys = Object.keys(rawResult);
        const length = firstValue.length;
        results = Array.from({ length }, (_, i) => {
          const obj: Record<string, any> = {};
          keys.forEach((key) => {
            const value = (rawResult as Record<string, unknown>)[key];
            obj[key] = Array.isArray(value) ? (value as unknown[])[i] : value;
          });
          return obj;
        });
      } else {
        // Convert {"total_tds": 15} to [{"total_tds": 15}]
        results = [rawResult];
      }
    } else {
      results = rawResult;
    }

    // Generate a simple, natural interpretation
    const interpretation = generateSimpleInterpretation(query, rCode);

    return NextResponse.json({
      results: results,
      interpretation: interpretation,
      query_type: "ai_generated",
      r_code: rCode,
    });
  } catch (error) {
    console.error("Query error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process query";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
