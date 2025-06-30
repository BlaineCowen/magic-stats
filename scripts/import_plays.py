import os
import logging
import pandas as pd
import requests
import psycopg
from psycopg.rows import dict_row
from psycopg.copy import Copy
import sys
from concurrent.futures import ThreadPoolExecutor
from io import StringIO
from datetime import datetime
from typing import List, Dict, Any
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

def download_play_by_play_data(year: int) -> pd.DataFrame:
    """Download play-by-play data for a specific year."""
    logger.info(f"Downloading play-by-play data for {year}...")
    url = f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{year}.csv"
    
    try:
        df = pd.read_csv(url, low_memory=False)
        logger.info(f"Downloaded {len(df)} plays for {year}")
        
        # Check data types
        logger.info("Data types of key columns:")
        key_columns = ['game_id', 'season', 'week', 'season_type', 'home_team', 'away_team', 'total_home_score', 'total_away_score']
        for col in key_columns:
            if col in df.columns:
                logger.info(f"{col}: {df[col].dtype}, null count: {df[col].isnull().sum()}")
                if df[col].dtype == 'object':
                    logger.info(f"Sample values: {df[col].dropna().head().tolist()}")
        
        return df
    except Exception as e:
        logger.error(f"Failed to download play-by-play data for {year}: {str(e)}")
        raise

def process_games(df: pd.DataFrame) -> pd.DataFrame:
    """Process games data for bulk insert."""
    logger.info("Processing games data...")
    logger.info(f"Initial columns: {df.columns.tolist()}")
    
    # Select and rename columns for Game table
    games_df = df[[
        'game_id', 'season', 'week', 'season_type',
        'home_team', 'away_team', 'total_home_score', 'total_away_score'
    ]].copy()
    
    logger.info(f"Selected columns: {games_df.columns.tolist()}")
    logger.info(f"Sample data:\n{games_df.head()}")
    
    # Drop duplicates
    games_df = games_df.drop_duplicates(subset=['game_id'])
    
    games_df = games_df.rename(columns={
        'game_id': 'id',
        'season_type': 'gameType',
        'home_team': 'homeTeam',
        'away_team': 'awayTeam',
        'total_home_score': 'homeScore',
        'total_away_score': 'awayScore'
    })
    
    logger.info(f"Renamed columns: {games_df.columns.tolist()}")
    
    # Convert data types
    games_df['season'] = pd.to_numeric(games_df['season'], errors='coerce').fillna(0).astype(int)
    games_df['week'] = pd.to_numeric(games_df['week'], errors='coerce').fillna(0).astype(int)
    games_df['homeScore'] = pd.to_numeric(games_df['homeScore'], errors='coerce').fillna(0).astype(int)
    games_df['awayScore'] = pd.to_numeric(games_df['awayScore'], errors='coerce').fillna(0).astype(int)
    games_df['gameType'] = games_df['gameType'].fillna('REG')
    games_df['homeTeam'] = games_df['homeTeam'].fillna('UNK')
    games_df['awayTeam'] = games_df['awayTeam'].fillna('UNK')
    
    # Add timestamp fields
    current_time = datetime.now()
    games_df['createdAt'] = current_time.strftime('%Y-%m-%d %H:%M:%S')
    games_df['updatedAt'] = current_time.strftime('%Y-%m-%d %H:%M:%S')
    
    logger.info(f"Final data types:\n{games_df.dtypes}")
    logger.info(f"Final sample data:\n{games_df.head()}")
    
    return games_df

def process_plays(df: pd.DataFrame) -> pd.DataFrame:
    """Process plays data for bulk insert."""
    # Create unique play IDs by combining game_id and play_id
    df['id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str)
    
    # Select and rename columns for Play table
    plays_df = df[[
        'id', 'game_id', 'qtr', 'down', 'ydstogo', 'yards_gained',
        'play_type', 'posteam', 'defteam', 'desc', 'epa', 'cpoe', 'success'
    ]].copy()
    
    plays_df = plays_df.rename(columns={
        'game_id': 'gameId',
        'qtr': 'quarter',
        'ydstogo': 'yardsToGo',
        'yards_gained': 'yardsGained',
        'play_type': 'playType',
        'posteam': 'possessionTeam',
        'defteam': 'defensiveTeam',
        'desc': 'playDescription'
    })
    
    # Convert data types
    plays_df['quarter'] = pd.to_numeric(plays_df['quarter'], errors='coerce').fillna(1).astype(int)
    plays_df['down'] = pd.to_numeric(plays_df['down'], errors='coerce').fillna(0).astype(int)
    plays_df['yardsToGo'] = pd.to_numeric(plays_df['yardsToGo'], errors='coerce').fillna(0).astype(int)
    plays_df['yardsGained'] = pd.to_numeric(plays_df['yardsGained'], errors='coerce')
    plays_df['epa'] = pd.to_numeric(plays_df['epa'], errors='coerce')
    plays_df['cpoe'] = pd.to_numeric(plays_df['cpoe'], errors='coerce')
    plays_df['success'] = plays_df['success'].fillna('0').astype(str) == '1'
    
    # Handle required fields
    plays_df['playType'] = plays_df['playType'].fillna('no_play')
    plays_df['possessionTeam'] = plays_df['possessionTeam'].fillna('UNK')
    plays_df['defensiveTeam'] = plays_df['defensiveTeam'].fillna('UNK')
    plays_df['playDescription'] = plays_df['playDescription'].fillna('')
    
    # Remove duplicates based on play ID, keeping the first occurrence
    plays_df = plays_df.drop_duplicates(subset=['id'], keep='first')
    
    logger.info(f"Processed {len(plays_df)} unique plays after deduplication")
    
    return plays_df

def bulk_insert_dataframe(conn: psycopg.Connection, df: pd.DataFrame, table: str, conflict_fields: list):
    """Bulk insert a dataframe using COPY command."""
    try:
        logger.info(f"Creating temp table for {table}...")
        # Robust column_types selection
        column_types_map = {
            'Play': {
                'id': 'text',
                'gameId': 'text',
                'quarter': 'integer',
                'down': 'integer',
                'yardsToGo': 'integer',
                'yardsGained': 'double precision',
                'playType': 'text',
                'possessionTeam': 'text',
                'defensiveTeam': 'text',
                'playDescription': 'text',
                'epa': 'double precision',
                'cpoe': 'double precision',
                'success': 'boolean'
            },
            'Game': {
                'id': 'text',
                'season': 'integer',
                'week': 'integer',
                'gameType': 'text',
                'homeTeam': 'text',
                'awayTeam': 'text',
                'homeScore': 'integer',
                'awayScore': 'integer',
                'createdAt': 'timestamp',
                'updatedAt': 'timestamp'
            },
            'PlayParticipants': {
                'id': 'text',
                'playId': 'text',
                'passerId': 'text',
                'passerName': 'text',
                'receiverId': 'text',
                'receiverName': 'text',
                'rusherId': 'text',
                'rusherName': 'text',
                'tacklers': 'text[]',
                'assistTacklers': 'text[]',
                'blockingPlayers': 'text[]',
                'passingYards': 'integer',
                'receivingYards': 'integer',
                'rushingYards': 'integer'
            },
            'PlayAdvancedStats': {
                'id': 'text',
                'playId': 'text',
                'airYards': 'integer',
                'yardsAfterCatch': 'integer',
                'expectedPoints': 'double precision',
                'winProbability': 'double precision',
                'expectedYards': 'double precision',
                'success': 'boolean',
                'successProbability': 'double precision',
                'totalHomeEpa': 'double precision',
                'totalAwayEpa': 'double precision',
                'totalHomeRushEpa': 'double precision',
                'totalAwayRushEpa': 'double precision',
                'totalHomePassEpa': 'double precision',
                'totalAwayPassEpa': 'double precision',
                'airEpa': 'double precision',
                'yacEpa': 'double precision',
                'xyacEpa': 'double precision',
                'xyacMeanYardage': 'double precision',
                'xyacMedianYardage': 'double precision',
                'xyacSuccess': 'double precision',
                'xyacFd': 'double precision',
                'xpass': 'double precision',
                'passOe': 'double precision'
            },
            'PlaySpecialTeams': {
                'id': 'text',
                'playId': 'text',
                'puntBlocked': 'boolean',
                'puntInsideTwenty': 'boolean',
                'puntInEndzone': 'boolean',
                'puntOutOfBounds': 'boolean',
                'puntDowned': 'boolean',
                'puntFairCatch': 'boolean',
                'kickoffInsideTwenty': 'boolean',
                'kickoffInEndzone': 'boolean',
                'kickoffOutOfBounds': 'boolean',
                'kickoffDowned': 'boolean',
                'kickoffFairCatch': 'boolean',
                'returnTeam': 'text',
                'returnYards': 'integer',
                'punterPlayerId': 'text',
                'punterPlayerName': 'text',
                'kickerPlayerId': 'text',
                'kickerPlayerName': 'text',
                'returnerPlayerId': 'text',
                'returnerPlayerName': 'text'
            },
            'PlayDetails': {
                'id': 'text',
                'playId': 'text',
                'yardline100': 'integer',
                'quarterSecsRemaining': 'integer',
                'halfSecsRemaining': 'integer',
                'gameSecsRemaining': 'integer',
                'goalToGo': 'boolean',
                'shotgun': 'boolean',
                'noHuddle': 'boolean',
                'qbDropback': 'boolean',
                'qbKneel': 'boolean',
                'qbSpike': 'boolean',
                'qbScramble': 'boolean',
                'passLength': 'text',
                'passLocation': 'text',
                'runLocation': 'text',
                'runGap': 'text',
                'fieldGoalResult': 'text',
                'kickDistance': 'integer'
            },
            'PlayGameInfo': {
                'id': 'text',
                'playId': 'text',
                'homeScore': 'integer',
                'awayScore': 'integer',
                'location': 'text',
                'stadium': 'text',
                'weather': 'text',
                'surface': 'text',
                'roof': 'text',
                'temperature': 'integer',
                'windSpeed': 'integer',
                'homeCoach': 'text',
                'awayCoach': 'text'
            },
            'DriveInfo': {
                'id': 'text',
                'playDetailsId': 'text',
                'drivePlayCount': 'integer',
                'driveTimeOfPossession': 'text',
                'driveFirstDowns': 'integer',
                'driveInside20': 'boolean',
                'driveEndedWithScore': 'boolean',
                'driveQuarterStart': 'integer',
                'driveQuarterEnd': 'integer',
                'driveYardsPenalized': 'integer',
                'driveStartTransition': 'text',
                'driveEndTransition': 'text',
                'driveStartYardLine': 'text',
                'driveEndYardLine': 'text'
            },
            'PlayTimeouts': {
                'id': 'text',
                'playDetailsId': 'text',
                'homeRemaining': 'integer',
                'awayRemaining': 'integer',
                'timeoutTeam': 'text'
            },
            'FumbleInfo': {
                'id': 'text',
                'playParticipantsId': 'text',
                'fumbledTeam': 'text',
                'fumbledPlayerId': 'text',
                'fumbledPlayerName': 'text',
                'recoveryTeam': 'text',
                'recoveryYards': 'integer',
                'recoveryPlayerId': 'text',
                'recoveryPlayerName': 'text',
                'forced': 'boolean',
                'lost': 'boolean',
                'outOfBounds': 'boolean'
            },
            'InterceptionInfo': {
                'id': 'text',
                'playParticipantsId': 'text',
                'interceptionPlayerId': 'text',
                'interceptionPlayerName': 'text'
            },
            'SackPlayers': {
                'id': 'text',
                'playParticipantsId': 'text',
                'sackPlayerId': 'text',
                'sackPlayerName': 'text',
                'halfSack1PlayerId': 'text',
                'halfSack1PlayerName': 'text',
                'halfSack2PlayerId': 'text',
                'halfSack2PlayerName': 'text'
            }
        }
        column_types = column_types_map.get(table, {})
        
        # Create temporary table
        temp_table = f"temp_{table}"
        columns_sql = ", ".join([f'"{col}" {type}' for col, type in column_types.items()])
        create_temp_table_sql = f"CREATE TEMP TABLE {temp_table} ({columns_sql})"
        with conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
            cur.execute(create_temp_table_sql)

        # Ensure DataFrame columns are in the same order as the temp table
        df = df[[*column_types.keys()]]
        logger.info(f"Copying {len(df)} rows to temp table for {table}...")
        
        # Use psycopg3's Copy API
        with conn.cursor() as cur:
            if not column_types:
                raise ValueError(f"No column_types found for table: {table}")
            with cur.copy(f"COPY {temp_table} FROM STDIN") as copy:
                for _, row in df.iterrows():
                    # Convert row to list in the correct order
                    row_data = []
                    for col in column_types.keys():
                        value = row[col]
                        # Handle special cases
                        if pd.isna(value):
                            row_data.append(None)
                        elif isinstance(value, list):  # For array types
                            row_data.append(value)
                        else:
                            row_data.append(value)
                    copy.write_row(row_data)

            # Check temp table count
            cur.execute(f"SELECT COUNT(*) FROM {temp_table}")
            temp_count = cur.fetchone()[0]
            logger.info(f"Copied {temp_count} rows to temp table for {table}")

            # Upsert data from temp table
            columns_str = ", ".join([f'\"{col}\"' for col in column_types.keys()])
            conflict_cols = ", ".join([f'\"{col}\"' for col in conflict_fields])
            update_cols = ", ".join([f'\"{col}\" = EXCLUDED.\"{col}\"' for col in column_types.keys() if col not in conflict_fields])
            update_cols = update_cols.replace('\"updatedAt\" = EXCLUDED.\"updatedAt\"', '\"updatedAt\" = NOW()')
            upsert_sql = f"""
                INSERT INTO \"{table}\" ({columns_str})
                SELECT * FROM {temp_table}
                ON CONFLICT ({conflict_cols})
                DO UPDATE SET {update_cols}
            """
            logger.info(f"Upserting data from temp table to {table}...")
            cur.execute(upsert_sql)

            # Check final count
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            final_count = cur.fetchone()[0]
            logger.info(f"Successfully upserted data. {table} now has {final_count} total rows")

            # Drop temp table
            cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
        # Commit the transaction to persist changes
        conn.commit()
    except Exception as e:
        logger.error(f"Error during bulk insert for {table}: {str(e)}")
        if hasattr(e, 'pgerror') and e.pgerror:
            logger.error(f"PostgreSQL error: {e.pgerror}")
        raise

def process_play_details(df: pd.DataFrame) -> pd.DataFrame:
    """Process play details data for bulk insert."""
    logger.info("Processing play details data...")
    
    # Create unique IDs for play details by combining game_id and play_id
    play_details_df = df[[
        'game_id', 'play_id', 'yardline_100', 'quarter_seconds_remaining', 'half_seconds_remaining',
        'game_seconds_remaining', 'goal_to_go', 'shotgun', 'no_huddle', 'qb_dropback',
        'qb_kneel', 'qb_spike', 'qb_scramble', 'pass_length', 'pass_location',
        'run_location', 'run_gap', 'field_goal_result', 'kick_distance'
    ]].copy()
    play_details_df['id'] = play_details_df['game_id'].astype(str) + '_' + play_details_df['play_id'].astype(str) + '_details'
    play_details_df['playId'] = play_details_df['game_id'].astype(str) + '_' + play_details_df['play_id'].astype(str)  # Use Play.id format
    
    play_details_df = play_details_df.rename(columns={
        'yardline_100': 'yardline100',
        'quarter_seconds_remaining': 'quarterSecsRemaining',
        'half_seconds_remaining': 'halfSecsRemaining',
        'game_seconds_remaining': 'gameSecsRemaining',
        'goal_to_go': 'goalToGo',
        'no_huddle': 'noHuddle',
        'qb_dropback': 'qbDropback',
        'qb_kneel': 'qbKneel',
        'qb_spike': 'qbSpike',
        'qb_scramble': 'qbScramble',
        'pass_length': 'passLength',
        'pass_location': 'passLocation',
        'run_location': 'runLocation',
        'run_gap': 'runGap',
        'field_goal_result': 'fieldGoalResult',
        'kick_distance': 'kickDistance'
    })
    
    # Drop rows with NULL playId
    play_details_df = play_details_df.dropna(subset=['playId'])
    
    # Deduplicate on unique id
    play_details_df = play_details_df.drop_duplicates(subset=['id'], keep='first')
    
    # Convert numeric columns first
    int_columns = ['yardline100', 'quarterSecsRemaining', 'halfSecsRemaining', 'gameSecsRemaining', 'kickDistance']
    for col in int_columns:
        play_details_df[col] = play_details_df[col].replace({'True': 0, 'False': 0, True: 0, False: 0})
        play_details_df[col] = pd.to_numeric(play_details_df[col], errors='coerce').fillna(0).astype(int)
    
    # Convert boolean columns
    bool_columns = ['goalToGo', 'shotgun', 'noHuddle', 'qbDropback', 'qbKneel', 'qbSpike', 'qbScramble']
    for col in bool_columns:
        play_details_df[col] = pd.to_numeric(play_details_df[col], errors='coerce').fillna(0).astype(bool)
    
    # Convert text columns
    text_columns = ['passLength', 'passLocation', 'runLocation', 'runGap', 'fieldGoalResult']
    for col in text_columns:
        play_details_df[col] = play_details_df[col].fillna('')
    
    logger.info(f"Final data types:\n{play_details_df.dtypes}")
    logger.info(f"Final sample data:\n{play_details_df.head()}")
    
    return play_details_df[[
        'id', 'playId', 'yardline100', 'quarterSecsRemaining', 'halfSecsRemaining', 'gameSecsRemaining',
        'goalToGo', 'shotgun', 'noHuddle', 'qbDropback', 'qbKneel', 'qbSpike', 'qbScramble',
        'passLength', 'passLocation', 'runLocation', 'runGap', 'fieldGoalResult', 'kickDistance'
    ]]

def process_participants(df: pd.DataFrame) -> pd.DataFrame:
    """Process play participants data for bulk insert."""
    # Create unique play IDs by combining game_id and play_id
    df['participants_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_participants'
    
    participants_df = df[[
        'participants_id', 'id', 'passer_player_id', 'passer_player_name',
        'receiver_player_id', 'receiver_player_name', 'rusher_player_id',
        'rusher_player_name', 'passing_yards', 'receiving_yards', 'rushing_yards'
    ]].copy()
    
    # Rename columns
    participants_df = participants_df.rename(columns={
        'participants_id': 'id',
        'id': 'playId',  # This references Play.id
        'passer_player_id': 'passerId',
        'passer_player_name': 'passerName',
        'receiver_player_id': 'receiverId',
        'receiver_player_name': 'receiverName',
        'rusher_player_id': 'rusherId',
        'rusher_player_name': 'rusherName',
        'passing_yards': 'passingYards',
        'receiving_yards': 'receivingYards',
        'rushing_yards': 'rushingYards'
    })
    
    # Deduplicate on unique id
    participants_df = participants_df.drop_duplicates(subset=['id'], keep='first')
    
    # Convert numeric fields
    participants_df['passingYards'] = pd.to_numeric(participants_df['passingYards'], errors='coerce').fillna(0).astype(int)
    participants_df['receivingYards'] = pd.to_numeric(participants_df['receivingYards'], errors='coerce').fillna(0).astype(int)
    participants_df['rushingYards'] = pd.to_numeric(participants_df['rushingYards'], errors='coerce').fillna(0).astype(int)
    
    # Handle nullable text fields
    text_fields = ['passerId', 'passerName', 'receiverId', 'receiverName', 'rusherId', 'rusherName']
    for field in text_fields:
        participants_df[field] = participants_df[field].fillna('')
    
    # Add empty arrays for tacklers, assistTacklers, and blockingPlayers
    participants_df['tacklers'] = participants_df.apply(lambda x: [], axis=1)
    participants_df['assistTacklers'] = participants_df.apply(lambda x: [], axis=1)
    participants_df['blockingPlayers'] = participants_df.apply(lambda x: [], axis=1)
    
    return participants_df[[
        'id', 'playId', 'passerId', 'passerName', 'receiverId', 'receiverName', 
        'rusherId', 'rusherName', 'tacklers', 'assistTacklers', 'blockingPlayers',
        'passingYards', 'receivingYards', 'rushingYards'
    ]]

def process_advanced_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Process play advanced stats for bulk insert."""
    # Create unique play IDs by combining game_id and play_id
    df['stats_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_stats'
    
    stats_df = df[[
        'stats_id', 'id', 'air_yards', 'yards_after_catch', 'ep', 'wp',
        'success', 'total_home_epa', 'total_away_epa', 'total_home_rush_epa',
        'total_away_rush_epa', 'total_home_pass_epa', 'total_away_pass_epa',
        'air_epa', 'yac_epa', 'xyac_epa', 'xyac_mean_yardage',
        'xyac_median_yardage', 'xyac_success', 'xyac_fd', 'xpass', 'pass_oe'
    ]].copy()
    
    stats_df = stats_df.rename(columns={
        'stats_id': 'id',
        'id': 'playId',  # This references Play.id
        'air_yards': 'airYards',
        'yards_after_catch': 'yardsAfterCatch',
        'ep': 'expectedPoints',
        'wp': 'winProbability',
        'total_home_epa': 'totalHomeEpa',
        'total_away_epa': 'totalAwayEpa',
        'total_home_rush_epa': 'totalHomeRushEpa',
        'total_away_rush_epa': 'totalAwayRushEpa',
        'total_home_pass_epa': 'totalHomePassEpa',
        'total_away_pass_epa': 'totalAwayPassEpa',
        'air_epa': 'airEpa',
        'yac_epa': 'yacEpa',
        'xyac_epa': 'xyacEpa',
        'xyac_mean_yardage': 'xyacMeanYardage',
        'xyac_median_yardage': 'xyacMedianYardage',
        'xyac_success': 'xyacSuccess',
        'xyac_fd': 'xyacFd',
        'xpass': 'xpass',
        'pass_oe': 'passOe'
    })
    
    # Deduplicate on unique id
    stats_df = stats_df.drop_duplicates(subset=['id'], keep='first')
    
    # Convert integer fields
    stats_df['airYards'] = pd.to_numeric(stats_df['airYards'], errors='coerce').fillna(0).astype(int)
    stats_df['yardsAfterCatch'] = pd.to_numeric(stats_df['yardsAfterCatch'], errors='coerce').fillna(0).astype(int)
    
    # Convert boolean fields
    stats_df['success'] = pd.to_numeric(stats_df['success'], errors='coerce').fillna(0).astype(bool)
    
    # Convert float fields
    float_columns = [
        'expectedPoints', 'winProbability', 'totalHomeEpa', 'totalAwayEpa',
        'totalHomeRushEpa', 'totalAwayRushEpa', 'totalHomePassEpa',
        'totalAwayPassEpa', 'airEpa', 'yacEpa', 'xyacEpa', 'xyacMeanYardage',
        'xyacMedianYardage', 'xyacSuccess', 'xyacFd', 'xpass', 'passOe'
    ]
    for col in float_columns:
        stats_df[col] = pd.to_numeric(stats_df[col], errors='coerce')
    
    # Add missing columns with default values
    stats_df['expectedYards'] = pd.to_numeric(stats_df.get('expectedYards', 0), errors='coerce')
    stats_df['successProbability'] = pd.to_numeric(stats_df.get('successProbability', 0), errors='coerce')
    
    return stats_df[[
        'id', 'playId', 'airYards', 'yardsAfterCatch', 'expectedPoints', 'winProbability',
        'expectedYards', 'success', 'successProbability', 'totalHomeEpa', 'totalAwayEpa',
        'totalHomeRushEpa', 'totalAwayRushEpa', 'totalHomePassEpa', 'totalAwayPassEpa',
        'airEpa', 'yacEpa', 'xyacEpa', 'xyacMeanYardage', 'xyacMedianYardage',
        'xyacSuccess', 'xyacFd', 'xpass', 'passOe'
    ]]

def process_special_teams(df: pd.DataFrame) -> pd.DataFrame:
    """Process play special teams for bulk insert."""
    # Create unique play IDs by combining game_id and play_id
    df['special_teams_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_special_teams'
    
    special_teams_df = df[[
        'special_teams_id', 'id', 'punt_blocked', 'punt_inside_twenty',
        'punt_in_endzone', 'punt_out_of_bounds', 'punt_downed',
        'punt_fair_catch', 'kickoff_inside_twenty', 'kickoff_in_endzone',
        'kickoff_out_of_bounds', 'kickoff_downed', 'kickoff_fair_catch',
        'return_team', 'return_yards', 'punter_player_id',
        'punter_player_name', 'kicker_player_id', 'kicker_player_name'
    ]].copy()
    
    special_teams_df = special_teams_df.rename(columns={
        'special_teams_id': 'id',
        'id': 'playId',  # This references Play.id
        'punt_blocked': 'puntBlocked',
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
        'return_team': 'returnTeam',
        'return_yards': 'returnYards',
        'punter_player_id': 'punterPlayerId',
        'punter_player_name': 'punterPlayerName',
        'kicker_player_id': 'kickerPlayerId',
        'kicker_player_name': 'kickerPlayerName'
    })
    
    # Deduplicate on unique id
    special_teams_df = special_teams_df.drop_duplicates(subset=['id'], keep='first')
    
    # Convert boolean fields
    bool_columns = [
        'puntBlocked', 'puntInsideTwenty', 'puntInEndzone',
        'puntOutOfBounds', 'puntDowned', 'puntFairCatch',
        'kickoffInsideTwenty', 'kickoffInEndzone', 'kickoffOutOfBounds',
        'kickoffDowned', 'kickoffFairCatch'
    ]
    for col in bool_columns:
        special_teams_df[col] = pd.to_numeric(special_teams_df[col], errors='coerce').fillna(0).astype(bool)
    
    # Convert integer fields
    special_teams_df['returnYards'] = pd.to_numeric(special_teams_df['returnYards'], errors='coerce').fillna(0).astype(int)
    
    # Handle nullable text fields
    text_columns = ['returnTeam', 'punterPlayerId', 'punterPlayerName', 'kickerPlayerId', 'kickerPlayerName']
    for col in text_columns:
        special_teams_df[col] = special_teams_df[col].fillna('')
    
    # Add missing columns with default values
    special_teams_df['returnerPlayerId'] = ''
    special_teams_df['returnerPlayerName'] = ''
    
    return special_teams_df[[
        'id', 'playId', 'puntBlocked', 'puntInsideTwenty', 'puntInEndzone',
        'puntOutOfBounds', 'puntDowned', 'puntFairCatch', 'kickoffInsideTwenty',
        'kickoffInEndzone', 'kickoffOutOfBounds', 'kickoffDowned', 'kickoffFairCatch',
        'returnTeam', 'returnYards', 'punterPlayerId', 'punterPlayerName',
        'kickerPlayerId', 'kickerPlayerName', 'returnerPlayerId', 'returnerPlayerName'
    ]]

def process_game_info(df: pd.DataFrame) -> pd.DataFrame:
    """Process play game info for bulk insert."""
    # Create unique play IDs by combining game_id and play_id
    df['game_info_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_game_info'
    
    game_info_df = df[[
        'game_info_id', 'id', 'total_home_score', 'total_away_score', 'stadium',
        'weather', 'surface', 'roof', 'temp', 'wind', 'home_coach', 'away_coach'
    ]].copy()
    
    game_info_df = game_info_df.rename(columns={
        'game_info_id': 'id',
        'id': 'playId',  # This references Play.id
        'total_home_score': 'homeScore',
        'total_away_score': 'awayScore',
        'temp': 'temperature',
        'wind': 'windSpeed',
        'home_coach': 'homeCoach',
        'away_coach': 'awayCoach'
    })
    
    # Deduplicate on unique id
    game_info_df = game_info_df.drop_duplicates(subset=['id'], keep='first')
    
    # Convert integer fields
    game_info_df['homeScore'] = pd.to_numeric(game_info_df['homeScore'], errors='coerce').fillna(0).astype(int)
    game_info_df['awayScore'] = pd.to_numeric(game_info_df['awayScore'], errors='coerce').fillna(0).astype(int)
    game_info_df['temperature'] = pd.to_numeric(game_info_df['temperature'], errors='coerce').fillna(0).astype(int)
    game_info_df['windSpeed'] = pd.to_numeric(game_info_df['windSpeed'], errors='coerce').fillna(0).astype(int)
    
    # Handle nullable text fields
    text_columns = ['stadium', 'weather', 'surface', 'roof', 'homeCoach', 'awayCoach']
    for col in text_columns:
        game_info_df[col] = game_info_df[col].fillna('')
    
    # Add missing columns with default values
    game_info_df['location'] = ''
    
    return game_info_df[[
        'id', 'playId', 'homeScore', 'awayScore', 'location', 'stadium', 'weather',
        'surface', 'roof', 'temperature', 'windSpeed', 'homeCoach', 'awayCoach'
    ]]

def process_drive_info(df: pd.DataFrame) -> pd.DataFrame:
    """Process drive info for bulk insert."""
    # Create unique drive IDs by combining game_id, play_id, and drive
    df['drive_info_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_drive'
    
    # Check which columns exist in the dataframe
    available_columns = []
    column_mapping = {
        'drive_play_count': 'drivePlayCount',
        'drive_time_of_possession': 'driveTimeOfPossession', 
        'drive_first_downs': 'driveFirstDowns',
        'drive_inside20': 'driveInside20',
        'drive_ended_with_score': 'driveEndedWithScore',
        'drive_quarter_start': 'driveQuarterStart',
        'drive_quarter_end': 'driveQuarterEnd',
        'drive_yards_penalized': 'driveYardsPenalized',
        'drive_start_transition': 'driveStartTransition',
        'drive_end_transition': 'driveEndTransition',
        'drive_start_yard_line': 'driveStartYardLine',
        'drive_end_yard_line': 'driveEndYardLine'
    }
    
    # Only select columns that exist
    for col in column_mapping.keys():
        if col in df.columns:
            available_columns.append(col)
    
    if not available_columns:
        # If no drive columns exist, create empty dataframe with required structure
        drive_info_df = pd.DataFrame({
            'drive_info_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_drive',
            'play_details_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_details'
        })
        drive_info_df = drive_info_df.rename(columns={'drive_info_id': 'id', 'play_details_id': 'playDetailsId'})
        
        # Add all required columns with default values
        for new_col in column_mapping.values():
            if new_col == 'drivePlayCount':
                drive_info_df[new_col] = 0
            elif new_col in ['driveInside20', 'driveEndedWithScore']:
                drive_info_df[new_col] = False
            elif new_col in ['driveFirstDowns', 'driveQuarterStart', 'driveQuarterEnd', 'driveYardsPenalized']:
                drive_info_df[new_col] = 0
            else:
                drive_info_df[new_col] = ''
        
        # Deduplicate on unique id
        drive_info_df = drive_info_df.drop_duplicates(subset=['id'], keep='first')
        return drive_info_df
    
    # Select available columns
    drive_info_df = df[['drive_info_id', 'id'] + available_columns].copy()
    
    # Rename columns
    rename_dict = {'drive_info_id': 'id', 'id': 'playDetailsId'}
    for old_col, new_col in column_mapping.items():
        if old_col in available_columns:
            rename_dict[old_col] = new_col
    
    drive_info_df = drive_info_df.rename(columns=rename_dict)
    
    # Fix the playDetailsId to use the correct format
    drive_info_df['playDetailsId'] = drive_info_df['playDetailsId'].astype(str) + '_details'
    
    # Add missing columns with default values
    for new_col in column_mapping.values():
        if new_col not in drive_info_df.columns:
            if new_col == 'drivePlayCount':
                drive_info_df[new_col] = 0
            elif new_col in ['driveInside20', 'driveEndedWithScore']:
                drive_info_df[new_col] = False
            elif new_col in ['driveFirstDowns', 'driveQuarterStart', 'driveQuarterEnd', 'driveYardsPenalized']:
                drive_info_df[new_col] = 0
            else:
                drive_info_df[new_col] = ''
    
    # Deduplicate on unique id
    drive_info_df = drive_info_df.drop_duplicates(subset=['id'], keep='first')
    
    # Convert integer fields
    int_columns = ['drivePlayCount', 'driveFirstDowns', 'driveQuarterStart', 'driveQuarterEnd', 'driveYardsPenalized']
    for col in int_columns:
        if col in drive_info_df.columns:
            drive_info_df[col] = pd.to_numeric(drive_info_df[col], errors='coerce').fillna(0).astype(int)
    
    # Convert boolean fields
    bool_columns = ['driveInside20', 'driveEndedWithScore']
    for col in bool_columns:
        if col in drive_info_df.columns:
            drive_info_df[col] = pd.to_numeric(drive_info_df[col], errors='coerce').fillna(0).astype(bool)
    
    # Handle nullable text fields
    text_columns = ['driveTimeOfPossession', 'driveStartTransition', 'driveEndTransition', 'driveStartYardLine', 'driveEndYardLine']
    for col in text_columns:
        if col in drive_info_df.columns:
            drive_info_df[col] = drive_info_df[col].fillna('')
    
    return drive_info_df[[
        'id', 'playDetailsId', 'drivePlayCount', 'driveTimeOfPossession', 'driveFirstDowns',
        'driveInside20', 'driveEndedWithScore', 'driveQuarterStart', 'driveQuarterEnd',
        'driveYardsPenalized', 'driveStartTransition', 'driveEndTransition',
        'driveStartYardLine', 'driveEndYardLine'
    ]]

def process_timeouts(df: pd.DataFrame) -> pd.DataFrame:
    """Process play timeouts for bulk insert."""
    # Create unique timeout IDs by combining game_id, play_id, and timeout info
    df['timeout_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_timeout'
    
    # Check which columns exist
    available_columns = []
    column_mapping = {
        'home_timeouts_remaining': 'homeRemaining',
        'away_timeouts_remaining': 'awayRemaining',
        'timeout_team': 'timeoutTeam'
    }
    
    for col in column_mapping.keys():
        if col in df.columns:
            available_columns.append(col)
    
    if not available_columns:
        # Create empty dataframe with required structure
        timeout_df = pd.DataFrame({
            'timeout_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_timeout',
            'play_details_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_details'
        })
        timeout_df = timeout_df.rename(columns={'timeout_id': 'id', 'play_details_id': 'playDetailsId'})
        
        # Add default values
        timeout_df['homeRemaining'] = 0
        timeout_df['awayRemaining'] = 0
        timeout_df['timeoutTeam'] = ''
        
        timeout_df = timeout_df.drop_duplicates(subset=['id'], keep='first')
        return timeout_df
    
    # Select available columns
    timeout_df = df[['timeout_id', 'id'] + available_columns].copy()
    
    # Rename columns
    rename_dict = {'timeout_id': 'id', 'id': 'playDetailsId'}
    for old_col, new_col in column_mapping.items():
        if old_col in available_columns:
            rename_dict[old_col] = new_col
    
    timeout_df = timeout_df.rename(columns=rename_dict)
    
    # Fix the playDetailsId to use the correct format
    timeout_df['playDetailsId'] = timeout_df['playDetailsId'].astype(str) + '_details'
    
    # Add missing columns with default values
    for new_col in column_mapping.values():
        if new_col not in timeout_df.columns:
            if new_col in ['homeRemaining', 'awayRemaining']:
                timeout_df[new_col] = 0
            else:
                timeout_df[new_col] = ''
    
    # Deduplicate on unique id
    timeout_df = timeout_df.drop_duplicates(subset=['id'], keep='first')
    
    # Convert integer fields
    timeout_df['homeRemaining'] = pd.to_numeric(timeout_df['homeRemaining'], errors='coerce').fillna(0).astype(int)
    timeout_df['awayRemaining'] = pd.to_numeric(timeout_df['awayRemaining'], errors='coerce').fillna(0).astype(int)
    
    # Handle nullable text fields
    timeout_df['timeoutTeam'] = timeout_df['timeoutTeam'].fillna('')
    
    return timeout_df[['id', 'playDetailsId', 'homeRemaining', 'awayRemaining', 'timeoutTeam']]

def process_fumble_info(df: pd.DataFrame) -> pd.DataFrame:
    """Process fumble info for bulk insert."""
    # Create unique fumble IDs by combining game_id, play_id, and fumble info
    df['fumble_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_fumble'
    
    # Check which columns exist
    available_columns = []
    column_mapping = {
        'fumble_forced': 'forced',
        'fumble_lost': 'lost',
        'fumble_out_of_bounds': 'outOfBounds'
    }
    
    for col in column_mapping.keys():
        if col in df.columns:
            available_columns.append(col)
    
    if not available_columns:
        # Create empty dataframe with required structure
        fumble_df = pd.DataFrame({
            'fumble_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_fumble',
            'play_participants_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_participants'
        })
        fumble_df = fumble_df.rename(columns={'fumble_id': 'id', 'play_participants_id': 'playParticipantsId'})
        
        # Add default values for all required columns
        fumble_df['fumbledTeam'] = ''
        fumble_df['fumbledPlayerId'] = ''
        fumble_df['fumbledPlayerName'] = ''
        fumble_df['recoveryTeam'] = ''
        fumble_df['recoveryYards'] = 0
        fumble_df['recoveryPlayerId'] = ''
        fumble_df['recoveryPlayerName'] = ''
        fumble_df['forced'] = False
        fumble_df['lost'] = False
        fumble_df['outOfBounds'] = False
        
        fumble_df = fumble_df.drop_duplicates(subset=['id'], keep='first')
        return fumble_df
    
    # Select available columns
    fumble_df = df[['fumble_id', 'participants_id'] + available_columns].copy()
    
    # Rename columns
    rename_dict = {'fumble_id': 'id', 'participants_id': 'playParticipantsId'}
    for old_col, new_col in column_mapping.items():
        if old_col in available_columns:
            rename_dict[old_col] = new_col
    
    fumble_df = fumble_df.rename(columns=rename_dict)
    
    # Fix the playParticipantsId to use the correct format
    fumble_df['playParticipantsId'] = fumble_df['playParticipantsId'].astype(str) + '_participants'
    
    # Add missing columns with default values
    fumble_df['fumbledTeam'] = ''
    fumble_df['fumbledPlayerId'] = ''
    fumble_df['fumbledPlayerName'] = ''
    fumble_df['recoveryTeam'] = ''
    fumble_df['recoveryYards'] = 0
    fumble_df['recoveryPlayerId'] = ''
    fumble_df['recoveryPlayerName'] = ''
    
    # Add missing boolean columns with default values
    for new_col in column_mapping.values():
        if new_col not in fumble_df.columns:
            fumble_df[new_col] = False
    
    # Deduplicate on unique id
    fumble_df = fumble_df.drop_duplicates(subset=['id'], keep='first')
    
    # Convert integer fields
    fumble_df['recoveryYards'] = pd.to_numeric(fumble_df['recoveryYards'], errors='coerce').fillna(0).astype(int)
    
    # Convert boolean fields
    bool_columns = ['forced', 'lost', 'outOfBounds']
    for col in bool_columns:
        if col in fumble_df.columns:
            fumble_df[col] = pd.to_numeric(fumble_df[col], errors='coerce').fillna(0).astype(bool)
    
    # Handle nullable text fields
    text_columns = ['fumbledTeam', 'fumbledPlayerId', 'fumbledPlayerName', 'recoveryTeam', 'recoveryPlayerId', 'recoveryPlayerName']
    for col in text_columns:
        if col in fumble_df.columns:
            fumble_df[col] = fumble_df[col].fillna('')
    
    return fumble_df[[
        'id', 'playParticipantsId', 'fumbledTeam', 'fumbledPlayerId', 'fumbledPlayerName',
        'recoveryTeam', 'recoveryYards', 'recoveryPlayerId', 'recoveryPlayerName',
        'forced', 'lost', 'outOfBounds'
    ]]

def process_interception_info(df: pd.DataFrame) -> pd.DataFrame:
    """Process interception info for bulk insert."""
    # Create unique interception IDs by combining game_id, play_id, and interception info
    df['interception_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_int'
    
    # Check which columns exist
    available_columns = []
    column_mapping = {
        'interception_player_id': 'interceptionPlayerId',
        'interception_player_name': 'interceptionPlayerName'
    }
    
    for col in column_mapping.keys():
        if col in df.columns:
            available_columns.append(col)
    
    if not available_columns:
        # Create empty dataframe with required structure
        interception_df = pd.DataFrame({
            'interception_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_int',
            'play_participants_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_participants'  # Fixed ID format
        })
        interception_df = interception_df.rename(columns={'interception_id': 'id', 'play_participants_id': 'playParticipantsId'})
        
        # Add default values
        interception_df['interceptionPlayerId'] = ''
        interception_df['interceptionPlayerName'] = ''
        
        interception_df = interception_df.drop_duplicates(subset=['id'], keep='first')
        return interception_df
    
    # Select available columns
    interception_df = df[['interception_id', 'participants_id'] + available_columns].copy()
    
    # Rename columns
    rename_dict = {'interception_id': 'id', 'participants_id': 'playParticipantsId'}
    for old_col, new_col in column_mapping.items():
        if old_col in available_columns:
            rename_dict[old_col] = new_col
    
    interception_df = interception_df.rename(columns=rename_dict)
    
    # Fix the playParticipantsId to use the correct format
    interception_df['playParticipantsId'] = interception_df['playParticipantsId'].astype(str) + '_participants'
    
    # Add missing columns with default values
    for new_col in column_mapping.values():
        if new_col not in interception_df.columns:
            interception_df[new_col] = ''
    
    # Deduplicate on unique id
    interception_df = interception_df.drop_duplicates(subset=['id'], keep='first')
    
    # Handle nullable text fields
    text_columns = ['interceptionPlayerId', 'interceptionPlayerName']
    for col in text_columns:
        if col in interception_df.columns:
            interception_df[col] = interception_df[col].fillna('')
    
    return interception_df[['id', 'playParticipantsId', 'interceptionPlayerId', 'interceptionPlayerName']]

def process_sack_players(df: pd.DataFrame) -> pd.DataFrame:
    """Process sack players for bulk insert."""
    # Create unique sack IDs by combining game_id, play_id, and sack info
    df['sack_id'] = df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_sack'
    
    # Check which columns exist
    available_columns = []
    column_mapping = {
        'sack_player_id': 'sackPlayerId',
        'sack_player_name': 'sackPlayerName',
        'half_sack_1_player_id': 'halfSack1PlayerId',
        'half_sack_1_player_name': 'halfSack1PlayerName',
        'half_sack_2_player_id': 'halfSack2PlayerId',
        'half_sack_2_player_name': 'halfSack2PlayerName'
    }
    
    for col in column_mapping.keys():
        if col in df.columns:
            available_columns.append(col)
    
    if not available_columns:
        # Create empty dataframe with required structure
        sack_df = pd.DataFrame({
            'sack_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_sack',
            'play_participants_id': df['game_id'].astype(str) + '_' + df['play_id'].astype(str) + '_participants'  # Fixed ID format
        })
        sack_df = sack_df.rename(columns={'sack_id': 'id', 'play_participants_id': 'playParticipantsId'})
        
        # Add default values
        for new_col in column_mapping.values():
            sack_df[new_col] = ''
        
        sack_df = sack_df.drop_duplicates(subset=['id'], keep='first')
        return sack_df
    
    # Select available columns
    sack_df = df[['sack_id', 'participants_id'] + available_columns].copy()
    
    # Rename columns
    rename_dict = {'sack_id': 'id', 'participants_id': 'playParticipantsId'}
    for old_col, new_col in column_mapping.items():
        if old_col in available_columns:
            rename_dict[old_col] = new_col
    
    sack_df = sack_df.rename(columns=rename_dict)
    
    # Fix the playParticipantsId to use the correct format
    sack_df['playParticipantsId'] = sack_df['playParticipantsId'].astype(str) + '_participants'
    
    # Add missing columns with default values
    for new_col in column_mapping.values():
        if new_col not in sack_df.columns:
            sack_df[new_col] = ''
    
    # Deduplicate on unique id
    sack_df = sack_df.drop_duplicates(subset=['id'], keep='first')
    
    # Handle nullable text fields
    text_columns = ['sackPlayerId', 'sackPlayerName', 'halfSack1PlayerId', 'halfSack1PlayerName', 'halfSack2PlayerId', 'halfSack2PlayerName']
    for col in text_columns:
        if col in sack_df.columns:
            sack_df[col] = sack_df[col].fillna('')
    
    return sack_df[[
        'id', 'playParticipantsId', 'sackPlayerId', 'sackPlayerName',
        'halfSack1PlayerId', 'halfSack1PlayerName', 'halfSack2PlayerId', 'halfSack2PlayerName'
    ]]

def import_plays(year: int):
    """Import play-by-play data for a specific year using bulk operations."""
    try:
        # Download and process data
        df = download_play_by_play_data(year)
        
        # Process all tables in parallel
        with ThreadPoolExecutor(max_workers=6) as executor:
            games_future = executor.submit(process_games, df)
            plays_future = executor.submit(process_plays, df)
            details_future = executor.submit(process_play_details, df)
            participants_future = executor.submit(process_participants, df)
            stats_future = executor.submit(process_advanced_stats, df)
            special_teams_future = executor.submit(process_special_teams, df)
            game_info_future = executor.submit(process_game_info, df)
            drive_info_future = executor.submit(process_drive_info, df)
            timeouts_future = executor.submit(process_timeouts, df)
            fumble_info_future = executor.submit(process_fumble_info, df)
            interception_info_future = executor.submit(process_interception_info, df)
            sack_players_future = executor.submit(process_sack_players, df)
            
            # Get results
            games_df = games_future.result()
            plays_df = plays_future.result()
            details_df = details_future.result()
            participants_df = participants_future.result()
            stats_df = stats_future.result()
            special_teams_df = special_teams_future.result()
            game_info_df = game_info_future.result()
            drive_info_df = drive_info_future.result()
            timeouts_df = timeouts_future.result()
            fumble_info_df = fumble_info_future.result()
            interception_info_df = interception_info_future.result()
            sack_players_df = sack_players_future.result()
        
        # Connect to database
        conn = psycopg.connect(DATABASE_URL)
        
        try:
            # Import games
            logger.info(f"Importing {len(games_df)} games for {year}...")
            bulk_insert_dataframe(conn, games_df, "Game", ["id"])
            
            # Import plays
            logger.info(f"Importing {len(plays_df)} plays for {year}...")
            bulk_insert_dataframe(conn, plays_df, "Play", ["id"])
            
            # Import play details
            logger.info(f"Importing {len(details_df)} play details for {year}...")
            bulk_insert_dataframe(conn, details_df, "PlayDetails", ["id"])
            
            # Import play participants
            logger.info(f"Importing {len(participants_df)} play participants for {year}...")
            bulk_insert_dataframe(conn, participants_df, "PlayParticipants", ["id"])
            
            # Import play advanced stats
            logger.info(f"Importing {len(stats_df)} play advanced stats for {year}...")
            bulk_insert_dataframe(conn, stats_df, "PlayAdvancedStats", ["id"])
            
            # Import play special teams
            logger.info(f"Importing {len(special_teams_df)} play special teams for {year}...")
            bulk_insert_dataframe(conn, special_teams_df, "PlaySpecialTeams", ["id"])
            
            # Import play game info
            logger.info(f"Importing {len(game_info_df)} play game info for {year}...")
            bulk_insert_dataframe(conn, game_info_df, "PlayGameInfo", ["id"])
            
            # Import drive info
            logger.info(f"Importing {len(drive_info_df)} drive info for {year}...")
            bulk_insert_dataframe(conn, drive_info_df, "DriveInfo", ["id"])
            
            # Import play timeouts
            logger.info(f"Importing {len(timeouts_df)} play timeouts for {year}...")
            bulk_insert_dataframe(conn, timeouts_df, "PlayTimeouts", ["id"])
            
            # Import fumble info
            logger.info(f"Importing {len(fumble_info_df)} fumble info for {year}...")
            bulk_insert_dataframe(conn, fumble_info_df, "FumbleInfo", ["id"])
            
            # Import interception info
            logger.info(f"Importing {len(interception_info_df)} interception info for {year}...")
            bulk_insert_dataframe(conn, interception_info_df, "InterceptionInfo", ["id"])
            
            # Import sack players
            logger.info(f"Importing {len(sack_players_df)} sack players for {year}...")
            bulk_insert_dataframe(conn, sack_players_df, "SackPlayers", ["id"])
            
            logger.info(f"Successfully imported all data for {year}")
            
        except Exception as e:
            logger.error(f"Error during import for {year}: {str(e)}")
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Failed to import play-by-play data for {year}: {str(e)}")
        raise

def main():
    """Main function to import play-by-play data."""
    try:
        # Import data for a single year for testing
        year = 2000
        logger.info(f"Importing data for {year}...")
        import_plays(year)
        
    except Exception as e:
        logger.error(f"Failed to import play-by-play data: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()