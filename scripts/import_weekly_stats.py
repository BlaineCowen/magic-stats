import os
import logging
import pandas as pd
import requests
from tqdm import tqdm
import psycopg
from psycopg.rows import dict_row
from datetime import datetime
import re
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

def parse_analysis_file():
    """Parse the analysis file to get column mappings and types."""
    analysis_file = 'samples/player_stats_analysis.txt'
    
    if not os.path.exists(analysis_file):
        raise FileNotFoundError(f"Analysis file not found: {analysis_file}")
    
    column_mappings = {}
    field_types = {}
    
    with open(analysis_file, 'r') as f:
        lines = f.readlines()
    
    # Find the table start
    table_start = None
    for i, line in enumerate(lines):
        if '| Original Column | CamelCase |' in line:
            table_start = i + 1
            break
    
    if table_start is None:
        raise ValueError("Could not find table in analysis file")
    
    # Parse table rows
    for line in lines[table_start:]:
        if not line.strip() or line.strip().startswith('|--') or line.strip().startswith('##'):
            continue
        
        # Split by | and clean up
        parts = [part.strip() for part in line.split('|')]
        if len(parts) >= 5:  # Need at least 5 parts for the table structure
            original_col = parts[1]
            camel_case = parts[2]
            prisma_type = parts[4]
            
            # Skip if any part is empty or looks like a header/separator
            if (original_col and camel_case and prisma_type and 
                not original_col.startswith('-') and 
                not camel_case.startswith('-') and
                not prisma_type.startswith('-') and
                original_col != 'Original Column' and
                camel_case != 'CamelCase' and
                prisma_type != 'Prisma Type'):
                
                column_mappings[original_col] = camel_case
                field_types[camel_case] = prisma_type
    
    logger.info(f"Parsed mappings: {list(column_mappings.items())[:5]}...")
    
    # Override specialTeamsTds to be Int (analysis file incorrectly says String)
    field_types['specialTeamsTds'] = 'Int'
    
    return column_mappings, field_types

def download_weekly_stats(year: int) -> pd.DataFrame:
    """Download weekly stats for a specific year."""
    url = f"https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_{year}.csv"
    logger.info(f"Downloading player stats for {year}...")
    try:
        df = pd.read_csv(url, low_memory=False)
        logger.info(f"Downloaded {len(df)} rows for {year}")
        return df
    except Exception as e:
        logger.error(f"Failed to download player stats for {year}: {e}")
        return None

def process_dataframe(df: pd.DataFrame, column_mappings: dict, field_types: dict) -> pd.DataFrame:
    """Process DataFrame with proper column mapping and data type conversion."""
    logger.info(f"Original columns: {df.columns.tolist()}")
    
    # Rename columns based on mappings
    df = df.rename(columns=column_mappings)
    
    logger.info(f"After renaming: {df.columns.tolist()}")
    
    # Add missing 'id' field (required by Prisma schema)
    df['id'] = df['playerId'].astype(str) + '_' + df['season'].astype(str) + '_' + df['week'].astype(str)
    
    # Remove duplicates based on unique constraint before processing
    df = df.drop_duplicates(subset=['playerId', 'season', 'week', 'seasonType'], keep='first')
    logger.info(f"After deduplication: {len(df)} rows")
    
    # Convert data types based on field_types
    for col, prisma_type in field_types.items():
        if col in df.columns:
            if prisma_type == 'Int':
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
            elif prisma_type == 'Float':
                df[col] = pd.to_numeric(df[col], errors='coerce')
            elif prisma_type == 'String':
                df[col] = df[col].fillna('').astype(str)
    
    # Force specialTeamsTds to Int
    if 'specialTeamsTds' in df.columns:
        df['specialTeamsTds'] = pd.to_numeric(df['specialTeamsTds'], errors='coerce').fillna(0).astype(int)
    
    # Ensure required fields are present and have correct types
    required_fields = ['id', 'playerId', 'season', 'week', 'seasonType']
    for field in required_fields:
        if field not in df.columns:
            if field == 'id':
                df[field] = df['playerId'].astype(str) + '_' + df['season'].astype(str) + '_' + df['week'].astype(str)
            elif field in ['season', 'week']:
                df[field] = 0
            else:
                df[field] = ''
    
    # Ensure all columns from the schema are present
    schema_columns = [
        'id', 'playerId', 'playerName', 'playerDisplayName', 'position', 'positionGroup', 
        'headshotUrl', 'recentTeam', 'season', 'week', 'seasonType', 'opponentTeam',
        'completions', 'attempts', 'passingYards', 'passingTds', 'interceptions', 'sacks',
        'sackYards', 'sackFumbles', 'sackFumblesLost', 'passingAirYards', 'passingYardsAfterCatch',
        'passingFirstDowns', 'passingEpa', 'passing2PtConversions', 'pacr', 'dakota', 'carries',
        'rushingYards', 'rushingTds', 'rushingFumbles', 'rushingFumblesLost', 'rushingFirstDowns',
        'rushingEpa', 'rushing2PtConversions', 'receptions', 'targets', 'receivingYards',
        'receivingTds', 'receivingFumbles', 'receivingFumblesLost', 'receivingAirYards',
        'receivingYardsAfterCatch', 'receivingFirstDowns', 'receivingEpa', 'receiving2PtConversions',
        'racr', 'targetShare', 'airYardsShare', 'wopr', 'specialTeamsTds', 'fantasyPoints', 'fantasyPointsPpr'
    ]
    
    for col in schema_columns:
        if col not in df.columns:
            if col in ['season', 'week', 'completions', 'attempts', 'passingYards', 'passingTds', 
                      'interceptions', 'sacks', 'sackYards', 'sackFumbles', 'sackFumblesLost',
                      'passingAirYards', 'passingYardsAfterCatch', 'passingFirstDowns', 
                      'passing2PtConversions', 'carries', 'rushingYards', 'rushingTds',
                      'rushingFumbles', 'rushingFumblesLost', 'rushingFirstDowns', 
                      'rushing2PtConversions', 'receptions', 'targets', 'receivingYards',
                      'receivingTds', 'receivingFumbles', 'receivingFumblesLost', 'receivingAirYards',
                      'receivingYardsAfterCatch', 'receivingFirstDowns', 'receiving2PtConversions',
                      'specialTeamsTds']:
                df[col] = 0
            elif col in ['passingEpa', 'pacr', 'dakota', 'rushingEpa', 'receivingEpa', 'racr',
                        'targetShare', 'airYardsShare', 'wopr', 'fantasyPoints', 'fantasyPointsPpr']:
                df[col] = 0.0
            else:
                df[col] = ''
    
    # Select only the columns that exist in the schema
    df = df[schema_columns]
    
    logger.info(f"Final columns: {df.columns.tolist()}")
    logger.info(f"Data types: {df.dtypes.to_dict()}")
    
    return df

def bulk_upsert_weekly_stats(conn, df: pd.DataFrame, field_types=None):
    """Bulk upsert weekly stats data."""
    table = 'PlayerWeeklyStats'
    columns = df.columns.tolist()
    temp_table = f"temp_{table}"

    # Map Prisma types to Postgres types
    type_map = {'Int': 'integer', 'Float': 'double precision', 'String': 'text'}
    if field_types is None:
        field_types = {}
    col_defs = []
    for col in columns:
        prisma_type = field_types.get(col, 'String')
        pg_type = type_map.get(prisma_type, 'text')
        col_defs.append(f'"{col}" {pg_type}')
    col_defs_str = ', '.join(col_defs)

    with conn.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
        cur.execute(f"CREATE TEMP TABLE {temp_table} ({col_defs_str})")

    # Copy data
    with conn.cursor() as cur:
        col_list = ', '.join([f'"{c}"' for c in columns])
        with cur.copy(f"COPY {temp_table} ({col_list}) FROM STDIN") as copy:
            for row in df.itertuples(index=False, name=None):
                copy.write_row([str(x) if pd.notnull(x) else None for x in row])

    # Upsert
    conflict_cols = '"playerId", "season", "week", "seasonType"'
    update_cols = ', '.join([f'"{col}" = EXCLUDED."{col}"' for col in columns if col not in ['id', 'playerId', 'season', 'week', 'seasonType']])
    upsert_sql = f'''
        INSERT INTO "{table}" ({', '.join([f'"{c}"' for c in columns])})
        SELECT * FROM {temp_table}
        ON CONFLICT ({conflict_cols})
        DO UPDATE SET {update_cols}
    '''
    with conn.cursor() as cur:
        try:
            cur.execute(upsert_sql)
        except Exception as sql_e:
            logger.error(f"SQL error: {sql_e}")
            logger.error(f"DataFrame dtypes: {df.dtypes}")
            logger.error(f"First row: {df.iloc[0].to_dict()}")
            logger.error(f"SQL attempted: {upsert_sql}")
            raise
        cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
    conn.commit()

def main():
    try:
        # Import all years 1999-2024
        years = list(range(1999, 2025))
        column_mappings, field_types = parse_analysis_file()
        conn = psycopg.connect(DATABASE_URL)
        try:
            for year in tqdm(years, desc="Years"):
                logger.info(f"Importing player stats for {year}...")
                df = download_weekly_stats(year)
                if df is None:
                    logger.error(f"No data for {year}")
                    continue
                df = process_dataframe(df, column_mappings, field_types)
                bulk_upsert_weekly_stats(conn, df, field_types)
                logger.info(f"Imported player stats for {year}")
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Failed to import player stats: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main() 