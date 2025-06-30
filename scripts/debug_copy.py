import os
import psycopg
import pandas as pd
from io import StringIO
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL')

def test_copy():
    """Test the copy mechanism with psycopg3's Copy API."""
    conn = psycopg.connect(DATABASE_URL)
    
    try:
        # Create a simple test DataFrame
        test_data = {
            'id': ['TEST_001', 'TEST_002'],
            'season': [2024, 2024],
            'week': [1, 2],
            'gameType': ['REG', 'REG'],
            'homeTeam': ['HOME', 'HOME2'],
            'awayTeam': ['AWAY', 'AWAY2'],
            'homeScore': [0, 0],
            'awayScore': [0, 0],
            'createdAt': [datetime.now().strftime('%Y-%m-%d %H:%M:%S'), datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            'updatedAt': [datetime.now().strftime('%Y-%m-%d %H:%M:%S'), datetime.now().strftime('%Y-%m-%d %H:%M:%S')]
        }
        df = pd.DataFrame(test_data)
        
        logger.info(f"Test DataFrame:\n{df}")
        logger.info(f"DataFrame columns: {df.columns.tolist()}")
        logger.info(f"DataFrame dtypes: {df.dtypes}")
        
        # Create temp table
        with conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS temp_test")
            cur.execute("""
                CREATE TEMP TABLE temp_test (
                    "id" text, "season" integer, "week" integer, "gameType" text,
                    "homeTeam" text, "awayTeam" text, "homeScore" integer, "awayScore" integer,
                    "createdAt" timestamp, "updatedAt" timestamp
                )
            """)
        
        # Use psycopg3's Copy API
        with conn.cursor() as cur:
            with cur.copy("COPY temp_test FROM STDIN") as copy:
                for _, row in df.iterrows():
                    copy.write_row([
                        row['id'], row['season'], row['week'], row['gameType'],
                        row['homeTeam'], row['awayTeam'], row['homeScore'], row['awayScore'],
                        row['createdAt'], row['updatedAt']
                    ])
            
            # Check what actually got inserted
            cur.execute("SELECT COUNT(*) FROM temp_test")
            count = cur.fetchone()[0]
            logger.info(f"Rows actually inserted: {count}")
            
            if count > 0:
                cur.execute("SELECT * FROM temp_test")
                rows = cur.fetchall()
                logger.info(f"Inserted rows: {rows}")
            else:
                logger.error("No rows were inserted!")
                
    except Exception as e:
        logger.error(f"Error: {e}")
        if hasattr(e, 'pgerror'):
            logger.error(f"PostgreSQL error: {e.pgerror}")
    finally:
        conn.close()

if __name__ == "__main__":
    test_copy() 