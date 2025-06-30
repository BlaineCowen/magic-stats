import pandas as pd
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_columns():
    """Check what columns are available in the 2000 play-by-play data."""
    logger.info("Downloading 2000 play-by-play data...")
    url = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2000.csv"
    
    try:
        df = pd.read_csv(url, low_memory=False)
        logger.info(f"Downloaded {len(df)} plays for 2000")
        logger.info(f"Total columns: {len(df.columns)}")
        
        # Check for specific columns we need
        needed_columns = {
            'PlayGameInfo': ['total_home_score', 'total_away_score', 'stadium', 'weather', 'surface', 'roof', 'temp', 'wind', 'home_coach', 'away_coach'],
            'DriveInfo': ['drive_play_count', 'drive_time_of_possession', 'drive_first_downs', 'drive_inside_20', 'drive_ended_with_score', 'drive_quarter_start', 'drive_quarter_end', 'drive_yards_penalized', 'drive_start_transition', 'drive_end_transition', 'drive_start_yard_line', 'drive_end_yard_line'],
            'PlayTimeouts': ['home_timeouts_remaining', 'away_timeouts_remaining', 'timeout_team'],
            'FumbleInfo': ['fumbled_team', 'fumbled_player_id', 'fumbled_player_name', 'recovery_team', 'recovery_yards', 'recovery_player_id', 'recovery_player_name', 'fumble_forced', 'fumble_lost', 'fumble_out_of_bounds'],
            'InterceptionInfo': ['interception_player_id', 'interception_player_name'],
            'SackPlayers': ['sack_player_id', 'sack_player_name', 'half_sack_1_player_id', 'half_sack_1_player_name', 'half_sack_2_player_id', 'half_sack_2_player_name']
        }
        
        logger.info("\n=== COLUMN AVAILABILITY CHECK ===")
        for table, columns in needed_columns.items():
            logger.info(f"\n{table}:")
            available = []
            missing = []
            for col in columns:
                if col in df.columns:
                    available.append(col)
                else:
                    missing.append(col)
            
            if available:
                logger.info(f"  Available: {available}")
            if missing:
                logger.warning(f"  Missing: {missing}")
                
        # Show all columns
        logger.info(f"\n=== ALL COLUMNS ===")
        for i, col in enumerate(df.columns):
            logger.info(f"{i+1:3d}. {col}")
            
    except Exception as e:
        logger.error(f"Failed to download play-by-play data: {str(e)}")
        raise

if __name__ == "__main__":
    check_columns() 