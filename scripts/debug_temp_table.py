import os
import psycopg
import pandas as pd
from datetime import datetime
import sys

DATABASE_URL = os.getenv('DATABASE_URL')

def debug_temp_table():
    """Debug what's happening with the temp table."""
    conn = psycopg.connect(DATABASE_URL)
    
    try:
        # Use real values from the import script
        test_data = {
            'id': ['2024_01_ARI_BUF'],
            'season': [2024],
            'week': [1],
            'gameType': ['REG'],
            'homeTeam': ['BUF'],
            'awayTeam': ['ARI'],
            'homeScore': [0],
            'awayScore': [0],
            'createdAt': [datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            'updatedAt': [datetime.now().strftime('%Y-%m-%d %H:%M:%S')]
        }
        df = pd.DataFrame(test_data)
        
        print("Test DataFrame:")
        print(df)
        print(f"DataFrame dtypes: {df.dtypes}")
        
        with conn.cursor() as cur:
            # Create temp table
            cur.execute("DROP TABLE IF EXISTS temp_Game")
            cur.execute("""
                CREATE TEMP TABLE temp_Game (
                    "id" text, "season" integer, "week" integer, "gameType" text,
                    "homeTeam" text, "awayTeam" text, "homeScore" integer, "awayScore" integer,
                    "createdAt" timestamp, "updatedAt" timestamp
                )
            """)
            
            # Copy data using the same method as import script
            with cur.copy("COPY temp_Game FROM STDIN") as copy:
                for _, row in df.iterrows():
                    row_data = []
                    for col in df.columns:
                        value = row[col]
                        if pd.isna(value):
                            row_data.append(None)
                        else:
                            row_data.append(value)
                    copy.write_row(row_data)
            
            # Check temp table
            cur.execute("SELECT COUNT(*) FROM temp_Game")
            temp_count = cur.fetchone()[0]
            print(f"\nTemp table count: {temp_count}")
            
            cur.execute("SELECT * FROM temp_Game")
            temp_rows = cur.fetchall()
            print(f"Temp table rows: {temp_rows}")
            
            # Try the upsert
            upsert_sql = '''
                INSERT INTO "Game" ("id", "season", "week", "gameType", "homeTeam", "awayTeam", "homeScore", "awayScore", "createdAt", "updatedAt")
                SELECT * FROM temp_Game
                ON CONFLICT ("id")
                DO UPDATE SET "season" = EXCLUDED."season", "week" = EXCLUDED."week", "gameType" = EXCLUDED."gameType", "homeTeam" = EXCLUDED."homeTeam", "awayTeam" = EXCLUDED."awayTeam", "homeScore" = EXCLUDED."homeScore", "awayScore" = EXCLUDED."awayScore", "updatedAt" = NOW()
            '''
            print(f"\nUpsert SQL:\n{upsert_sql}")
            
            cur.execute(upsert_sql)
            conn.commit()
            
            # Check final result
            cur.execute('SELECT COUNT(*) FROM "Game" WHERE id = %s', ('2024_01_ARI_BUF',))
            final_count = cur.fetchone()[0]
            print(f"\nFinal count for id=2024_01_ARI_BUF: {final_count}")
            
            if final_count > 0:
                cur.execute('SELECT * FROM "Game" WHERE id = %s', ('2024_01_ARI_BUF',))
                print("Inserted row:", cur.fetchone())
            else:
                print("No row inserted!")
                
            # Check all games
            cur.execute('SELECT COUNT(*) FROM "Game"')
            total_games = cur.fetchone()[0]
            print(f"\nTotal games in database: {total_games}")
            
            if total_games > 0:
                cur.execute('SELECT id, season, week, "homeTeam", "awayTeam" FROM "Game" LIMIT 5')
                print("Sample games:", cur.fetchall())
                
    except Exception as e:
        print(f"Error: {e}")
        if hasattr(e, 'pgerror'):
            print(f"PostgreSQL error: {e.pgerror}")
    finally:
        conn.close()

if __name__ == "__main__":
    debug_temp_table() 