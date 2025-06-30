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

def test_connection():
    """Test database connection and basic operations."""
    try:
        logger.info("Testing database connection...")
        conn = psycopg.connect(DATABASE_URL)
        
        with conn.cursor() as cur:
            # Test basic query
            cur.execute("SELECT version();")
            version = cur.fetchone()
            logger.info(f"PostgreSQL version: {version[0]}")
            
            # Check if tables exist
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('Game', 'Play', 'PlayDetails', 'PlayParticipants', 'PlayAdvancedStats', 'PlaySpecialTeams')
                ORDER BY table_name;
            """)
            tables = cur.fetchall()
            logger.info(f"Found tables: {[table[0] for table in tables]}")
            
            # Check table counts
            for table in ['Game', 'Play', 'PlayDetails', 'PlayParticipants', 'PlayAdvancedStats', 'PlaySpecialTeams']:
                cur.execute(f'SELECT COUNT(*) FROM "{table}";')
                count = cur.fetchone()[0]
                logger.info(f"Table {table}: {count} rows")
            
            # Test inserting a simple record
            logger.info("Testing insertion...")
            cur.execute("""
                INSERT INTO "Game" (id, season, week, "gameType", "homeTeam", "awayTeam", "homeScore", "awayScore", "createdAt", "updatedAt")
                VALUES ('TEST_2024_01', 2024, 1, 'TEST', 'TEST_HOME', 'TEST_AWAY', 0, 0, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET 
                    season = EXCLUDED.season,
                    week = EXCLUDED.week,
                    "gameType" = EXCLUDED."gameType",
                    "homeTeam" = EXCLUDED."homeTeam",
                    "awayTeam" = EXCLUDED."awayTeam",
                    "homeScore" = EXCLUDED."homeScore",
                    "awayScore" = EXCLUDED."awayScore",
                    "updatedAt" = NOW();
            """)
            
            # Check if the test record was inserted
            cur.execute('SELECT COUNT(*) FROM "Game" WHERE id = \'TEST_2024_01\';')
            test_count = cur.fetchone()[0]
            logger.info(f"Test record count: {test_count}")
            
            # Clean up test record
            cur.execute('DELETE FROM "Game" WHERE id = \'TEST_2024_01\';')
            logger.info("Test record cleaned up")
            
        conn.commit()
        conn.close()
        logger.info("Database connection test completed successfully")
        
    except Exception as e:
        logger.error(f"Database connection test failed: {str(e)}")
        if hasattr(e, 'pgerror') and e.pgerror:
            logger.error(f"PostgreSQL error: {e.pgerror}")
        raise

if __name__ == "__main__":
    test_connection() 