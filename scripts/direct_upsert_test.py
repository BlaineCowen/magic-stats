import os
import psycopg
from datetime import datetime
import sys

DATABASE_URL = os.getenv('DATABASE_URL')

def main():
    conn = psycopg.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS temp_game_test")
            cur.execute("""
                CREATE TEMP TABLE temp_game_test (
                    "id" text, "season" integer, "week" integer, "gameType" text,
                    "homeTeam" text, "awayTeam" text, "homeScore" integer, "awayScore" integer,
                    "createdAt" timestamp, "updatedAt" timestamp
                )
            """)
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            row = [
                'TEST_DIRECT', 2024, 1, 'REG', 'HOME', 'AWAY', 0, 0, now, now
            ]
            with cur.copy("COPY temp_game_test FROM STDIN") as copy:
                copy.write_row(row)
            cur.execute("SELECT * FROM temp_game_test")
            temp_rows = cur.fetchall()
            print("TEMP TABLE ROWS:")
            for r in temp_rows:
                print(r)
            sys.stdout.flush()
            upsert_sql = '''
                INSERT INTO "Game" ("id", "season", "week", "gameType", "homeTeam", "awayTeam", "homeScore", "awayScore", "createdAt", "updatedAt")
                SELECT * FROM temp_game_test
                ON CONFLICT ("id")
                DO UPDATE SET "season" = EXCLUDED."season", "week" = EXCLUDED."week", "gameType" = EXCLUDED."gameType", "homeTeam" = EXCLUDED."homeTeam", "awayTeam" = EXCLUDED."awayTeam", "homeScore" = EXCLUDED."homeScore", "awayScore" = EXCLUDED."awayScore", "updatedAt" = NOW()
            '''
            print("\nUPSERT SQL:\n", upsert_sql)
            sys.stdout.flush()
            cur.execute(upsert_sql)
            cur.execute('SELECT COUNT(*) FROM "Game" WHERE id = %s', ('TEST_DIRECT',))
            count = cur.fetchone()[0]
            print(f"Rows in Game with id=TEST_DIRECT: {count}")
            if count > 0:
                cur.execute('SELECT * FROM "Game" WHERE id = %s', ('TEST_DIRECT',))
                print("Inserted row:", cur.fetchone())
            else:
                print("No row inserted!")
            sys.stdout.flush()
    finally:
        conn.close()

if __name__ == "__main__":
    main() 