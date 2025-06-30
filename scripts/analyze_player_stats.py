import pandas as pd
import requests
from typing import Dict, Any, List
import os

def to_camel_case(snake_str: str) -> str:
    """Convert snake_case to camelCase."""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def download_player_stats_sample(year: int = 1999) -> pd.DataFrame:
    """Download a sample of player stats data for analysis."""
    print(f"Downloading player stats sample for {year}...")
    url = f"https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_{year}.csv"
    
    try:
        df = pd.read_csv(url, low_memory=False)
        print(f"Downloaded {len(df)} rows for {year}")
        return df
    except Exception as e:
        print(f"Failed to download player stats for {year}: {str(e)}")
        raise

def analyze_player_stats_types(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Analyze data types for player stats columns."""
    results = []
    
    for col in df.columns:
        # Get data type info
        dtype = df[col].dtype
        null_count = df[col].isnull().sum()
        null_percentage = (null_count / len(df)) * 100
        
        # Get sample values for analysis
        sample_values = df[col].dropna().head(20).tolist()
        
        # Determine Prisma type
        prisma_type = determine_player_stats_type(dtype, sample_values, col)
        
        # Convert to camelCase
        camel_case = to_camel_case(col)
        
        # Check if field should be optional
        is_optional = null_percentage > 0 or col not in ['player_id', 'season', 'week', 'season_type']
        
        results.append({
            'original_column': col,
            'camel_case': camel_case,
            'pandas_dtype': str(dtype),
            'prisma_type': prisma_type,
            'is_optional': is_optional,
            'null_count': null_count,
            'null_percentage': null_percentage,
            'sample_values': sample_values[:5]
        })
    
    return results

def determine_player_stats_type(dtype: Any, sample_values: list, column_name: str) -> str:
    """Determine the appropriate Prisma type for player stats columns."""
    
    # Handle specific column patterns
    if 'id' in column_name.lower():
        return 'String'
    
    if 'name' in column_name.lower():
        return 'String'
    
    if 'team' in column_name.lower():
        return 'String'
    
    if 'position' in column_name.lower():
        return 'String'
    
    if 'url' in column_name.lower():
        return 'String'
    
    if 'season_type' in column_name.lower():
        return 'String'
    
    if 'opponent' in column_name.lower():
        return 'String'
    
    # Handle numeric types
    if 'int' in str(dtype):
        return 'Int'
    
    if 'float' in str(dtype):
        # Known Float columns that should never be Boolean
        float_blacklist = {
            'passing_yards', 'passing_tds', 'passing_air_yards', 'passing_yards_after_catch',
            'passing_first_downs', 'passing_epa', 'passing_2pt_conversions', 'pacr', 'dakota',
            'rushing_yards', 'rushing_tds', 'rushing_first_downs', 'rushing_epa', 'rushing_2pt_conversions',
            'receiving_yards', 'receiving_tds', 'receiving_air_yards', 'receiving_yards_after_catch',
            'receiving_first_downs', 'receiving_epa', 'receiving_2pt_conversions', 'racr',
            'target_share', 'air_yards_share', 'wopr', 'fantasy_points', 'fantasy_points_ppr',
            'sack_yards', 'sack_fumbles', 'sack_fumbles_lost', 'rushing_fumbles', 'rushing_fumbles_lost',
            'receiving_fumbles', 'receiving_fumbles_lost', 'special_teams_tds'
        }
        
        # If column is in blacklist, it's definitely Float
        if column_name in float_blacklist:
            return 'Float'
        
        # Known Boolean columns that should always be Boolean
        boolean_whitelist = {
            # Add any Boolean columns if they exist in player stats
        }
        
        # If column is in whitelist, it's definitely Boolean
        if column_name in boolean_whitelist:
            return 'Boolean'
        
        # For other float columns, check if they contain ONLY 0, 1, or null values
        if sample_values and len(sample_values) >= 5:
            unique_values = set()
            for val in sample_values:
                if pd.notnull(val) and val not in [None, '']:
                    unique_values.add(val)
            
            # If all values are only 0, 1, 0.0, or 1.0, it's likely Boolean
            if unique_values.issubset({0, 1, 0.0, 1.0}):
                return 'Boolean'
        
        return 'Float'
    
    # Default to String for unknown types
    return 'String'

def generate_player_stats_mapping(analysis_results: list) -> str:
    """Generate the complete player stats schema mapping."""
    
    output = []
    output.append("# NFL Player Stats Schema Analysis")
    output.append(f"# Generated from analysis of {len(analysis_results)} columns")
    output.append("")
    
    # Summary
    total_columns = len(analysis_results)
    optional_columns = sum(1 for r in analysis_results if r['is_optional'])
    required_columns = total_columns - optional_columns
    
    output.append(f"## Summary")
    output.append(f"- Total columns: {total_columns}")
    output.append(f"- Required columns: {required_columns}")
    output.append(f"- Optional columns: {optional_columns}")
    output.append("")
    output.append("**Required columns**: Fields with 0% null values (essential for the record)")
    output.append("**Optional columns**: Fields with >0% null values (can be empty)")
    output.append("")
    
    # Column mappings
    output.append("## Column Mappings")
    output.append("| Original Column | CamelCase | Pandas Type | Prisma Type | Optional | Null % | Sample Values |")
    output.append("|----------------|-----------|-------------|-------------|----------|--------|---------------|")
    
    for result in analysis_results:
        sample_str = str(result['sample_values'])[:50] + "..." if len(str(result['sample_values'])) > 50 else str(result['sample_values'])
        optional_str = "Yes" if result['is_optional'] else "No"
        null_pct = f"{result['null_percentage']:.1f}%"
        
        output.append(f"| {result['original_column']} | {result['camel_case']} | {result['pandas_dtype']} | {result['prisma_type']} | {optional_str} | {null_pct} | {sample_str} |")
    
    output.append("")
    
    # Clean Prisma schema for copy-paste
    output.append("## Complete Prisma Schema (Copy-Paste Ready)")
    output.append("```prisma")
    output.append("model PlayerWeeklyStats {")
    output.append("  id String @id @default(cuid())")
    output.append("  playerId String")  # Always include playerId
    
    for result in analysis_results:
        if result['original_column'] == 'player_id':
            continue  # Skip player_id as it's already defined as playerId
        
        field_name = result['camel_case']
        field_type = result['prisma_type']
        optional_marker = "?" if result['is_optional'] else ""
        
        # Handle special cases
        if field_name == 'specialTeamsTds':
            field_type = 'Int'  # Force this to be Int, not String
        
        output.append(f"  {field_name} {field_type}{optional_marker}")
    
    output.append("")
    output.append("  @@unique([playerId, season, week, seasonType])")
    output.append("  @@index([playerId])")
    output.append("  @@index([playerName])")
    output.append("  @@index([season])")
    output.append("  @@index([recentTeam])")
    output.append("}")
    output.append("```")
    
    output.append("")
    output.append("## Required Fields Only")
    output.append("```prisma")
    output.append("model PlayerWeeklyStats {")
    output.append("  id String @id @default(cuid())")
    output.append("  playerId String")  # Always include playerId
    
    for result in analysis_results:
        if result['original_column'] == 'player_id':
            continue
        
        if not result['is_optional']:
            field_name = result['camel_case']
            field_type = result['prisma_type']
            
            # Handle special cases
            if field_name == 'specialTeamsTds':
                field_type = 'Int'
            
            output.append(f"  {field_name} {field_type}")
    
    output.append("")
    output.append("  @@unique([playerId, season, week, seasonType])")
    output.append("  @@index([playerId])")
    output.append("  @@index([playerName])")
    output.append("  @@index([season])")
    output.append("  @@index([recentTeam])")
    output.append("}")
    output.append("```")
    
    return "\n".join(output)

def main():
    """Main analysis function."""
    print("Loading player stats sample for analysis...")
    
    # Download sample data
    df = download_player_stats_sample(1999)
    
    print(f"Analyzing {len(df.columns)} columns from {len(df)} rows...")
    
    # Analyze data types
    analysis_results = analyze_player_stats_types(df)
    
    # Generate schema mapping
    schema_mapping = generate_player_stats_mapping(analysis_results)
    
    # Save to file
    with open('samples/player_stats_analysis.txt', 'w') as f:
        f.write(schema_mapping)
    
    print("Analysis complete! Results saved to samples/player_stats_analysis.txt")
    
    # Print summary
    total_columns = len(analysis_results)
    optional_columns = sum(1 for r in analysis_results if r['is_optional'])
    required_columns = total_columns - optional_columns
    
    print(f"\nSummary:")
    print(f"- Total columns: {total_columns}")
    print(f"- Required columns: {required_columns}")
    print(f"- Optional columns: {optional_columns}")
    print(f"\nCheck samples/player_stats_analysis.txt for the complete Prisma schema!")

if __name__ == "__main__":
    main() 