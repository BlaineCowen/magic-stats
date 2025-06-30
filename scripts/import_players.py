import pandas as pd
import requests
import psycopg
from psycopg.rows import dict_row
from psycopg.copy import Copy
import logging
from datetime import datetime
from config import DATABASE_URL
import sys
from io import StringIO

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_player_data() -> pd.DataFrame:
    """Download player data from nflverse."""
    logger.info("Downloading player data...")
    url = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"
    
    try:
        df = pd.read_csv(url, low_memory=False)
        logger.info(f"Downloaded {len(df)} players")
        return df
    except Exception as e:
        logger.error(f"Failed to download player data: {str(e)}")
        raise

def process_players(df: pd.DataFrame) -> pd.DataFrame:
    """Process players data for bulk insert."""
    # Initialize missing columns with None
    required_columns = {
        'commonFirstName': None,
        'nflId': None,
        'pfrId': None,
        'pffId': None,
        'otcId': None,
        'espnId': None,
        'ngsPositionGroup': None,
        'ngsPosition': None,
        'rookieSeason': None,
        'lastSeason': None,
        'latestTeam': None,
        'ngsStatus': None,
        'ngsStatusDescription': None,
        'pffPosition': None,
        'pffStatus': None,
        'draftYear': None,
        'draftRound': None,
        'draftPick': None,
        'draftTeam': None
    }
    
    for col, default_value in required_columns.items():
        if col not in df.columns:
            df[col] = default_value
    
    # Add timestamps
    now = datetime.utcnow()
    df['createdAt'] = now
    df['updatedAt'] = now
    
    # Rename columns to match our schema
    df = df.rename(columns={
        'gsis_id': 'gsisId',
        'display_name': 'displayName',
        'common_first_name': 'commonFirstName',
        'first_name': 'firstName',
        'last_name': 'lastName',
        'short_name': 'shortName',
        'football_name': 'footballName',
        'suffix': 'suffix',
        'esb_id': 'esbId',
        'nfl_id': 'nflId',
        'pfr_id': 'pfrId',
        'pff_id': 'pffId',
        'otc_id': 'otcId',
        'espn_id': 'espnId',
        'smart_id': 'smartId',
        'birth_date': 'birthDate',
        'position_group': 'positionGroup',
        'position': 'position',
        'ngs_position_group': 'ngsPositionGroup',
        'ngs_position': 'ngsPosition',
        'height': 'height',
        'weight': 'weight',
        'headshot': 'headshot',
        'college_name': 'collegeName',
        'college_conference': 'collegeConference',
        'jersey_number': 'jerseyNumber',
        'rookie_season': 'rookieSeason',
        'last_season': 'lastSeason',
        'latest_team': 'latestTeam',
        'status': 'status',
        'ngs_status': 'ngsStatus',
        'ngs_status_short_description': 'ngsStatusDescription',
        'years_of_experience': 'yearsOfExperience',
        'pff_position': 'pffPosition',
        'pff_status': 'pffStatus',
        'draft_year': 'draftYear',
        'draft_round': 'draftRound',
        'draft_pick': 'draftPick',
        'draft_team': 'draftTeam'
    })
    
    # Filter out rows where required fields are null
    df = df.dropna(subset=['gsisId', 'firstName', 'lastName'])
    
    # Set id to be the same as gsisId
    df['id'] = df['gsisId']
    
    # Drop any columns that don't match our schema
    schema_columns = [
        'id', 'position', 'headshot', 'status', 'height', 'weight',
        'suffix', 'createdAt', 'updatedAt', 'birthDate', 'collegeConference',
        'collegeName', 'commonFirstName', 'displayName', 'draftPick',
        'draftRound', 'draftTeam', 'draftYear', 'esbId', 'espnId',
        'firstName', 'footballName', 'gsisId', 'jerseyNumber', 'lastName',
        'lastSeason', 'latestTeam', 'nflId', 'ngsPosition', 'ngsPositionGroup',
        'ngsStatus', 'ngsStatusDescription', 'otcId', 'pffId', 'pffPosition',
        'pffStatus', 'pfrId', 'positionGroup', 'rookieSeason', 'shortName',
        'smartId', 'yearsOfExperience'
    ]
    df = df[schema_columns]
    
    # Convert numeric fields
    numeric_fields = {
        'rookieSeason': 'Int64',
        'lastSeason': 'Int64',
        'weight': 'Int64',
        'yearsOfExperience': 'Int64',
        'draftYear': 'Int64',
        'draftRound': 'Int64',
        'draftPick': 'Int64'
    }
    
    for field, dtype in numeric_fields.items():
        if field in df.columns:
            df[field] = pd.to_numeric(df[field], errors='coerce').astype(dtype)
    
    # Convert date fields
    df['birthDate'] = pd.to_datetime(df['birthDate'], errors='coerce')
    
    return df

def bulk_insert_dataframe(conn: psycopg.Connection, df: pd.DataFrame, table: str, conflict_fields: list):
    """Bulk insert a dataframe using COPY command."""
    # Create temporary table
    temp_table = f"temp_{table}"
    column_types = {
        'id': 'text',
        'position': 'text',
        'headshot': 'text',
        'status': 'text',
        'height': 'text',
        'weight': 'integer',
        'suffix': 'text',
        'createdAt': 'timestamp(3) without time zone',
        'updatedAt': 'timestamp(3) without time zone',
        'birthDate': 'timestamp(3) without time zone',
        'collegeConference': 'text',
        'collegeName': 'text',
        'commonFirstName': 'text',
        'displayName': 'text',
        'draftPick': 'integer',
        'draftRound': 'integer',
        'draftTeam': 'text',
        'draftYear': 'integer',
        'esbId': 'text',
        'espnId': 'text',
        'firstName': 'text',
        'footballName': 'text',
        'gsisId': 'text',
        'jerseyNumber': 'text',
        'lastName': 'text',
        'lastSeason': 'integer',
        'latestTeam': 'text',
        'nflId': 'text',
        'ngsPosition': 'text',
        'ngsPositionGroup': 'text',
        'ngsStatus': 'text',
        'ngsStatusDescription': 'text',
        'otcId': 'text',
        'pffId': 'text',
        'pffPosition': 'text',
        'pffStatus': 'text',
        'pfrId': 'text',
        'positionGroup': 'text',
        'rookieSeason': 'integer',
        'shortName': 'text',
        'smartId': 'text',
        'yearsOfExperience': 'integer'
    }
    
    columns = df.columns.tolist()
    create_temp_table = f"""
        CREATE TEMP TABLE {temp_table} (
            {', '.join(f'"{col}" {column_types.get(col, "text")}' for col in columns)}
        ) ON COMMIT DROP
    """
    
    with conn.cursor() as cur:
        # Create temp table
        logger.info(f"Creating temp table: {create_temp_table}")
        cur.execute(create_temp_table)
        
        # Copy data to temp table
        buffer = StringIO()
        # Replace NaN with None for proper NULL handling
        df = df.replace({pd.NA: None, pd.NaT: None})
        df.to_csv(buffer, index=False, header=False, na_rep='\\N')
        buffer.seek(0)
        
        copy_cmd = f"COPY {temp_table} FROM STDIN WITH CSV NULL '\\N'"
        logger.info(f"Copying data: {copy_cmd}")
        with cur.copy(copy_cmd) as copy:
            copy.write(buffer.getvalue())
        
        # Perform upsert from temp table
        conflict_cols = ', '.join(f'"{f}"' for f in conflict_fields)
        update_cols = [col for col in columns if col not in conflict_fields and col != 'updatedAt']
        update_stmt = ', '.join(f'"{col}" = EXCLUDED."{col}"' for col in update_cols)
        if update_stmt:
            update_stmt += ', '
        update_stmt += '"updatedAt" = CURRENT_TIMESTAMP'
        
        upsert_query = f"""
            INSERT INTO "{table}" ({', '.join(f'"{col}"' for col in columns)})
            SELECT {', '.join(f'"{col}"::{column_types.get(col, "text")}' for col in columns)}
            FROM {temp_table}
            ON CONFLICT ({conflict_cols})
            DO UPDATE SET {update_stmt}
        """
        logger.info(f"Upserting data: {upsert_query}")
        cur.execute(upsert_query)
        
        # Verify the data was inserted
        verify_query = f'SELECT COUNT(*) FROM "{table}"'
        cur.execute(verify_query)
        count = cur.fetchone()[0]
        logger.info(f"Verified {count} rows in {table} table")

def import_players():
    """Import player data."""
    try:
        # Download and process data
        data = download_player_data()
        players = process_players(data)

        logger.info(f"Processing {len(players)} players...")
        logger.info("Importing players...")

        # Connect to database
        conn = psycopg.connect(DATABASE_URL)
        
        try:
            # Start transaction
            with conn.transaction():
                # Process players data
                df = pd.DataFrame(players)
                df = process_players(df)
                
                # Bulk insert players
                bulk_insert_dataframe(conn, df, "Player", ["id"])
                
                # Verify the data was inserted
                with conn.cursor() as cur:
                    cur.execute('SELECT COUNT(*) FROM "Player"')
                    count = cur.fetchone()[0]
                    logger.info(f"Inserted {count} players")
                
                logger.info("Successfully imported players")
            
        except Exception as e:
            logger.error(f"Error during import: {str(e)}")
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Failed to import player data: {str(e)}")
        raise

def main():
    """Main function to import player data."""
    try:
        logger.info("Starting player data import...")
        import_players()
        logger.info("Player data import completed")
    except Exception as e:
        logger.error(f"Failed to import player data: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 