import type { PrismaClient, Prisma } from "@prisma/client";

export type GameTransaction = Prisma.TransactionClient;
export type PlayTransaction = Prisma.TransactionClient;

export interface NFLPlay {
  // Base play information
  game_id: string;
  play_id: string;
  season: string;
  week: string;
  season_type: string;
  home_team: string;
  away_team: string;
  home_score: string;
  away_score: string;
  total_home_score: string;
  total_away_score: string;
  qtr: string | null;
  down: string | null;
  ydstogo: string | null;
  yards_gained: string | null;
  play_type: string | null;
  posteam: string | null;
  defteam: string | null;
  desc: string | null;
  epa: string | null;
  cpoe: string | null;
  success: string | null;
  success_probability: string | null;
  expected_yards: string | null;

  // Play details
  yardline_100: string | null;
  quarter_seconds_remaining: string | null;
  half_seconds_remaining: string | null;
  game_seconds_remaining: string | null;
  goal_to_go: string | null;
  shotgun: string | null;
  no_huddle: string | null;
  qb_dropback: string | null;
  qb_kneel: string | null;
  qb_spike: string | null;
  qb_scramble: string | null;
  pass_length: string | null;
  pass_location: string | null;
  run_location: string | null;
  run_gap: string | null;
  field_goal_result: string | null;
  kick_distance: string | null;

  // Timeouts
  home_timeouts_remaining: string | null;
  away_timeouts_remaining: string | null;
  timeout: string | null;
  timeout_team: string | null;

  // Advanced stats
  air_yards: string | null;
  yards_after_catch: string | null;
  expected_points: string | null;
  wp: string | null;
  def_wp: string | null;
  home_wp: string | null;
  away_wp: string | null;
  total_home_epa: string | null;
  total_away_epa: string | null;
  total_home_rush_epa: string | null;
  total_away_rush_epa: string | null;
  total_home_pass_epa: string | null;
  total_away_pass_epa: string | null;
  air_epa: string | null;
  yac_epa: string | null;
  xyac_epa: string | null;
  xyac_mean_yardage: string | null;
  xyac_median_yardage: string | null;
  xyac_success: string | null;
  xyac_fd: string | null;
  xpass: string | null;
  pass_oe: string | null;

  // Game info
  stadium: string | null;
  weather: string | null;
  surface: string | null;
  roof: string | null;
  temperature: string | null;
  windSpeed: string | null;
  home_coach: string | null;
  away_coach: string | null;

  // Special teams
  punt_blocked: string | null;
  punt_inside_twenty: string | null;
  punt_in_endzone: string | null;
  punt_out_of_bounds: string | null;
  punt_downed: string | null;
  punt_fair_catch: string | null;
  kickoff_inside_twenty: string | null;
  kickoff_in_endzone: string | null;
  kickoff_out_of_bounds: string | null;
  kickoff_downed: string | null;
  kickoff_fair_catch: string | null;
  return_team: string | null;
  return_yards: string | null;
  punter_player_id: string | null;
  punter_player_name: string | null;
  kicker_player_id: string | null;
  kicker_player_name: string | null;
  returner_player_id: string | null;
  returner_player_name: string | null;

  // Player participation
  passer_player_id: string | null;
  passer_player_name: string | null;
  receiver_player_id: string | null;
  receiver_player_name: string | null;
  rusher_player_id: string | null;
  rusher_player_name: string | null;
  passing_yards: string | null;
  receiving_yards: string | null;
  rushing_yards: string | null;

  // Sack information
  sack_player_id: string | null;
  sack_player_name: string | null;
  half_sack_1_player_id: string | null;
  half_sack_1_player_name: string | null;
  half_sack_2_player_id: string | null;
  half_sack_2_player_name: string | null;

  // Fumble information
  fumble_forced: string | null;
  fumble_lost: string | null;
  fumble_out_of_bounds: string | null;
  fumbled_1_team: string | null;
  fumbled_1_player_id: string | null;
  fumbled_1_player_name: string | null;
  fumble_recovery_1_team: string | null;
  fumble_recovery_1_yards: string | null;
  fumble_recovery_1_player_id: string | null;
  fumble_recovery_1_player_name: string | null;

  // Interception information
  interception_player_id: string | null;
  interception_player_name: string | null;

  // Drive information
  drive_play_count: string | null;
  drive_time_of_possession: string | null;
  drive_first_downs: string | null;
  drive_inside20: string | null;
  drive_ended_with_score: string | null;
  drive_quarter_start: string | null;
  drive_quarter_end: string | null;
  drive_yards_penalized: string | null;
  drive_start_transition: string | null;
  drive_end_transition: string | null;
  drive_start_yard_line: string | null;
  drive_end_yard_line: string | null;
}

export interface GameData {
  id: string;
  season: number;
  week: number;
  gameType: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface PlayData {
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
}

export interface PlayDetailsData {
  id: string;
  playId: string;
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
}

export interface PlayParticipantsData {
  id: string;
  playId: string;
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
}

export interface PlayAdvancedStatsData {
  id: string;
  playId: string;
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
}

export interface PlayGameInfoData {
  id: string;
  playId: string;
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
}

export interface PlaySpecialTeamsData {
  id: string;
  playId: string;
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
}

export interface PlayTimeoutsData {
  id: string;
  playDetailsId: string;
  homeRemaining: number;
  awayRemaining: number;
  timeoutTeam: string | null;
}

export interface DriveInfoData {
  id: string;
  playDetailsId: string;
  drivePlayCount: number | null;
  driveTimeOfPossession: string | null;
  driveFirstDowns: number | null;
  driveInside20: boolean | null;
  driveEndedWithScore: boolean | null;
  driveQuarterStart: number | null;
  driveQuarterEnd: number | null;
  driveYardsPenalized: number | null;
  driveStartTransition: string | null;
  driveEndTransition: string | null;
  driveStartYardLine: string | null;
  driveEndYardLine: string | null;
}

export interface SackPlayersData {
  id: string;
  playParticipantsId: string;
  sackPlayerId: string | null;
  sackPlayerName: string | null;
  halfSack1PlayerId: string | null;
  halfSack1PlayerName: string | null;
  halfSack2PlayerId: string | null;
  halfSack2PlayerName: string | null;
}

export interface FumbleInfoData {
  id: string;
  playParticipantsId: string;
  fumbledTeam: string | null;
  fumbledPlayerId: string | null;
  fumbledPlayerName: string | null;
  recoveryTeam: string | null;
  recoveryYards: number | null;
  recoveryPlayerId: string | null;
  recoveryPlayerName: string | null;
  forced: boolean | null;
  lost: boolean | null;
  outOfBounds: boolean | null;
}

export interface InterceptionInfoData {
  id: string;
  playParticipantsId: string;
  interceptionPlayerId: string | null;
  interceptionPlayerName: string | null;
}

export interface ProcessedPlayData {
  play: PlayData;
  details: PlayDetailsData;
  participants: PlayParticipantsData;
  advancedStats: PlayAdvancedStatsData;
  gameInfo: PlayGameInfoData;
  specialTeams: PlaySpecialTeamsData;
  timeouts: PlayTimeoutsData[];
  driveInfo: DriveInfoData[];
  sackPlayers: SackPlayersData[];
  fumbleInfo: FumbleInfoData[];
  interceptionInfo: InterceptionInfoData[];
}

export interface ProcessedGame {
  game: GameData;
  plays: ProcessedPlayData[];
}

export interface ProcessedPlayCreateInput {
  id: string;
  game: {
    connect: {
      id: string;
    };
  };
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
    create: PlayDetailsData;
  };
  participants?: {
    create: PlayParticipantsData;
  };
  advancedStats?: {
    create: PlayAdvancedStatsData;
  };
  gameInfo?: {
    create: PlayGameInfoData;
  };
  specialTeams?: {
    create: PlaySpecialTeamsData;
  };
}
