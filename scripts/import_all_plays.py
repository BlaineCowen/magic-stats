import os
import pandas as pd
import psycopg
import logging
from datetime import datetime
import requests
from psycopg.rows import dict_row
from psycopg.copy import Copy
import sys
from concurrent.futures import ThreadPoolExecutor
from io import StringIO
import io
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

def parse_schema_analysis():
    """Parse schema_analysis.txt to get column type mappings."""
    schema_file = 'samples/schema_analysis.txt'
    column_mappings = {}
    
    try:
        with open(schema_file, 'r') as f:
            content = f.read()
        
        # Find the table section with column mappings
        lines = content.split('\n')
        in_mappings = False
        
        for line in lines:
            if '| Original Column | CamelCase | Pandas Type | Prisma Type |' in line:
                in_mappings = True
                continue
            
            if in_mappings and line.startswith('|') and '|' in line[1:]:
                parts = [part.strip() for part in line.split('|')]
                if len(parts) >= 5:
                    original_col = parts[1]
                    camel_case = parts[2]
                    pandas_type = parts[3]
                    prisma_type = parts[4]
                    
                    if original_col and camel_case and prisma_type:
                        column_mappings[original_col] = {
                            'camelCase': camel_case,
                            'pandasType': pandas_type,
                            'prismaType': prisma_type
                        }
            
            # Stop when we hit a line that doesn't look like a mapping
            elif in_mappings and (not line.startswith('|') or len(line.strip()) < 10):
                break
        
        logger.info(f"Parsed {len(column_mappings)} column mappings from schema analysis")
        return column_mappings
        
    except Exception as e:
        logger.error(f"Failed to parse schema analysis: {e}")
        return {}

def get_column_type_mappings():
    """Get column type mappings for different operations."""
    mappings = parse_schema_analysis()
    
    # Group columns by Prisma type
    int_columns = []
    float_columns = []
    boolean_columns = []
    datetime_columns = []
    text_columns = []
    
    for original_col, mapping in mappings.items():
        camel_case = mapping['camelCase']
        prisma_type = mapping['prismaType']
        
        if prisma_type == 'Int':
            int_columns.append(camel_case)
        elif prisma_type == 'Float':
            float_columns.append(camel_case)
        elif prisma_type == 'Boolean':
            boolean_columns.append(camel_case)
        elif prisma_type == 'DateTime':
            datetime_columns.append(camel_case)
        else:  # String and others
            text_columns.append(camel_case)
    
    return {
        'int_columns': int_columns,
        'float_columns': float_columns,
        'boolean_columns': boolean_columns,
        'datetime_columns': datetime_columns,
        'text_columns': text_columns,
        'all_mappings': mappings
    }

# Get the column mappings once at module level
COLUMN_TYPE_MAPPINGS = get_column_type_mappings()

# Direct mapping from CSV columns to our Play schema
COLUMN_MAPPING = {
    'game_id': 'gameId',
    'play_id': 'playId', 
    'home_team': 'homeTeam',
    'away_team': 'awayTeam',
    'season_type': 'seasonType',
    'week': 'week',
    'posteam': 'posteam',
    'posteam_type': 'posteamType',
    'defteam': 'defteam',
    'side_of_field': 'sideOfField',
    'yardline_100': 'yardline100',
    'game_date': 'gameDate',
    'quarter_seconds_remaining': 'quarterSecondsRemaining',
    'half_seconds_remaining': 'halfSecondsRemaining',
    'game_seconds_remaining': 'gameSecondsRemaining',
    'game_half': 'gameHalf',
    'quarter_end': 'quarterEnd',
    'drive': 'drive',
    'sp': 'sp',
    'qtr': 'qtr',
    'down': 'down',
    'goal_to_go': 'goalToGo',
    'time': 'time',
    'yrdln': 'yrdln',
    'ydstogo': 'ydstogo',
    'ydsnet': 'ydsnet',
    'desc': 'desc',
    'play_type': 'playType',
    'yards_gained': 'yardsGained',
    'shotgun': 'shotgun',
    'no_huddle': 'noHuddle',
    'qb_dropback': 'qbDropback',
    'qb_kneel': 'qbKneel',
    'qb_spike': 'qbSpike',
    'qb_scramble': 'qbScramble',
    'pass_length': 'passLength',
    'pass_location': 'passLocation',
    'air_yards': 'airYards',
    'yards_after_catch': 'yardsAfterCatch',
    'run_location': 'runLocation',
    'run_gap': 'runGap',
    'field_goal_result': 'fieldGoalResult',
    'kick_distance': 'kickDistance',
    'extra_point_result': 'extraPointResult',
    'two_point_conv_result': 'twoPointConvResult',
    'home_timeouts_remaining': 'homeTimeoutsRemaining',
    'away_timeouts_remaining': 'awayTimeoutsRemaining',
    'timeout': 'timeout',
    'timeout_team': 'timeoutTeam',
    'td_team': 'tdTeam',
    'td_player_name': 'tdPlayerName',
    'td_player_id': 'tdPlayerId',
    'posteam_timeouts_remaining': 'posteamTimeoutsRemaining',
    'defteam_timeouts_remaining': 'defteamTimeoutsRemaining',
    'total_home_score': 'totalHomeScore',
    'total_away_score': 'totalAwayScore',
    'posteam_score': 'posteamScore',
    'defteam_score': 'defteamScore',
    'score_differential': 'scoreDifferential',
    'posteam_score_post': 'posteamScorePost',
    'defteam_score_post': 'defteamScorePost',
    'score_differential_post': 'scoreDifferentialPost',
    'no_score_prob': 'noScoreProb',
    'opp_fg_prob': 'oppFgProb',
    'opp_safety_prob': 'oppSafetyProb',
    'opp_td_prob': 'oppTdProb',
    'fg_prob': 'fgProb',
    'safety_prob': 'safetyProb',
    'td_prob': 'tdProb',
    'extra_point_prob': 'extraPointProb',
    'two_point_conversion_prob': 'twoPointConversionProb',
    'ep': 'ep',
    'epa': 'epa',
    'total_home_epa': 'totalHomeEpa',
    'total_away_epa': 'totalAwayEpa',
    'total_home_rush_epa': 'totalHomeRushEpa',
    'total_away_rush_epa': 'totalAwayRushEpa',
    'total_home_pass_epa': 'totalHomePassEpa',
    'total_away_pass_epa': 'totalAwayPassEpa',
    'air_epa': 'airEpa',
    'yac_epa': 'yacEpa',
    'comp_air_epa': 'compAirEpa',
    'comp_yac_epa': 'compYacEpa',
    'total_home_comp_air_epa': 'totalHomeCompAirEpa',
    'total_away_comp_air_epa': 'totalAwayCompAirEpa',
    'total_home_comp_yac_epa': 'totalHomeCompYacEpa',
    'total_away_comp_yac_epa': 'totalAwayCompYacEpa',
    'total_home_raw_air_epa': 'totalHomeRawAirEpa',
    'total_away_raw_air_epa': 'totalAwayRawAirEpa',
    'total_home_raw_yac_epa': 'totalHomeRawYacEpa',
    'total_away_raw_yac_epa': 'totalAwayRawYacEpa',
    'wp': 'wp',
    'def_wp': 'defWp',
    'home_wp': 'homeWp',
    'away_wp': 'awayWp',
    'wpa': 'wpa',
    'vegas_wpa': 'vegasWpa',
    'vegas_home_wpa': 'vegasHomeWpa',
    'home_wp_post': 'homeWpPost',
    'away_wp_post': 'awayWpPost',
    'vegas_wp': 'vegasWp',
    'vegas_home_wp': 'vegasHomeWp',
    'total_home_rush_wpa': 'totalHomeRushWpa',
    'total_away_rush_wpa': 'totalAwayRushWpa',
    'total_home_pass_wpa': 'totalHomePassWpa',
    'total_away_pass_wpa': 'totalAwayPassWpa',
    'air_wpa': 'airWpa',
    'yac_wpa': 'yacWpa',
    'comp_air_wpa': 'compAirWpa',
    'comp_yac_wpa': 'compYacWpa',
    'total_home_comp_air_wpa': 'totalHomeCompAirWpa',
    'total_away_comp_air_wpa': 'totalAwayCompAirWpa',
    'total_home_comp_yac_wpa': 'totalHomeCompYacWpa',
    'total_away_comp_yac_wpa': 'totalAwayCompYacWpa',
    'total_home_raw_air_wpa': 'totalHomeRawAirWpa',
    'total_away_raw_air_wpa': 'totalAwayRawAirWpa',
    'total_home_raw_yac_wpa': 'totalHomeRawYacWpa',
    'total_away_raw_yac_wpa': 'totalAwayRawYacWpa',
    'punt_blocked': 'puntBlocked',
    'first_down_rush': 'firstDownRush',
    'first_down_pass': 'firstDownPass',
    'first_down_penalty': 'firstDownPenalty',
    'third_down_converted': 'thirdDownConverted',
    'third_down_failed': 'thirdDownFailed',
    'fourth_down_converted': 'fourthDownConverted',
    'fourth_down_failed': 'fourthDownFailed',
    'incomplete_pass': 'incompletePass',
    'touchback': 'touchback',
    'interception': 'interception',
    'punt_inside_twenty': 'puntInsideTwenty',
    'punt_in_endzone': 'puntInEndzone',
    'punt_out_of_bounds': 'puntOutOfBounds',
    'punt_downed': 'puntDowned',
    'punt_fair_catch': 'puntFairCatch',
    'kickoff_inside_twenty': 'kickoffInsideTwenty',
    'kickoff_in_endzone': 'kickoffInEndzone',
    'kickoff_out_of_bounds': 'kickoffOutOfBounds',
    'kickoff_downed': 'kickoffDowned',
    'kickoff_fair_catch': 'kickoffFairCatch',
    'fumble_forced': 'fumbleForced',
    'fumble_not_forced': 'fumbleNotForced',
    'fumble_out_of_bounds': 'fumbleOutOfBounds',
    'solo_tackle': 'soloTackle',
    'safety': 'safety',
    'penalty': 'penalty',
    'tackled_for_loss': 'tackledForLoss',
    'fumble_lost': 'fumbleLost',
    'own_kickoff_recovery': 'ownKickoffRecovery',
    'own_kickoff_recovery_td': 'ownKickoffRecoveryTd',
    'qb_hit': 'qbHit',
    'rush_attempt': 'rushAttempt',
    'pass_attempt': 'passAttempt',
    'sack': 'sack',
    'touchdown': 'touchdown',
    'pass_touchdown': 'passTouchdown',
    'rush_touchdown': 'rushTouchdown',
    'return_touchdown': 'returnTouchdown',
    'extra_point_attempt': 'extraPointAttempt',
    'two_point_attempt': 'twoPointAttempt',
    'field_goal_attempt': 'fieldGoalAttempt',
    'kickoff_attempt': 'kickoffAttempt',
    'punt_attempt': 'puntAttempt',
    'fumble': 'fumble',
    'complete_pass': 'completePass',
    'assist_tackle': 'assistTackle',
    'lateral_reception': 'lateralReception',
    'lateral_rush': 'lateralRush',
    'lateral_return': 'lateralReturn',
    'lateral_recovery': 'lateralRecovery',
    'passer_player_id': 'passerPlayerId',
    'passer_player_name': 'passerPlayerName',
    'passing_yards': 'passingYards',
    'receiver_player_id': 'receiverPlayerId',
    'receiver_player_name': 'receiverPlayerName',
    'receiving_yards': 'receivingYards',
    'rusher_player_id': 'rusherPlayerId',
    'rusher_player_name': 'rusherPlayerName',
    'rushing_yards': 'rushingYards',
    'lateral_receiver_player_id': 'lateralReceiverPlayerId',
    'lateral_receiver_player_name': 'lateralReceiverPlayerName',
    'lateral_receiving_yards': 'lateralReceivingYards',
    'lateral_rusher_player_id': 'lateralRusherPlayerId',
    'lateral_rusher_player_name': 'lateralRusherPlayerName',
    'lateral_rushing_yards': 'lateralRushingYards',
    'lateral_sack_player_id': 'lateralSackPlayerId',
    'lateral_sack_player_name': 'lateralSackPlayerName',
    'interception_player_id': 'interceptionPlayerId',
    'interception_player_name': 'interceptionPlayerName',
    'lateral_interception_player_id': 'lateralInterceptionPlayerId',
    'lateral_interception_player_name': 'lateralInterceptionPlayerName',
    'punt_returner_player_id': 'puntReturnerPlayerId',
    'punt_returner_player_name': 'puntReturnerPlayerName',
    'lateral_punt_returner_player_id': 'lateralPuntReturnerPlayerId',
    'lateral_punt_returner_player_name': 'lateralPuntReturnerPlayerName',
    'kickoff_returner_player_name': 'kickoffReturnerPlayerName',
    'kickoff_returner_player_id': 'kickoffReturnerPlayerId',
    'lateral_kickoff_returner_player_id': 'lateralKickoffReturnerPlayerId',
    'lateral_kickoff_returner_player_name': 'lateralKickoffReturnerPlayerName',
    'punter_player_id': 'punterPlayerId',
    'punter_player_name': 'punterPlayerName',
    'kicker_player_name': 'kickerPlayerName',
    'kicker_player_id': 'kickerPlayerId',
    'own_kickoff_recovery_player_id': 'ownKickoffRecoveryPlayerId',
    'own_kickoff_recovery_player_name': 'ownKickoffRecoveryPlayerName',
    'blocked_player_id': 'blockedPlayerId',
    'blocked_player_name': 'blockedPlayerName',
    'tackle_for_loss_1_player_id': 'tackleForLoss1PlayerId',
    'tackle_for_loss_1_player_name': 'tackleForLoss1PlayerName',
    'tackle_for_loss_2_player_id': 'tackleForLoss2PlayerId',
    'tackle_for_loss_2_player_name': 'tackleForLoss2PlayerName',
    'qb_hit_1_player_id': 'qbHit1PlayerId',
    'qb_hit_1_player_name': 'qbHit1PlayerName',
    'qb_hit_2_player_id': 'qbHit2PlayerId',
    'qb_hit_2_player_name': 'qbHit2PlayerName',
    'forced_fumble_player_1_team': 'forcedFumblePlayer1Team',
    'forced_fumble_player_1_player_id': 'forcedFumblePlayer1PlayerId',
    'forced_fumble_player_1_player_name': 'forcedFumblePlayer1PlayerName',
    'forced_fumble_player_2_team': 'forcedFumblePlayer2Team',
    'forced_fumble_player_2_player_id': 'forcedFumblePlayer2PlayerId',
    'forced_fumble_player_2_player_name': 'forcedFumblePlayer2PlayerName',
    'solo_tackle_1_team': 'soloTackle1Team',
    'solo_tackle_2_team': 'soloTackle2Team',
    'solo_tackle_1_player_id': 'soloTackle1PlayerId',
    'solo_tackle_2_player_id': 'soloTackle2PlayerId',
    'solo_tackle_1_player_name': 'soloTackle1PlayerName',
    'solo_tackle_2_player_name': 'soloTackle2PlayerName',
    'assist_tackle_1_player_id': 'assistTackle1PlayerId',
    'assist_tackle_1_player_name': 'assistTackle1PlayerName',
    'assist_tackle_1_team': 'assistTackle1Team',
    'assist_tackle_2_player_id': 'assistTackle2PlayerId',
    'assist_tackle_2_player_name': 'assistTackle2PlayerName',
    'assist_tackle_2_team': 'assistTackle2Team',
    'assist_tackle_3_player_id': 'assistTackle3PlayerId',
    'assist_tackle_3_player_name': 'assistTackle3PlayerName',
    'assist_tackle_3_team': 'assistTackle3Team',
    'assist_tackle_4_player_id': 'assistTackle4PlayerId',
    'assist_tackle_4_player_name': 'assistTackle4PlayerName',
    'assist_tackle_4_team': 'assistTackle4Team',
    'tackle_with_assist': 'tackleWithAssist',
    'tackle_with_assist_1_player_id': 'tackleWithAssist1PlayerId',
    'tackle_with_assist_1_player_name': 'tackleWithAssist1PlayerName',
    'tackle_with_assist_1_team': 'tackleWithAssist1Team',
    'tackle_with_assist_2_player_id': 'tackleWithAssist2PlayerId',
    'tackle_with_assist_2_player_name': 'tackleWithAssist2PlayerName',
    'tackle_with_assist_2_team': 'tackleWithAssist2Team',
    'pass_defense_1_player_id': 'passDefense1PlayerId',
    'pass_defense_1_player_name': 'passDefense1PlayerName',
    'pass_defense_2_player_id': 'passDefense2PlayerId',
    'pass_defense_2_player_name': 'passDefense2PlayerName',
    'fumbled_1_team': 'fumbled1Team',
    'fumbled_1_player_id': 'fumbled1PlayerId',
    'fumbled_1_player_name': 'fumbled1PlayerName',
    'fumbled_2_player_id': 'fumbled2PlayerId',
    'fumbled_2_player_name': 'fumbled2PlayerName',
    'fumbled_2_team': 'fumbled2Team',
    'fumble_recovery_1_team': 'fumbleRecovery1Team',
    'fumble_recovery_1_yards': 'fumbleRecovery1Yards',
    'fumble_recovery_1_player_id': 'fumbleRecovery1PlayerId',
    'fumble_recovery_1_player_name': 'fumbleRecovery1PlayerName',
    'fumble_recovery_2_team': 'fumbleRecovery2Team',
    'fumble_recovery_2_yards': 'fumbleRecovery2Yards',
    'fumble_recovery_2_player_id': 'fumbleRecovery2PlayerId',
    'fumble_recovery_2_player_name': 'fumbleRecovery2PlayerName',
    'sack_player_id': 'sackPlayerId',
    'sack_player_name': 'sackPlayerName',
    'half_sack_1_player_id': 'halfSack1PlayerId',
    'half_sack_1_player_name': 'halfSack1PlayerName',
    'half_sack_2_player_id': 'halfSack2PlayerId',
    'half_sack_2_player_name': 'halfSack2PlayerName',
    'return_team': 'returnTeam',
    'return_yards': 'returnYards',
    'penalty_team': 'penaltyTeam',
    'penalty_player_id': 'penaltyPlayerId',
    'penalty_player_name': 'penaltyPlayerName',
    'penalty_yards': 'penaltyYards',
    'replay_or_challenge': 'replayOrChallenge',
    'replay_or_challenge_result': 'replayOrChallengeResult',
    'penalty_type': 'penaltyType',
    'defensive_two_point_attempt': 'defensiveTwoPointAttempt',
    'defensive_two_point_conv': 'defensiveTwoPointConv',
    'defensive_extra_point_attempt': 'defensiveExtraPointAttempt',
    'defensive_extra_point_conv': 'defensiveExtraPointConv',
    'safety_player_name': 'safetyPlayerName',
    'safety_player_id': 'safetyPlayerId',
    'season': 'season',
    'cp': 'cp',
    'cpoe': 'cpoe',
    'series': 'series',
    'series_success': 'seriesSuccess',
    'series_result': 'seriesResult',
    'order_sequence': 'orderSequence',
    'start_time': 'startTime',
    'time_of_day': 'timeOfDay',
    'stadium': 'stadium',
    'weather': 'weather',
    'nfl_api_id': 'nflApiId',
    'play_clock': 'playClock',
    'play_deleted': 'playDeleted',
    'play_type_nfl': 'playTypeNfl',
    'special_teams_play': 'specialTeamsPlay',
    'st_play_type': 'stPlayType',
    'end_clock_time': 'endClockTime',
    'end_yard_line': 'endYardLine',
    'fixed_drive': 'fixedDrive',
    'fixed_drive_result': 'fixedDriveResult',
    'drive_real_start_time': 'driveRealStartTime',
    'drive_play_count': 'drivePlayCount',
    'drive_time_of_possession': 'driveTimeOfPossession',
    'drive_first_downs': 'driveFirstDowns',
    'drive_inside_20': 'driveInside20',
    'drive_ended_with_score': 'driveEndedWithScore',
    'drive_quarter_start': 'driveQuarterStart',
    'drive_quarter_end': 'driveQuarterEnd',
    'drive_yards_penalized': 'driveYardsPenalized',
    'drive_start_transition': 'driveStartTransition',
    'drive_end_transition': 'driveEndTransition',
    'drive_game_clock_start': 'driveGameClockStart',
    'drive_game_clock_end': 'driveGameClockEnd',
    'drive_start_yard_line': 'driveStartYardLine',
    'drive_end_yard_line': 'driveEndYardLine',
    'drive_play_id_started': 'drivePlayIdStarted',
    'drive_play_id_ended': 'drivePlayIdEnded',
    'away_score': 'awayScore',
    'home_score': 'homeScore',
    'location': 'location',
    'result': 'result',
    'total': 'total',
    'spread_line': 'spreadLine',
    'total_line': 'totalLine',
    'div_game': 'divGame',
    'roof': 'roof',
    'surface': 'surface',
    'temp': 'temp',
    'wind': 'wind',
    'home_coach': 'homeCoach',
    'away_coach': 'awayCoach',
    'stadium_id': 'stadiumId',
    'game_stadium': 'gameStadium',
    'aborted_play': 'abortedPlay',
    'success': 'success',
    'passer': 'passer',
    'passer_jersey_number': 'passerJerseyNumber',
    'rusher': 'rusher',
    'rusher_jersey_number': 'rusherJerseyNumber',
    'receiver': 'receiver',
    'receiver_jersey_number': 'receiverJerseyNumber',
    'pass': 'pass',
    'rush': 'rush',
    'first_down': 'firstDown',
    'special': 'special',
    'play': 'play',
    'passer_id': 'passerId',
    'rusher_id': 'rusherId',
    'receiver_id': 'receiverId',
    'name': 'name',
    'jersey_number': 'jerseyNumber',
    'id': 'id',
    'fantasy_player_name': 'fantasyPlayerName',
    'fantasy_player_id': 'fantasyPlayerId',
    'fantasy': 'fantasy',
    'fantasy_id': 'fantasyId',
    'out_of_bounds': 'outOfBounds',
    'home_opening_kickoff': 'homeOpeningKickoff',
    'qb_epa': 'qbEpa',
    'xyac_epa': 'xyacEpa',
    'xyac_mean_yardage': 'xyacMeanYardage',
    'xyac_median_yardage': 'xyacMedianYardage',
    'xyac_success': 'xyacSuccess',
    'xyac_fd': 'xyacFd',
    'xpass': 'xpass',
    'pass_oe': 'passOe'
}

def normalize_df(df):
    """Normalize DataFrame to match our Play schema."""
    # Add missing columns
    for col in COLUMN_MAPPING.keys():
        if col not in df.columns:
            df[col] = None
    # Only keep columns in COLUMN_MAPPING, in order
    df = df[list(COLUMN_MAPPING.keys())].copy()  # Use .copy() to avoid SettingWithCopyWarning
    # Rename to camelCase
    df.columns = [COLUMN_MAPPING[c] for c in COLUMN_MAPPING.keys()]
    # Create unique id for each play (string)
    df['id'] = df['gameId'].astype(str) + '_' + df['playId'].astype(str)
    # Remove playId column if it exists
    if 'playId' in df.columns:
        df = df.drop(columns=['playId'])
    return df

def convert_types(df):
    """Convert DataFrame types to match Prisma schema."""
    # Convert numeric columns (Int in Prisma)
    int_columns = COLUMN_TYPE_MAPPINGS['int_columns']
    
    for col in int_columns:
        if col in df.columns:
            # Handle float values in integer columns by filling NaN and converting safely
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
    
    # Convert float columns
    float_columns = COLUMN_TYPE_MAPPINGS['float_columns']
    
    for col in float_columns:
        if col in df.columns:
            # Handle text values that should be floats
            df[col] = df[col].replace(['', 'nan', 'None', 'NULL'], None)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Convert boolean columns (Boolean in Prisma)
    boolean_columns = COLUMN_TYPE_MAPPINGS['boolean_columns']
    
    for col in boolean_columns:
        if col in df.columns:
            # Handle float values (1.0, 0.0) and integer values (1, 0) and convert to boolean
            df[col] = df[col].apply(lambda x: 
                True if pd.notnull(x) and (float(x) == 1.0 or int(x) == 1) 
                else False if pd.notnull(x) and (float(x) == 0.0 or int(x) == 0) 
                else None
            )
    
    # Convert datetime columns (DateTime in Prisma)
    datetime_columns = COLUMN_TYPE_MAPPINGS['datetime_columns']
    
    for col in datetime_columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    
    return df

def bulk_insert(conn, df, table):
    """Bulk insert DataFrame into database table."""
    # Use COPY for speed
    cols = list(df.columns)
    with conn.cursor() as cur:
        # Create temp table with proper types
        temp_table = f"temp_{table}"
        
        # Define column types based on DataFrame dtypes
        col_defs = []
        for col in cols:
            if col in COLUMN_TYPE_MAPPINGS['int_columns']:
                col_defs.append(f'"{col}" integer')
            elif col in COLUMN_TYPE_MAPPINGS['float_columns']:
                col_defs.append(f'"{col}" double precision')
            elif col in COLUMN_TYPE_MAPPINGS['boolean_columns']:
                col_defs.append(f'"{col}" boolean')
            elif col in COLUMN_TYPE_MAPPINGS['datetime_columns']:
                col_defs.append(f'"{col}" timestamp')
            else:
                col_defs.append(f'"{col}" text')
        
        col_defs_str = ', '.join(col_defs)
        cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
        cur.execute(f"CREATE TEMP TABLE {temp_table} ({col_defs_str})")
        
        # Write to temp table with proper COPY syntax
        col_names = ', '.join([f'"{c}"' for c in cols])
        try:
            with cur.copy(f"COPY {temp_table} ({col_names}) FROM STDIN") as copy:
                for _, row in df.iterrows():
                    # Convert row to list in the correct order
                    row_data = []
                    for col in cols:
                        value = row[col]
                        # Handle special cases
                        if pd.isna(value):
                            row_data.append(None)
                        elif isinstance(value, list):  # For array types
                            row_data.append(value)
                        else:
                            row_data.append(value)
                    copy.write_row(row_data)
        except Exception as e:
            logger.error(f"Error during COPY operation: {e}")
            # Log sample data that might be causing issues
            logger.error(f"Sample data types: {df.dtypes.to_dict()}")
            logger.error(f"Sample data for first few rows:")
            for i in range(min(3, len(df))):
                logger.error(f"Row {i}: {df.iloc[i].to_dict()}")
            raise
        
        # Upsert into real table
        col_list = ', '.join([f'"{c}"' for c in cols])
        update_list = ', '.join([f'"{c}" = EXCLUDED."{c}"' for c in cols if c != 'id'])
        cur.execute(f'''
            INSERT INTO "{table}" ({col_list})
            SELECT * FROM {temp_table}
            ON CONFLICT (id) DO UPDATE SET {update_list}
        ''')
        cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
    conn.commit()

def import_all_years(start=1999, end=2024):
    """Import all years of play-by-play data."""
    conn = psycopg.connect(DATABASE_URL)
    for year in range(start, end+1):
        logger.info(f"Processing {year}...")
        url = f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{year}.csv"
        try:
            df = pd.read_csv(url, low_memory=False)
            logger.info(f"Downloaded {len(df)} rows for {year}")
        except Exception as e:
            logger.error(f"Failed to download {year}: {e}")
            continue
        
        df = normalize_df(df)
        df = convert_types(df)
        
        # Set id as first column
        cols = list(df.columns)
        cols.remove('id')
        df = df[['id'] + cols]
        
        # Remove duplicates based on id, keeping the first occurrence
        initial_count = len(df)
        df = df.drop_duplicates(subset=['id'], keep='first')
        final_count = len(df)
        if initial_count != final_count:
            logger.info(f"Removed {initial_count - final_count} duplicate rows for {year}")
        
        logger.info(f"Bulk inserting {len(df)} plays for {year}...")
        bulk_insert(conn, df, 'Play')
        logger.info(f"Done with {year}")
    conn.close()

if __name__ == "__main__":
    import_all_years() 