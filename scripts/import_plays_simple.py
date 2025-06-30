import os
import logging
import pandas as pd
import requests
import psycopg
from psycopg.rows import dict_row
from psycopg.copy import Copy
import sys
from datetime import datetime
from typing import List, Dict, Any
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

def to_camel_case(snake_str):
    """Convert snake_case to camelCase."""
    components = snake_str.split('_')
    return components[0] + ''.join(word.capitalize() for word in components[1:])

def normalize_df(df):
    """Normalize DataFrame to match our Play schema."""
    # Create a copy to avoid modifying original
    df = df.copy()
    
    # Convert all column names to camelCase
    column_mapping = {}
    for col in df.columns:
        camel_col = to_camel_case(col)
        column_mapping[col] = camel_col
    
    # Rename columns
    df = df.rename(columns=column_mapping)
    
    # Create unique id for each play
    df['id'] = df['gameId'].astype(str) + '_' + df['playId'].astype(str)
    
    return df

def convert_types(df):
    """Convert DataFrame types to match Prisma schema."""
    # Convert numeric columns (Int in Prisma)
    int_columns = ['week', 'quarterSecondsRemaining', 'halfSecondsRemaining', 'gameSecondsRemaining', 
                  'quarterEnd', 'down', 'goalToGo', 'ydstogo', 'kickDistance', 'touchback', 
                  'totalHomeScore', 'totalAwayScore', 'season', 'replayOrChallenge', 'awayScore', 
                  'homeScore', 'result', 'total', 'divGame', 'abortedPlay', 'outOfBounds', 
                  'homeOpeningKickoff', 'passerJerseyNumber', 'rusherJerseyNumber', 'receiverJerseyNumber', 
                  'jerseyNumber', 'shotgun', 'noHuddle', 'qbKneel', 'qbSpike', 'qbScramble']
    
    for col in int_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')
    
    # Convert float columns (Float in Prisma)
    float_columns = ['yardline100', 'drive', 'sp', 'qtr', 'ydsnet', 'yardsGained', 'qbDropback', 
                    'airYards', 'yardsAfterCatch', 'scoreDifferential', 'scoreDifferentialPost', 
                    'noScoreProb', 'oppFgProb', 'oppSafetyProb', 'oppTdProb', 'fgProb', 'safetyProb', 
                    'tdProb', 'extraPointProb', 'twoPointConversionProb', 'ep', 'epa', 'totalHomeEpa', 
                    'totalAwayEpa', 'totalHomeRushEpa', 'totalAwayRushEpa', 'totalHomePassEpa', 
                    'totalAwayPassEpa', 'airEpa', 'yacEpa', 'compAirEpa', 'compYacEpa', 
                    'totalHomeCompAirEpa', 'totalAwayCompAirEpa', 'totalHomeCompYacEpa', 'totalAwayCompYacEpa', 
                    'totalHomeRawAirEpa', 'totalAwayRawAirEpa', 'totalHomeRawYacEpa', 'totalAwayRawYacEpa', 
                    'wp', 'defWp', 'homeWp', 'awayWp', 'wpa', 'vegasWpa', 'vegasHomeWpa', 'homeWpPost', 
                    'awayWpPost', 'vegasWp', 'vegasHomeWp', 'totalHomeRushWpa', 'totalAwayRushWpa', 
                    'totalHomePassWpa', 'totalAwayPassWpa', 'airWpa', 'yacWpa', 'compAirWpa', 'compYacWpa', 
                    'totalHomeCompAirWpa', 'totalAwayCompAirWpa', 'totalHomeCompYacWpa', 'totalAwayCompYacWpa', 
                    'totalHomeRawAirWpa', 'totalAwayRawAirWpa', 'totalHomeRawYacWpa', 'totalAwayRawYacWpa', 
                    'puntBlocked', 'firstDownRush', 'firstDownPass', 'firstDownPenalty', 'thirdDownConverted', 
                    'thirdDownFailed', 'fourthDownConverted', 'fourthDownFailed', 'incompletePass', 
                    'interception', 'puntInEndzone', 'puntOutOfBounds', 'puntDowned', 'puntFairCatch', 
                    'kickoffInEndzone', 'kickoffOutOfBounds', 'kickoffDowned', 'kickoffFairCatch', 
                    'fumbleForced', 'fumbleNotForced', 'fumbleOutOfBounds', 'soloTackle', 'safety', 
                    'penalty', 'tackledForLoss', 'fumbleLost', 'ownKickoffRecovery', 'ownKickoffRecoveryTd', 
                    'qbHit', 'rushAttempt', 'passAttempt', 'sack', 'touchdown', 'passTouchdown', 
                    'rushTouchdown', 'returnTouchdown', 'extraPointAttempt', 'twoPointAttempt', 
                    'fieldGoalAttempt', 'kickoffAttempt', 'puntAttempt', 'fumble', 'completePass', 
                    'assistTackle', 'lateralReception', 'lateralRush', 'lateralReturn', 'lateralRecovery', 
                    'passingYards', 'receivingYards', 'rushingYards', 'lateralReceivingYards', 
                    'lateralRushingYards', 'returnYards', 'penaltyYards', 'spreadLine', 'totalLine', 
                    'surface', 'temp', 'wind', 'fumbleRecovery1Yards', 'fumbleRecovery2Yards', 
                    'qbEpa', 'xyacEpa', 'xyacMeanYardage', 'xyacMedianYardage', 'xyacSuccess', 'xyacFd', 
                    'xpass', 'passOe', 'cp', 'cpoe', 'series', 'seriesSuccess', 'playClock', 'playDeleted', 
                    'stPlayType', 'endYardLine', 'fixedDrive', 'drivePlayCount', 'driveFirstDowns', 
                    'driveEndedWithScore', 'driveQuarterStart', 'driveQuarterEnd', 'driveYardsPenalized']
    
    for col in float_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Convert boolean columns (Boolean in Prisma)
    boolean_columns = ['passLength', 'passLocation', 'penaltyType', 'success', 'passer', 'rusher', 
                      'pass', 'rush', 'firstDown', 'special', 'play', 'fantasy']
    
    for col in boolean_columns:
        if col in df.columns:
            df[col] = df[col].map(lambda x: bool(int(x)) if pd.notnull(x) and str(x).isdigit() else None)
    
    # Convert datetime columns (DateTime in Prisma)
    datetime_columns = ['gameDate']
    
    for col in datetime_columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    
    return df

def bulk_insert(conn, df, table):
    """Bulk insert DataFrame into database table."""
    # Use COPY for speed
    cols = list(df.columns)
    with conn.cursor() as cur:
        # Create temp table
        temp_table = f"temp_{table}"
        col_defs = ', '.join([f'"{c}" text' for c in cols])
        cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
        cur.execute(f"CREATE TEMP TABLE {temp_table} ({col_defs})")
        
        # Write to temp table
        col_names = ', '.join([f'"{c}"' for c in cols])
        cur.copy(f"COPY {temp_table} ({col_names}) FROM STDIN", df.astype(str).values.tolist())
        
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
        
        logger.info(f"Bulk inserting {len(df)} plays for {year}...")
        bulk_insert(conn, df, 'Play')
        logger.info(f"Done with {year}")
    conn.close()

def main():
    """Main function to import play-by-play data."""
    try:
        # Import data for all years
        import_all_years()
        
    except Exception as e:
        logger.error(f"Failed to import play-by-play data: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 