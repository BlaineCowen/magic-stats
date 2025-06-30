import pandas as pd

# Read the sample CSV
df = pd.read_csv('samples/pbp_sample.csv')

# Get all column names
columns = df.columns.tolist()
print(f"Total columns in sample: {len(columns)}")
print("\nAll columns:")
for i, col in enumerate(columns, 1):
    print(f"{i:3d}. {col}")

# Check which columns we have in our current Play model
current_play_fields = [
    'id', 'gameId', 'playId', 'quarter', 'down', 'yardsToGo', 'yardsGained', 
    'playType', 'possessionTeam', 'defensiveTeam', 'playDescription', 'epa', 
    'cpoe', 'success', 'yardline100', 'quarterSecsRemaining', 'halfSecsRemaining', 
    'gameSecsRemaining', 'goalToGo', 'shotgun', 'noHuddle', 'qbDropback', 
    'qbKneel', 'qbSpike', 'qbScramble', 'passLength', 'passLocation', 'runLocation', 
    'runGap', 'fieldGoalResult', 'kickDistance', 'airYards', 'yardsAfterCatch', 
    'passerId', 'passerName', 'receiverId', 'receiverName', 'rusherId', 'rusherName', 
    'passingYards', 'receivingYards', 'rushingYards', 'puntBlocked', 'puntInsideTwenty', 
    'puntInEndzone', 'puntOutOfBounds', 'puntDowned', 'puntFairCatch', 
    'kickoffInsideTwenty', 'kickoffInEndzone', 'kickoffOutOfBounds', 'kickoffDowned', 
    'kickoffFairCatch', 'returnTeam', 'returnYards', 'punterPlayerId', 'punterPlayerName', 
    'kickerPlayerId', 'kickerPlayerName', 'homeTimeoutsRemaining', 'awayTimeoutsRemaining', 
    'timeoutTeam', 'drivePlayCount', 'driveTimeOfPossession', 'driveFirstDowns', 
    'driveInside20', 'driveEndedWithScore', 'driveQuarterStart', 'driveQuarterEnd', 
    'driveYardsPenalized', 'driveStartTransition', 'driveEndTransition', 
    'driveStartYardLine', 'driveEndYardLine', 'fumbleForced', 'fumbleLost', 
    'fumbleOutOfBounds', 'interceptionPlayerId', 'interceptionPlayerName', 
    'sackPlayerId', 'sackPlayerName', 'halfSack1PlayerId', 'halfSack1PlayerName', 
    'halfSack2PlayerId', 'halfSack2PlayerName', 'stadium', 'weather', 'surface', 
    'roof', 'temperature', 'windSpeed', 'homeCoach', 'awayCoach'
]

print(f"\nCurrent Play model has {len(current_play_fields)} fields")

# Map CSV columns to our schema fields
column_mapping = {
    'play_id': 'playId',
    'game_id': 'gameId', 
    'qtr': 'quarter',
    'down': 'down',
    'ydstogo': 'yardsToGo',
    'yards_gained': 'yardsGained',
    'play_type': 'playType',
    'posteam': 'possessionTeam',
    'defteam': 'defensiveTeam',
    'desc': 'playDescription',
    'epa': 'epa',
    'cpoe': 'cpoe',
    'success': 'success',
    'yardline_100': 'yardline100',
    'quarter_seconds_remaining': 'quarterSecsRemaining',
    'half_seconds_remaining': 'halfSecsRemaining',
    'game_seconds_remaining': 'gameSecsRemaining',
    'goal_to_go': 'goalToGo',
    'shotgun': 'shotgun',
    'no_huddle': 'noHuddle',
    'qb_dropback': 'qbDropback',
    'qb_kneel': 'qbKneel',
    'qb_spike': 'qbSpike',
    'qb_scramble': 'qbScramble',
    'pass_length': 'passLength',
    'pass_location': 'passLocation',
    'run_location': 'runLocation',
    'run_gap': 'runGap',
    'field_goal_result': 'fieldGoalResult',
    'kick_distance': 'kickDistance',
    'air_yards': 'airYards',
    'yards_after_catch': 'yardsAfterCatch',
    'passer_player_id': 'passerId',
    'passer_player_name': 'passerName',
    'receiver_player_id': 'receiverId',
    'receiver_player_name': 'receiverName',
    'rusher_player_id': 'rusherId',
    'rusher_player_name': 'rusherName',
    'passing_yards': 'passingYards',
    'receiving_yards': 'receivingYards',
    'rushing_yards': 'rushingYards',
    'punt_blocked': 'puntBlocked',
    'punt_inside_twenty': 'puntInsideTwenty',
    'punt_in_endzone': 'puntInEndzone',
    'punt_out_of_bounds': 'puntOutOfBounds',
    'punt_downed': 'puntDowned',
    'punt_fair_catch': 'puntFairCatch',
    'kickoff_inside_twenty': 'kickoffInsideTwenty',
    'kickoff_in_endzone': 'kickoffInEndzone',
    'kickoff_out_of_bounds': 'kickoffOutOfBounds',
    'kickoff_downed': 'kickoffDowned',
    'kickoff_fair_catch': 'kickoffFairCatch',
    'return_team': 'returnTeam',
    'return_yards': 'returnYards',
    'punter_player_id': 'punterPlayerId',
    'punter_player_name': 'punterPlayerName',
    'kicker_player_id': 'kickerPlayerId',
    'kicker_player_name': 'kickerPlayerName',
    'home_timeouts_remaining': 'homeTimeoutsRemaining',
    'away_timeouts_remaining': 'awayTimeoutsRemaining',
    'timeout_team': 'timeoutTeam',
    'drive_play_count': 'drivePlayCount',
    'drive_time_of_possession': 'driveTimeOfPossession',
    'drive_first_downs': 'driveFirstDowns',
    'drive_inside20': 'driveInside20',
    'drive_ended_with_score': 'driveEndedWithScore',
    'drive_quarter_start': 'driveQuarterStart',
    'drive_quarter_end': 'driveQuarterEnd',
    'drive_yards_penalized': 'driveYardsPenalized',
    'drive_start_transition': 'driveStartTransition',
    'drive_end_transition': 'driveEndTransition',
    'drive_start_yard_line': 'driveStartYardLine',
    'drive_end_yard_line': 'driveEndYardLine',
    'fumble_forced': 'fumbleForced',
    'fumble_lost': 'fumbleLost',
    'fumble_out_of_bounds': 'fumbleOutOfBounds',
    'interception_player_id': 'interceptionPlayerId',
    'interception_player_name': 'interceptionPlayerName',
    'sack_player_id': 'sackPlayerId',
    'sack_player_name': 'sackPlayerName',
    'half_sack_1_player_id': 'halfSack1PlayerId',
    'half_sack_1_player_name': 'halfSack1PlayerName',
    'half_sack_2_player_id': 'halfSack2PlayerId',
    'half_sack_2_player_name': 'halfSack2PlayerName',
    'stadium': 'stadium',
    'weather': 'weather',
    'surface': 'surface',
    'roof': 'roof',
    'temp': 'temperature',
    'wind': 'windSpeed',
    'home_coach': 'homeCoach',
    'away_coach': 'awayCoach'
}

# Find missing columns
missing_columns = []
for col in columns:
    if col not in column_mapping:
        missing_columns.append(col)

print(f"\nMissing columns ({len(missing_columns)}):")
for col in missing_columns:
    print(f"  - {col}")

print(f"\nMapped columns ({len(column_mapping)}):")
for csv_col, schema_col in column_mapping.items():
    print(f"  - {csv_col} -> {schema_col}") 