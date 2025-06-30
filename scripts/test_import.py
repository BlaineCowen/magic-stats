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
from import_plays import download_play_by_play_data, process_games, process_plays, bulk_insert_dataframe

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
        # Take only first 100 rows for testing
        df = df.head(100)
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
    
    return games_df

def test_small_import():
    """Test importing a small sample of data."""
    try:
        # Download data for 2024
        logger.info("Downloading 2024 data...")
        df = download_play_by_play_data(2024)
        
        # Take only first 100 rows for testing
        df_sample = df.head(100)
        logger.info(f"Testing with {len(df_sample)} rows")
        
        # Show sample data
        print("\nSample raw data:")
        print(df_sample[['game_id', 'play_id', 'season', 'week']].head())
        
        # Process games
        games_df = process_games(df_sample)
        logger.info(f"Processed {len(games_df)} games")
        
        # Process plays
        plays_df = process_plays(df_sample)
        logger.info(f"Processed {len(plays_df)} plays")
        
        # Show processed games data
        print("\nProcessed games data:")
        print(games_df[['id', 'season', 'week', 'homeTeam', 'awayTeam']].head())
        print("Unique id values in Game DataFrame:", games_df['id'].unique())
        print("Unique gameId values in Play DataFrame:", plays_df['gameId'].unique())
        
        # Check Play DataFrame columns
        print("\nPlays DataFrame columns:", plays_df.columns.tolist())
        expected_play_columns = [
            'id', 'gameId', 'quarter', 'down', 'yardsToGo', 'yardsGained',
            'playType', 'possessionTeam', 'defensiveTeam', 'playDescription',
            'epa', 'cpoe', 'success'
        ]
        print("Expected Play columns:", expected_play_columns)
        
        # Check for missing columns
        missing_columns = set(expected_play_columns) - set(plays_df.columns)
        extra_columns = set(plays_df.columns) - set(expected_play_columns)
        if missing_columns:
            print("Missing columns in plays_df:", missing_columns)
        if extra_columns:
            print("Extra columns in plays_df:", extra_columns)
        
        sys.stdout.flush()
        
        # Connect to database
        conn = psycopg.connect(DATABASE_URL)
        
        try:
            # Import games
            logger.info("Importing games...")
            bulk_insert_dataframe(conn, games_df, "Game", ["id"])
            
            # Import plays with error handling
            try:
                logger.info("Importing plays...")
                bulk_insert_dataframe(conn, plays_df, "Play", ["id"])
            except Exception as play_exc:
                logger.error(f"Error during Play insert: {play_exc}")
                import traceback
                traceback.print_exc()
            
            # Check if data was inserted
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM \"Game\" WHERE season = 2024")
                count = cur.fetchone()[0]
                logger.info(f"Games in database for 2024: {count}")
                
                if count > 0:
                    cur.execute("SELECT id, \"homeTeam\", \"awayTeam\" FROM \"Game\" WHERE season = 2024 LIMIT 5")
                    games = cur.fetchall()
                    logger.info(f"Sample games: {games}")
                else:
                    logger.error("No games were inserted!")
                    
                    # Check what's actually in the database
                    cur.execute("SELECT COUNT(*) FROM \"Game\"")
                    total_count = cur.fetchone()[0]
                    logger.info(f"Total games in database: {total_count}")
                    
                    if total_count > 0:
                        cur.execute("SELECT id, season, week FROM \"Game\" LIMIT 5")
                        all_games = cur.fetchall()
                        logger.info(f"All games in database: {all_games}")
                
                # Check Play table
                cur.execute("SELECT COUNT(*) FROM \"Play\" WHERE \"gameId\" LIKE '2024_01_ARI_BUF%'")
                play_count = cur.fetchone()[0]
                logger.info(f"Plays in database for game 2024_01_ARI_BUF: {play_count}")
                
                if play_count > 0:
                    cur.execute("SELECT id, \"gameId\", quarter, \"playType\" FROM \"Play\" WHERE \"gameId\" LIKE '2024_01_ARI_BUF%' LIMIT 5")
                    plays = cur.fetchall()
                    logger.info(f"Sample plays: {plays}")
                    
        except Exception as e:
            logger.error(f"Error during import: {str(e)}")
            if hasattr(e, 'pgerror') and e.pgerror:
                logger.error(f"PostgreSQL error: {e.pgerror}")
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        sys.exit(1)

def main():
    """Main function to test import."""
    try:
        # Test with just 2000 data
        logger.info("Testing import with 2000 data...")
        import_plays(2000)
        
    except Exception as e:
        logger.error(f"Failed to import play-by-play data: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_small_import()
    main() 