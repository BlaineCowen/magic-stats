import os
import psycopg
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

def check_table_counts():
    """Check row counts for all Play-related tables."""
    tables = [
        'Game',
        'Play', 
        'PlayDetails',
        'PlayParticipants',
        'PlayAdvancedStats',
        'PlaySpecialTeams',
        'PlayGameInfo',
        'DriveInfo',
        'PlayTimeouts',
        'FumbleInfo',
        'InterceptionInfo',
        'SackPlayers'
    ]
    
    conn = psycopg.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            logger.info("=== TABLE ROW COUNTS ===")
            for table in tables:
                try:
                    cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                    count = cur.fetchone()[0]
                    logger.info(f"{table}: {count} rows")
                except Exception as e:
                    logger.error(f"Error checking {table}: {str(e)}")
            
            # Check for sample data
            logger.info("\n=== SAMPLE DATA CHECK ===")
            for table in tables:
                try:
                    cur.execute(f'SELECT * FROM "{table}" LIMIT 1')
                    sample = cur.fetchone()
                    if sample:
                        logger.info(f"{table}: Has data")
                    else:
                        logger.warning(f"{table}: No data")
                except Exception as e:
                    logger.error(f"Error checking sample for {table}: {str(e)}")
                    
    finally:
        conn.close()

if __name__ == "__main__":
    check_table_counts() 