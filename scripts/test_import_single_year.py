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
        # Take only first 1000 rows for testing
        df = df.head(1000)
        logger.info(f"Downloaded {len(df)} plays for {year} (test mode)")
        return df
    except Exception as e:
        logger.error(f"Failed to download play-by-play data for {year}: {str(e)}")
        raise

def process_games(df: pd.DataFrame) -> pd.DataFrame:
    """Process games data for bulk insert."""
    logger.info("Processing games data...")
    
    # Select and rename columns for Game table
    games_df = df[[
        'game_id', 'season', 'week', 'season_type',
        'home_team', 'away_team', 'total_home_score', 'total_away_score'
    ]].copy()
    
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
    games_df['createdAt'] = current_time
    games_df['updatedAt'] = current_time
    
    logger.info(f"Processed {len(games_df)} games")
    return games_df

def bulk_insert_dataframe(conn: psycopg.Connection, df: pd.DataFrame, table: str, conflict_fields: list):
    """Bulk insert a dataframe using COPY command."""
    try:
        # Create temporary table
        temp_table = f"temp_{table}"
        column_types = {
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
        } if table == "Game" else {}

        # Create temp table
        columns_sql = ", ".join([f'"{col}" {type}' for col, type in column_types.items()])
        create_temp_table_sql = f"CREATE TEMP TABLE {temp_table} ({columns_sql})"
        logger.info(f"Creating temp table for {table}...")
        with conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
            cur.execute(create_temp_table_sql)

        # Convert DataFrame to CSV
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, index=False, header=False, na_rep='\\N')
        csv_buffer.seek(0)

        # Copy data to temp table
        logger.info(f"Copying {len(df)} rows to temp table for {table}...")
        with conn.cursor() as cur:
            columns_str = ", ".join([f'"{col}"' for col in column_types.keys()])
            cur.copy(f"{temp_table} ({columns_str})", csv_buffer)
            logger.info(f"Copied {len(df)} rows to temp table for {table}")

            # Check what's in the temp table
            cur.execute(f"SELECT COUNT(*) FROM {temp_table};")
            temp_count = cur.fetchone()[0]
            logger.info(f"Temp table {temp_table} has {temp_count} rows")
            
            if temp_count > 0:
                cur.execute(f"SELECT * FROM {temp_table} LIMIT 3;")
                temp_rows = cur.fetchall()
                logger.info(f"Sample temp table rows: {temp_rows}")

            # Upsert data from temp table
            logger.info(f"Upserting data from temp table to {table}...")
            conflict_cols = ", ".join([f'"{col}"' for col in conflict_fields])
            update_cols = ", ".join([f'"{col}" = EXCLUDED."{col}"' for col in column_types.keys() if col not in conflict_fields])
            update_cols = update_cols.replace('"updatedAt" = EXCLUDED."updatedAt"', '"updatedAt" = NOW()')
            upsert_sql = f"""
                INSERT INTO "{table}" ({columns_str})
                SELECT * FROM {temp_table}
                ON CONFLICT ({conflict_cols})
                DO UPDATE SET {update_cols}
            """
            logger.info(f"Executing upsert SQL: {upsert_sql}")
            cur.execute(upsert_sql)
            logger.info(f"Upsert SQL executed successfully")
            
            # Check if data was actually inserted
            cur.execute(f'SELECT COUNT(*) FROM "{table}";')
            actual_count = cur.fetchone()[0]
            logger.info(f"Actual row count in {table} after upsert: {actual_count}")
            
            logger.info(f"Successfully upserted data. {table} now has {actual_count} total rows")

            # Drop temp table
            cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
            
    except Exception as e:
        logger.error(f"Error during bulk insert for {table}: {str(e)}")
        if hasattr(e, 'pgerror') and e.pgerror:
            logger.error(f"PostgreSQL error: {e.pgerror}")
        raise

def test_single_year():
    """Test import with a single year."""
    try:
        # Download and process data for 2024 (small sample)
        df = download_play_by_play_data(2024)
        
        # Process games
        games_df = process_games(df)
        
        # Connect to database
        conn = psycopg.connect(DATABASE_URL)
        
        try:
            # Check initial count
            with conn.cursor() as cur:
                cur.execute('SELECT COUNT(*) FROM "Game";')
                initial_count = cur.fetchone()[0]
                logger.info(f"Initial Game table count: {initial_count}")
            
            # Import games
            logger.info(f"Importing {len(games_df)} games for test...")
            with conn.transaction():
                bulk_insert_dataframe(conn, games_df, "Game", ["id"])
            
            # Check final count
            with conn.cursor() as cur:
                cur.execute('SELECT COUNT(*) FROM "Game";')
                final_count = cur.fetchone()[0]
                logger.info(f"Final Game table count: {final_count}")
                
                if final_count > 0:
                    cur.execute('SELECT id, season, week, "homeTeam", "awayTeam" FROM "Game" LIMIT 5;')
                    games = cur.fetchall()
                    logger.info("Sample games:")
                    for game in games:
                        logger.info(f"  {game}")
            
            logger.info("Test import completed successfully")
            
        except Exception as e:
            logger.error(f"Error during test import: {str(e)}")
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Failed to test import: {str(e)}")
        raise

if __name__ == "__main__":
    test_single_year() 