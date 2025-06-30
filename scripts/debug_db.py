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

def debug_database():
    """Comprehensive database debugging."""
    try:
        logger.info("=== DATABASE DEBUG START ===")
        logger.info(f"Connecting to: {DATABASE_URL}")
        
        conn = psycopg.connect(DATABASE_URL)
        
        with conn.cursor() as cur:
            # 1. Check connection
            cur.execute("SELECT version();")
            version = cur.fetchone()
            logger.info(f"✓ Connected to PostgreSQL: {version[0]}")
            
            # 2. Check current database and schema
            cur.execute("SELECT current_database(), current_schema();")
            db_info = cur.fetchone()
            logger.info(f"✓ Current database: {db_info[0]}, schema: {db_info[1]}")
            
            # 3. List all tables in public schema
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """)
            tables = cur.fetchall()
            logger.info(f"✓ Tables in public schema: {[table[0] for table in tables]}")
            
            # 4. Check Game table structure
            cur.execute("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'Game'
                ORDER BY ordinal_position;
            """)
            columns = cur.fetchall()
            logger.info("✓ Game table structure:")
            for col in columns:
                logger.info(f"  {col[0]}: {col[1]} (nullable: {col[2]})")
            
            # 5. Check current row counts
            for table in ['Game', 'Play', 'PlayDetails', 'PlayParticipants', 'PlayAdvancedStats', 'PlaySpecialTeams']:
                cur.execute(f'SELECT COUNT(*) FROM "{table}";')
                count = cur.fetchone()[0]
                logger.info(f"✓ Table {table}: {count} rows")
            
            # 6. Test manual insertion
            logger.info("✓ Testing manual insertion...")
            cur.execute("""
                INSERT INTO "Game" (id, season, week, "gameType", "homeTeam", "awayTeam", "homeScore", "awayScore", "createdAt", "updatedAt")
                VALUES ('DEBUG_TEST_001', 2024, 1, 'DEBUG', 'HOME', 'AWAY', 0, 0, NOW(), NOW())
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
            
            # 7. Verify insertion
            cur.execute('SELECT COUNT(*) FROM "Game" WHERE id = \'DEBUG_TEST_001\';')
            test_count = cur.fetchone()[0]
            logger.info(f"✓ Manual test record count: {test_count}")
            
            if test_count > 0:
                cur.execute('SELECT * FROM "Game" WHERE id = \'DEBUG_TEST_001\';')
                test_record = cur.fetchone()
                logger.info(f"✓ Test record: {test_record}")
            
            # 8. Test transaction commit
            logger.info("✓ Testing transaction commit...")
            with conn.transaction():
                cur.execute("""
                    INSERT INTO "Game" (id, season, week, "gameType", "homeTeam", "awayTeam", "homeScore", "awayScore", "createdAt", "updatedAt")
                    VALUES ('DEBUG_TEST_002', 2024, 2, 'DEBUG', 'HOME2', 'AWAY2', 1, 1, NOW(), NOW())
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
                logger.info("✓ Transaction insert completed")
            
            # 9. Verify transaction insertion
            cur.execute('SELECT COUNT(*) FROM "Game" WHERE id = \'DEBUG_TEST_002\';')
            trans_count = cur.fetchone()[0]
            logger.info(f"✓ Transaction test record count: {trans_count}")
            
            # 10. Final row count
            cur.execute('SELECT COUNT(*) FROM "Game";')
            final_count = cur.fetchone()[0]
            logger.info(f"✓ Final Game table count: {final_count}")
            
            # 11. Clean up test records
            cur.execute('DELETE FROM "Game" WHERE id LIKE \'DEBUG_TEST_%\';')
            logger.info("✓ Test records cleaned up")
            
        conn.commit()
        conn.close()
        logger.info("=== DATABASE DEBUG COMPLETE ===")
        
    except Exception as e:
        logger.error(f"❌ Database debug failed: {str(e)}")
        if hasattr(e, 'pgerror') and e.pgerror:
            logger.error(f"❌ PostgreSQL error: {e.pgerror}")
        raise

if __name__ == "__main__":
    debug_database() 