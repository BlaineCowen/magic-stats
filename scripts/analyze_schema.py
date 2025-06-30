import pandas as pd
import re
from typing import Dict, Any

def to_camel_case(snake_str: str) -> str:
    """Convert snake_case to camelCase."""
    components = snake_str.split('_')
    return components[0] + ''.join(word.capitalize() for word in components[1:])

def analyze_data_types(df: pd.DataFrame) -> Dict[str, Any]:
    """Analyze data types and create schema mappings."""
    results = []
    
    for col in df.columns:
        # Get data type info
        dtype = df[col].dtype
        null_count = df[col].isnull().sum()
        null_percentage = (null_count / len(df)) * 100
        
        # Get sample values for analysis
        sample_values = df[col].dropna().head(20).tolist()  # Get more samples for better analysis
        
        # Determine Prisma type
        prisma_type = determine_prisma_type(dtype, sample_values, col)
        
        # Convert to camelCase
        camel_case = to_camel_case(col)
        
        # Check if field should be optional
        # A field is optional if it has null values OR if it's not the primary identifier
        is_optional = null_percentage > 0 or col != 'play_id'  # Only play_id is truly required
        
        results.append({
            'original_column': col,
            'camel_case': camel_case,
            'pandas_dtype': str(dtype),
            'prisma_type': prisma_type,
            'is_optional': is_optional,
            'null_count': null_count,
            'null_percentage': null_percentage,
            'sample_values': sample_values[:5]  # First 5 non-null values
        })
    
    return results

def determine_prisma_type(dtype: Any, sample_values: list, column_name: str) -> str:
    """Determine the appropriate Prisma type based on pandas dtype and sample values."""
    
    # Handle specific column patterns
    if 'id' in column_name.lower():
        return 'String'
    
    if 'name' in column_name.lower():
        return 'String'
    
    if 'team' in column_name.lower():
        return 'String'
    
    if 'description' in column_name.lower() or 'desc' in column_name.lower():
        return 'String'
    
    if 'time' in column_name.lower():
        return 'String'
    
    if 'date' in column_name.lower():
        return 'DateTime'
    
    # Handle numeric types
    if 'int' in str(dtype):
        return 'Int'
    
    if 'float' in str(dtype):
        # Known Float columns that should never be Boolean
        float_blacklist = {
            'score_differential', 'score_differential_post', 'yardline_100', 'yards_gained',
            'air_yards', 'yards_after_catch', 'kick_distance', 'passing_yards', 'receiving_yards',
            'rushing_yards', 'return_yards', 'penalty_yards', 'fumble_recovery_1_yards',
            'fumble_recovery_2_yards', 'lateral_receiving_yards', 'lateral_rushing_yards',
            'drive_play_count', 'drive_first_downs', 'drive_quarter_start', 'drive_quarter_end',
            'drive_yards_penalized', 'epa', 'cpoe', 'ep', 'wp', 'wpa', 'total_home_epa',
            'total_away_epa', 'air_epa', 'yac_epa', 'comp_air_epa', 'comp_yac_epa',
            'total_home_rush_epa', 'total_away_rush_epa', 'total_home_pass_epa',
            'total_away_pass_epa', 'total_home_raw_air_epa', 'total_away_raw_air_epa',
            'total_home_raw_yac_epa', 'total_away_raw_yac_epa', 'vegas_wpa', 'vegas_home_wpa',
            'home_wp_post', 'away_wp_post', 'vegas_wp', 'vegas_home_wp', 'total_home_rush_wpa',
            'total_away_rush_wpa', 'total_home_pass_wpa', 'total_away_pass_wpa', 'air_wpa',
            'yac_wpa', 'comp_air_wpa', 'comp_yac_wpa', 'total_home_comp_air_wpa',
            'total_away_comp_air_wpa', 'total_home_comp_yac_wpa', 'total_away_comp_yac_wpa',
            'total_home_raw_air_wpa', 'total_away_raw_air_wpa', 'total_home_raw_yac_wpa',
            'total_away_raw_yac_wpa', 'no_score_prob', 'opp_fg_prob', 'opp_safety_prob',
            'opp_td_prob', 'fg_prob', 'safety_prob', 'td_prob', 'extra_point_prob',
            'two_point_conversion_prob', 'def_wp', 'home_wp', 'away_wp', 'spread_line',
            'total_line', 'surface', 'temp', 'wind', 'passer_jersey_number', 'rusher_jersey_number',
            'receiver_jersey_number', 'jersey_number', 'qb_epa', 'xyac_epa', 'xyac_mean_yardage',
            'xyac_median_yardage', 'xyac_success', 'xyac_fd', 'xpass', 'pass_oe', 'cp',
            'st_play_type', 'end_yard_line', 'drive_play_count', 'drive_first_downs',
            'drive_quarter_start', 'drive_quarter_end', 'drive_yards_penalized'
        }
        
        # If column is in blacklist, it's definitely Float
        if column_name in float_blacklist:
            return 'Float'
        
        # Known Boolean columns that should always be Boolean
        boolean_whitelist = {
            'touchdown', 'pass_touchdown', 'rush_touchdown', 'return_touchdown',
            'first_down_rush', 'first_down_pass', 'first_down_penalty',
            'third_down_converted', 'third_down_failed', 'fourth_down_converted',
            'fourth_down_failed', 'incomplete_pass', 'interception', 'punt_blocked',
            'punt_in_endzone', 'punt_out_of_bounds', 'punt_downed', 'punt_fair_catch',
            'kickoff_in_endzone', 'kickoff_out_of_bounds', 'kickoff_downed',
            'kickoff_fair_catch', 'fumble_forced', 'fumble_not_forced', 'fumble_out_of_bounds',
            'solo_tackle', 'safety', 'penalty', 'tackled_for_loss', 'fumble_lost',
            'own_kickoff_recovery', 'own_kickoff_recovery_td', 'qb_hit', 'rush_attempt',
            'pass_attempt', 'sack', 'extra_point_attempt', 'two_point_attempt',
            'field_goal_attempt', 'kickoff_attempt', 'punt_attempt', 'fumble',
            'complete_pass', 'assist_tackle', 'lateral_reception', 'lateral_rush',
            'lateral_return', 'lateral_recovery', 'tackle_with_assist',
            'defensive_two_point_attempt', 'defensive_two_point_conv',
            'defensive_extra_point_attempt', 'defensive_extra_point_conv',
            'drive_ended_with_score', 'success', 'first_down', 'qb_dropback',
            'qb_kneel', 'qb_spike', 'qb_scramble', 'shotgun', 'no_huddle',
            'goal_to_go', 'touchback', 'aborted_play', 'out_of_bounds',
            'home_opening_kickoff', 'replay_or_challenge', 'div_game'
        }
        
        # If column is in whitelist, it's definitely Boolean
        if column_name in boolean_whitelist:
            return 'Boolean'
        
        # For other float columns, check if they contain ONLY 0, 1, or null values
        # Get more sample values to be more confident
        if sample_values and len(sample_values) >= 5:
            # Get all unique non-null values
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

def generate_schema_mapping(analysis_results: list) -> str:
    """Generate the complete schema mapping."""
    
    output = []
    output.append("# NFL Play-by-Play Schema Analysis")
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
    output.append("model Play {")
    output.append("  id String @id")
    
    for result in analysis_results:
        if result['original_column'] == 'play_id' or result['camel_case'] == 'id':
            continue  # Skip the play_id field and any other id fields as they're already defined as id
        
        field_name = result['camel_case']
        field_type = result['prisma_type']
        optional_marker = "?" if result['is_optional'] else ""
        
        output.append(f"  {field_name} {field_type}{optional_marker}")
    
    output.append("")
    output.append("  @@index([gameId])")
    output.append("  @@index([playType])")
    output.append("  @@index([posteam])")
    output.append("  @@index([defteam])")
    output.append("  @@index([passerId])")
    output.append("  @@index([receiverId])")
    output.append("  @@index([rusherId])")
    output.append("}")
    output.append("```")
    
    output.append("")
    output.append("## Required Fields Only")
    output.append("```prisma")
    output.append("model Play {")
    output.append("  id String @id")
    
    for result in analysis_results:
        if result['original_column'] == 'play_id' or result['camel_case'] == 'id':
            continue
        
        if not result['is_optional']:
            field_name = result['camel_case']
            field_type = result['prisma_type']
            output.append(f"  {field_name} {field_type}")
    
    output.append("")
    output.append("  @@index([gameId])")
    output.append("  @@index([playType])")
    output.append("  @@index([possessionTeam])")
    output.append("  @@index([defensiveTeam])")
    output.append("  @@index([passerId])")
    output.append("  @@index([receiverId])")
    output.append("  @@index([rusherId])")
    output.append("}")
    output.append("```")
    
    return "\n".join(output)

def main():
    """Main analysis function."""
    print("Loading large sample for analysis...")
    
    # Load the large sample
    df = pd.read_csv('samples/pbp_large_sample.csv', low_memory=False)
    
    print(f"Analyzing {len(df.columns)} columns from {len(df)} rows...")
    
    # Analyze data types
    analysis_results = analyze_data_types(df)
    
    # Generate schema mapping
    schema_mapping = generate_schema_mapping(analysis_results)
    
    # Save to file
    with open('samples/schema_analysis.txt', 'w') as f:
        f.write(schema_mapping)
    
    print("Analysis complete! Results saved to samples/schema_analysis.txt")
    
    # Print summary
    total_columns = len(analysis_results)
    optional_columns = sum(1 for r in analysis_results if r['is_optional'])
    required_columns = total_columns - optional_columns
    
    print(f"\nSummary:")
    print(f"- Total columns: {total_columns}")
    print(f"- Required columns: {required_columns}")
    print(f"- Optional columns: {optional_columns}")
    print(f"\nCheck samples/schema_analysis.txt for the complete Prisma schema!")

if __name__ == "__main__":
    main() 