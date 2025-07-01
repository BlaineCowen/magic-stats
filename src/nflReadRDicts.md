### Data Dictionaries:
# NFLREADR DATA DICTIONARIES
# =========================

# This document contains all available fields and their 
descriptions for nflreadr datasets.
# Use this reference when helping users query NFL data.

# dictionary_combine
# Field | Type | Description
# ----- | ---- | -----------
# season | numeric | 4 digit number indicating which season(s) 
the specified combine occurred.
# draft_year | numeric | Year that player was drafted
# draft_team | character | Team that drafted player
# draft_round | numeric | Round that player was drafted in
# draft_ovr | numeric | Pick number of player
# pfr_id | numeric | Pro-Football-Reference ID for player
# cfb_id | numeric | Sports Reference (CFB) ID for player
# player_name | character | Full name of player
# pos | character | Position of player
# school | character | College of player
# ht | numeric | Height of player (feet and inches)
# wt | numeric | Weight of player (lbs)
# forty | numeric | Player's 40 yard dash time at combine 
(seconds)
# bench | numeric | Reps benched by player at combine
# vertical | numeric | Player's vertical jump at combine 
(inches)
# broad_jump | numeric | Player's broad jump at combine (inches)
# cone | numeric | Player's 3 cone drill time at combine 
(seconds)
# shuttle | numeric | Player's shuttle run time at combine 
(seconds)

# dictionary_contracts
# Field | Type | Description
# ----- | ---- | -----------
# player | character | Player name
# position | character | Player's position
# team | character | Player's team
# is_active | logical | Active contract
# year_signed | numeric | Year the contract was signed
# years | numeric | Contract length
# value | numeric | Total contract value
# apy | numeric | Average money per contract year
# guaranteed | numeric | Total guaranteed money
# apy_cap_pct | numeric | Average money per contract year as 
percentage of the team's salary cap at signing
# inflated_value | numeric | Total contract value inflated to 
account for the rise of the salary cap
# inflated_apy | numeric | Average money per contract year 
inflated to account for the rise of the salary cap
# inflated_guaranteed | numeric | Total guaranteed money 
inflated to account for the rise of the salary cap
# player_page | character | Player's OverTheCap url
# otc_id | numeric | Player's OverTheCap ID

# dictionary_depth_charts
# Field | Type | Description
# ----- | ---- | -----------
# season | numeric | 4 digit number indicating to which season
(s) the specified timeframe belongs to.
# week | numeric | Week in season that depth chart is for. For 
17 week seasons, week 18 reflects the end-of-season depth 
charts, and week 19-on reflect postseason depth charts. For 18 
week seasons, week 19 reflects end-of-season depth charts.
# team | character | Team that depth chart belongs to
# season_type | character | REG or POST indicating if the depth 
chart belongs to regular or post season.
# position | character | Position of player
# depth_chart_position | character | Position of player listed 
on depth chart
# formation | character | Side of ball that player is on 
(offense, defense, special teams)
# depth_team | numeric | Position on depth chart
# jersey_number | numeric | Jersey number of player
# full_name | character | Full name of player
# first_name | character | First name of player
# last_name | character | Last name of player
# gsis_id | numeric | Game Stats and Info Service ID: the 
primary ID for play-by-play data.

# dictionary_draft_picks
# Field | Type | Description
# ----- | ---- | -----------
# season | integer | Draft Year
# round | integer | Draft round
# pick | integer | Draft overall pick
# team | character | Draft team
# gsis_id | character | ID for joining with nflverse data
# pfr_player_id | character | ID from Pro Football Reference
# cfb_player_id | character | ID from College Football Reference
# pfr_player_name | character | Player's name as recorded by PFR
# hof | logical | Whether player has been selected to the Pro 
Football Hall of Fame
# position | character | Player position as recorded by PFR
# category | character | Broader category of player positions
# side | character | O for offense, D for defense, S for 
special teams
# college | character | College attended in final year
# age | integer | Player age as of draft
# to | integer | Final season played in NFL
# allpro | numeric | Number of AP First Team All-Pro selections 
as recorded by PFR
# probowls | numeric | Number of Pro Bowls
# seasons_started | numeric | Number of seasons recorded as 
primary starter for position
# w_av | numeric | Weighted Approximate Value
# car_av | numeric | Career Approximate Value
# dr_av | numeric | Draft Approximate Value
# games | numeric | Games played in career
# pass_completions | numeric | Career pass completions
# pass_attempts | numeric | Career pass attempts
# pass_yards | numeric | Career pass yards thrown
# pass_tds | numeric | Career pass touchdowns thrown
# pass_ints | numeric | Career pass interceptions thrown
# rush_atts | numeric | Career rushing attempts
# rush_yards | numeric | Career rushing yards
# rush_tds | numeric | Career rushing touchdowns
# receptions | numeric | Career receptions
# rec_yards | numeric | Career receiving yards
# rec_tds | numeric | Career receiving touchdowns
# def_solo_tackles | numeric | Career solo tackles
# def_ints | numeric | Career interceptions
# def_sacks | numeric | Career sacks

# dictionary_espn_qbr
# Field | Type | Description
# ----- | ---- | -----------
# season | numeric | 4 digit number indicating to which season
(s) the specified timeframe belongs to.
# season_type | character | REG or POST indicating if the game 
belongs to regular or post season.
# game_week | numeric | Season week
# team_abb | character | Abbreviation of Team of Player
# player_id | numeric | ESPN Player ID
# name_short | character | Short name of player (First Initial, 
Last Name)
# rank | numeric | QBR Rank in specified timeframe
# qbr_total | numeric | Adjusted Total QBR, which adjusts 
quarterback play on 0-100 scale adjusted for strength of 
opposing defenses played.
# pts_added | numeric | Number of points contributed by a 
quarterback above the average level QB
# qb_plays | numeric | Total dropbacks for the quarterback 
(excludes handoffs)
# epa_total | numeric | Total Expected Points Added by 
quarterback, calculated by ESPN Win Probability Model
# pass | numeric | Expected Points Added on pass plays
# run | numeric | Expected Points Added on run plays
# exp_sack | numeric | Expected EPA Added on Sacks
# penalty | numeric | Expected Points Added on penalties
# qbr_raw | numeric | Raw total QBR, does not adjust for 
strength of opposing defenses played.
# sack | numeric | Expected Points Added on sacks
# name_first | character | First Name of Quarterback
# name_last | character | Last Name of Quarterback
# name_display | character | Full Name of Quarterback
# headshot_href | character | Link to ESPN Headshot of Player
# team | character | Full Team Name of Player
# qualified | character | True/False indicator of whether or 
not player meets minimum play requirement

# dictionary_ff_opportunity
# Field | Type | Description
# ----- | ---- | -----------
# game_id | character | Ten digit identifier for NFL game.
# desc | character | Detailed string description for the given 
play.
# rusher_player_id | character | Unique identifier for the 
player that attempted the run.
# full_name | character | Full name as per NFL.com
# posteam | character | String abbreviation for the team with 
possession.
# posteam_type | character | String indicating whether the 
posteam team is home or away.
# run_location | character | String indicator for location of 
run: left, middle, or right.
# run_gap | character | String indicator for line gap of run: 
end, guard, or tackle
# run_gap_dir | character | Combines run gap and direction, e.
g. left guard
# surface | character | What type of ground the game was played 
on. (Source: Pro-Football-Reference)
# roof | character | One of 'dome', 'outdoors', 'closed', 
'open' indicating indicating the roof status of the stadium the 
game was played in. (Source: Pro-Football-Reference)
# position | character | Primary position as reported by NFL.com
# era | character | one of pre2018 (2006-2017) or post2018 (2018
+)
# rush_touchdown | factor | Binary indicator for if the play 
resulted in a rushing TD.
# first_down | factor | Binary indicator if the play ended in a 
first down.
# qtr | factor | Quarter of the game (5 is overtime).
# down | factor | The down for the given play.
# goal_to_go | factor | Binary indicator for whether or not the 
posteam is in a goal down situation.
# shotgun | factor | Binary indicator for whether or not the 
play was in shotgun formation.
# no_huddle | factor | Binary indicator for whether or not the 
play was in no_huddle formation.
# qb_dropback | factor | Binary indicator for whether or not 
the QB dropped back on the play (pass attempt, sack, or 
scrambled).
# qb_scramble | factor | Binary indicator for whether or not 
the QB scrambled.
# play_id | numeric | Numeric play id that when used with 
game_id and drive provides the unique identifier for a single 
play.
# two_point_attempt | numeric | Binary indicator for two point 
conversion attempt.
# two_point_converted | numeric | A binary for whether a two 
point conversion was successful on this play
# rush_attempt | numeric | Binary indicator for if the play was 
a run.
# first_down_rush | numeric | Binary indicator for if a running 
play converted the first down.
# fumble_lost | numeric | Binary indicator for if the fumble 
was lost.
# season | numeric | 4 digit number indicating to which season 
the game belongs to.
# week | numeric | Season week.
# rushing_yards | numeric | Numeric yards by the 
rusher_player_name, excluding yards gained in rush plays with 
laterals. This should equal official rushing statistics but 
could miss yards gained in rush plays with laterals. Please see 
the description of `lateral_rusher_player_name` for further 
information.
# wind | numeric | The speed of the wind in miles/hour only for 
'roof' = 'outdoors' or 'open'. (Source: Pro-Football-Reference)
# temp | numeric | The temperature at the stadium only for 
'roof' = 'outdoors' or 'open'.(Source: Pro-Football-Reference)
# yardline_100 | numeric | Numeric distance in the number of 
yards from the opponent's endzone for the posteam.
# half_seconds_remaining | numeric | Numeric seconds remaining 
in the half.
# game_seconds_remaining | numeric | Numeric seconds remaining 
in the game.
# fixed_drive | numeric | Manually created drive number in a 
game.
# xpass | numeric | Probability of dropback scaled from 0 to 1.
# ydstogo | numeric | Numeric yards in distance from either the 
first down marker or the endzone in goal down situations.
# score_differential | numeric | Score differential between the 
posteam and defteam at the start of the play.
# ep | numeric | Using the scoring event probabilities, the 
estimated expected points with respect to the possession team 
for the given play.
# vegas_wp | numeric | Estimated win probabiity for the posteam 
given the current situation at the start of the given play, 
incorporating pre-game Vegas line.
# implied_total | numeric | The total number of points a team 
is expected to score in a game according to Vegas lines (spread 
and over/under)
# rush_yards_exp | numeric | Expected number of rush_yards in 
this game (weekly) or on this play (pbp_rush/pbp_pass) given 
situation
# rush_touchdown_exp | numeric | Expected number of 
rush_touchdown in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# rush_first_down_exp | numeric | Expected number of 
rush_first_down in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# two_point_conv_exp | numeric | Expected number of 
two_point_conv in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# passer_player_id | character | Unique identifier for the 
player that attempted the pass.
# passer_full_name | character | Full name of the passer as 
found within nflreadr::load_rosters
# passer_position | character | Position designation of the 
passer as found within nflreadr::load_rosters
# receiver_player_id | character | Unique identifier for the 
receiver that was targeted on the pass.
# receiver_full_name | character | Full name of the receiver as 
found within nflreadr::load_rosters
# receiver_position | character | Position designation of the 
receiver as found within nflreadr::load_rosters
# pass_location | character | String indicator for pass 
location: left, middle, or right.
# complete_pass | factor | Binary indicator for if the pass was 
completed.
# pass_touchdown | factor | Binary indicator for if the play 
resulted in a passing TD.
# interception | factor | Binary indicator for if the pass was 
intercepted.
# qb_hit | factor | Binary indicator if the QB was hit on the 
play.
# pass_attempt | numeric | Binary indicator for if the play was 
a pass attempt (includes sacks).
# receiving_yards | numeric | Numeric yards by the 
receiver_player_name, excluding yards gained in pass plays with 
laterals. This should equal official receiving statistics but 
could miss yards gained in pass plays with laterals. Please see 
the description of `lateral_receiver_player_name` for further 
information.
# first_down_pass | numeric | Binary indicator for if a passing 
play converted the first down.
# yards_after_catch | numeric | Numeric value for distance in 
yards perpendicular to the yard line where the receiver made 
the reception to where the play ended.
# relative_to_endzone | numeric | Numeric distance from the 
target location to the endzone, with negative values meaning 
'short of the endzone by X distance'
# total_line | numeric | The closing total line for the game. 
(Source: Pro-Football-Reference)
# relative_to_sticks | numeric | Numeric distance from the 
target location to the first down line to gain, with negative 
values meaning 'short of the sticks' and positive values 
meaning 'beyond the sticks'
# air_yards | numeric | Numeric value for distance in yards 
perpendicular to the line of scrimmage at where the targeted 
receiver either caught or didn't catch the ball.
# pass_completion_exp | numeric | Expected number of 
pass_completion in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# yards_after_catch_exp | numeric | Expected number of 
yards_after_catch in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# yardline_exp | numeric | Expected number of yardline in this 
game (weekly) or on this play (pbp_rush/pbp_pass) given 
situation
# pass_touchdown_exp | numeric | Expected number of 
pass_touchdown in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# pass_first_down_exp | numeric | Expected number of 
pass_first_down in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# pass_interception_exp | numeric | Expected number of 
pass_interception in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# player_id | character | Player ID (aka GSIS ID) as defined by 
nflreadr::load_rosters
# rec_attempt | numeric | Total number of targets for a given 
game
# pass_air_yards | numeric | Total air yards thrown for a given 
game
# rec_air_yards | numeric | Total air yards on receiving 
attempts for a given game
# pass_completions | numeric | Number of successful completions 
for a given game
# receptions | numeric | Total catches for a game.
# pass_completions_exp | numeric | Expected number of 
pass_completions in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# receptions_exp | numeric | Expected number of receptions in 
this game (weekly) or on this play (pbp_rush/pbp_pass) given 
situation
# pass_yards_gained | numeric | Total passing yards gained for 
a given game
# rec_yards_gained | numeric | Total receiving yards gained for 
a given game
# rush_yards_gained | numeric | Total rushing yards gained for 
a given game
# pass_yards_gained_exp | numeric | Expected number of 
pass_yards_gained in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# rec_yards_gained_exp | numeric | Expected number of 
rec_yards_gained in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# rush_yards_gained_exp | numeric | Expected number of 
rush_yards_gained in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# pass_touchdown | numeric | Total passing touchdowns
# rec_touchdown | numeric | Total receiving touchdowns
# rush_touchdown | numeric | Total rushing touchdowns
# rec_touchdown_exp | numeric | Expected number of 
rec_touchdown in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# pass_two_point_conv | numeric | Number of successful passing 
two point conversions
# rec_two_point_conv | numeric | Number of successful receiving 
two point conversions
# rush_two_point_conv | numeric | Number of successful rushing 
two point conversions
# pass_two_point_conv_exp | numeric | Expected number of 
pass_two_point_conv in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# rec_two_point_conv_exp | numeric | Expected number of 
rec_two_point_conv in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# rush_two_point_conv_exp | numeric | Expected number of 
rush_two_point_conv in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# pass_first_down | numeric | Number of passing first downs
# rec_first_down | numeric | Number of receiving first downs
# rush_first_down | numeric | Number of rushing first downs
# rec_first_down_exp | numeric | Expected number of 
rec_first_down in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# pass_interception | numeric | Number of interceptions thrown
# rec_interception | numeric | Number of interceptions on 
targets
# rec_interception_exp | numeric | Expected number of 
rec_interception in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# rec_fumble_lost | numeric | Number of fumbles on receiving 
attempts
# rush_fumble_lost | numeric | Number of fumbles on rushing 
attempts
# pass_fantasy_points_exp | numeric | Expected number of 
pass_fantasy_points in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# rec_fantasy_points_exp | numeric | Expected number of 
rec_fantasy_points in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# rush_fantasy_points_exp | numeric | Expected number of 
rush_fantasy_points in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# pass_fantasy_points | numeric | Total fantasy points from 
passing, assuming 0.04 points per pass yard, 4 points per pass 
TD, -2 points per interception
# rec_fantasy_points | numeric | Total fantasy points from 
receiving, assuming PPR scoring
# rush_fantasy_points | numeric | Total fantasy points from 
rushing, assuming PPR scoring
# total_yards_gained | numeric | Total scrimmage yards (sum of 
pass, rush, and receiving yards)
# total_yards_gained_exp | numeric | Expected number of 
total_yards_gained in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# total_touchdown | numeric | Total touchdowns (sum of pass, 
rush, and receiving touchdowns)
# total_touchdown_exp | numeric | Expected number of 
total_touchdown in this game (weekly) or on this play (pbp_rush/
pbp_pass) given situation
# total_first_down | numeric | Total first downs (sum of pass, 
rush, and receiving first downs)
# total_first_down_exp | numeric | Expected number of 
total_first_down in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# total_fantasy_points | numeric | Total fantasy points (sum of 
pass, rush, and receiving fantasy points)
# total_fantasy_points_exp | numeric | Expected number of 
total_fantasy_points in this game (weekly) or on this play 
(pbp_rush/pbp_pass) given situation
# pass_completions_diff | numeric | Difference between actual 
and expected number of pass_completions - often interpreted as 
efficiency for a given play/game
# receptions_diff | numeric | Difference between actual and 
expected number of receptions - often interpreted as efficiency 
for a given play/game
# pass_yards_gained_diff | numeric | Difference between actual 
and expected number of pass_yards_gained - often interpreted as 
efficiency for a given play/game
# rec_yards_gained_diff | numeric | Difference between actual 
and expected number of rec_yards_gained - often interpreted as 
efficiency for a given play/game
# rush_yards_gained_diff | numeric | Difference between actual 
and expected number of rush_yards_gained - often interpreted as 
efficiency for a given play/game
# pass_touchdown_diff | numeric | Difference between actual and 
expected number of pass_touchdown - often interpreted as 
efficiency for a given play/game
# rec_touchdown_diff | numeric | Difference between actual and 
expected number of rec_touchdown - often interpreted as 
efficiency for a given play/game
# rush_touchdown_diff | numeric | Difference between actual and 
expected number of rush_touchdown - often interpreted as 
efficiency for a given play/game
# pass_two_point_conv_diff | numeric | Difference between 
actual and expected number of pass_two_point_conv - often 
interpreted as efficiency for a given play/game
# rec_two_point_conv_diff | numeric | Difference between actual 
and expected number of rec_two_point_conv - often interpreted 
as efficiency for a given play/game
# rush_two_point_conv_diff | numeric | Difference between 
actual and expected number of rush_two_point_conv - often 
interpreted as efficiency for a given play/game
# pass_first_down_diff | numeric | Difference between actual 
and expected number of pass_first_down - often interpreted as 
efficiency for a given play/game
# rec_first_down_diff | numeric | Difference between actual and 
expected number of rec_first_down - often interpreted as 
efficiency for a given play/game
# rush_first_down_diff | numeric | Difference between actual 
and expected number of rush_first_down - often interpreted as 
efficiency for a given play/game
# pass_interception_diff | numeric | Difference between actual 
and expected number of pass_interception - often interpreted as 
efficiency for a given play/game
# rec_interception_diff | numeric | Difference between actual 
and expected number of rec_interception - often interpreted as 
efficiency for a given play/game
# pass_fantasy_points_diff | numeric | Difference between 
actual and expected number of pass_fantasy_points - often 
interpreted as efficiency for a given play/game
# rec_fantasy_points_diff | numeric | Difference between actual 
and expected number of rec_fantasy_points - often interpreted 
as efficiency for a given play/game
# rush_fantasy_points_diff | numeric | Difference between 
actual and expected number of rush_fantasy_points - often 
interpreted as efficiency for a given play/game
# total_yards_gained_diff | numeric | Difference between actual 
and expected number of total_yards_gained - often interpreted 
as efficiency for a given play/game
# total_touchdown_diff | numeric | Difference between actual 
and expected number of total_touchdown - often interpreted as 
efficiency for a given play/game
# total_first_down_diff | numeric | Difference between actual 
and expected number of total_first_down - often interpreted as 
efficiency for a given play/game
# total_fantasy_points_diff | numeric | Difference between 
actual and expected number of total_fantasy_points - often 
interpreted as efficiency for a given play/game
# pass_attempt_team | numeric | Team-level total pass_attempt 
for a game, summed across all plays/players for that team.
# rec_attempt_team | numeric | Team-level total rec_attempt for 
a game, summed across all plays/players for that team.
# rush_attempt_team | numeric | Team-level total rush_attempt 
for a game, summed across all plays/players for that team.
# pass_air_yards_team | numeric | Team-level total 
pass_air_yards for a game, summed across all plays/players for 
that team.
# rec_air_yards_team | numeric | Team-level total rec_air_yards 
for a game, summed across all plays/players for that team.
# pass_completions_team | numeric | Team-level total 
pass_completions for a game, summed across all plays/players 
for that team.
# receptions_team | numeric | Team-level total receptions for a 
game, summed across all plays/players for that team.
# pass_completions_exp_team | numeric | Team-level total 
expected pass_completions_exp for a game, summed across all 
plays & players for that team.
# receptions_exp_team | numeric | Team-level total expected 
receptions_exp for a game, summed across all plays & players 
for that team.
# pass_yards_gained_team | numeric | Team-level total 
pass_yards_gained for a game, summed across all plays/players 
for that team.
# rec_yards_gained_team | numeric | Team-level total 
rec_yards_gained for a game, summed across all plays/players 
for that team.
# rush_yards_gained_team | numeric | Team-level total 
rush_yards_gained for a game, summed across all plays/players 
for that team.
# pass_yards_gained_exp_team | numeric | Team-level total 
expected pass_yards_gained_exp for a game, summed across all 
plays & players for that team.
# rec_yards_gained_exp_team | numeric | Team-level total 
expected rec_yards_gained_exp for a game, summed across all 
plays & players for that team.
# rush_yards_gained_exp_team | numeric | Team-level total 
expected rush_yards_gained_exp for a game, summed across all 
plays & players for that team.
# pass_touchdown_team | numeric | Team-level total 
pass_touchdown for a game, summed across all plays/players for 
that team.
# rec_touchdown_team | numeric | Team-level total rec_touchdown 
for a game, summed across all plays/players for that team.
# rush_touchdown_team | numeric | Team-level total 
rush_touchdown for a game, summed across all plays/players for 
that team.
# pass_touchdown_exp_team | numeric | Team-level total expected 
pass_touchdown_exp for a game, summed across all plays & 
players for that team.
# rec_touchdown_exp_team | numeric | Team-level total expected 
rec_touchdown_exp for a game, summed across all plays & players 
for that team.
# rush_touchdown_exp_team | numeric | Team-level total expected 
rush_touchdown_exp for a game, summed across all plays & 
players for that team.
# pass_two_point_conv_team | numeric | Team-level total 
pass_two_point_conv for a game, summed across all plays/players 
for that team.
# rec_two_point_conv_team | numeric | Team-level total 
rec_two_point_conv for a game, summed across all plays/players 
for that team.
# rush_two_point_conv_team | numeric | Team-level total 
rush_two_point_conv for a game, summed across all plays/players 
for that team.
# pass_two_point_conv_exp_team | numeric | Team-level total 
expected pass_two_point_conv_exp for a game, summed across all 
plays & players for that team.
# rec_two_point_conv_exp_team | numeric | Team-level total 
expected rec_two_point_conv_exp for a game, summed across all 
plays & players for that team.
# rush_two_point_conv_exp_team | numeric | Team-level total 
expected rush_two_point_conv_exp for a game, summed across all 
plays & players for that team.
# pass_first_down_team | numeric | Team-level total 
pass_first_down for a game, summed across all plays/players for 
that team.
# rec_first_down_team | numeric | Team-level total 
rec_first_down for a game, summed across all plays/players for 
that team.
# rush_first_down_team | numeric | Team-level total 
rush_first_down for a game, summed across all plays/players for 
that team.
# pass_first_down_exp_team | numeric | Team-level total 
expected pass_first_down_exp for a game, summed across all 
plays & players for that team.
# rec_first_down_exp_team | numeric | Team-level total expected 
rec_first_down_exp for a game, summed across all plays & 
players for that team.
# rush_first_down_exp_team | numeric | Team-level total 
expected rush_first_down_exp for a game, summed across all 
plays & players for that team.
# pass_interception_team | numeric | Team-level total 
pass_interception for a game, summed across all plays/players 
for that team.
# rec_interception_team | numeric | Team-level total 
rec_interception for a game, summed across all plays/players 
for that team.
# pass_interception_exp_team | numeric | Team-level total 
expected pass_interception_exp for a game, summed across all 
plays & players for that team.
# rec_interception_exp_team | numeric | Team-level total 
expected rec_interception_exp for a game, summed across all 
plays & players for that team.
# rec_fumble_lost_team | numeric | Team-level total 
rec_fumble_lost for a game, summed across all plays/players for 
that team.
# rush_fumble_lost_team | numeric | Team-level total 
rush_fumble_lost for a game, summed across all plays/players 
for that team.
# pass_fantasy_points_exp_team | numeric | Team-level total 
expected pass_fantasy_points_exp for a game, summed across all 
plays & players for that team.
# rec_fantasy_points_exp_team | numeric | Team-level total 
expected rec_fantasy_points_exp for a game, summed across all 
plays & players for that team.
# rush_fantasy_points_exp_team | numeric | Team-level total 
expected rush_fantasy_points_exp for a game, summed across all 
plays & players for that team.
# pass_fantasy_points_team | numeric | Team-level total 
pass_fantasy_points for a game, summed across all plays/players 
for that team.
# rec_fantasy_points_team | numeric | Team-level total 
rec_fantasy_points for a game, summed across all plays/players 
for that team.
# rush_fantasy_points_team | numeric | Team-level total 
rush_fantasy_points for a game, summed across all plays/players 
for that team.
# total_yards_gained_team | numeric | Team-level total 
total_yards_gained for a game, summed across all plays/players 
for that team.
# total_yards_gained_exp_team | numeric | Team-level total 
expected total_yards_gained_exp for a game, summed across all 
plays & players for that team.
# total_touchdown_team | numeric | Team-level total 
total_touchdown for a game, summed across all plays/players for 
that team.
# total_touchdown_exp_team | numeric | Team-level total 
expected total_touchdown_exp for a game, summed across all 
plays & players for that team.
# total_first_down_team | numeric | Team-level total 
total_first_down for a game, summed across all plays/players 
for that team.
# total_first_down_exp_team | numeric | Team-level total 
expected total_first_down_exp for a game, summed across all 
plays & players for that team.
# total_fantasy_points_team | numeric | Team-level total 
total_fantasy_points for a game, summed across all plays/
players for that team.
# total_fantasy_points_exp_team | numeric | Team-level total 
expected total_fantasy_points_exp for a game, summed across all 
plays & players for that team.
# pass_completions_diff_team | numeric | Team-level difference 
between actual and expected number of pass_completions_diff for 
a game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# receptions_diff_team | numeric | Team-level difference 
between actual and expected number of receptions_diff for a 
game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# pass_yards_gained_diff_team | numeric | Team-level difference 
between actual and expected number of pass_yards_gained_diff 
for a game, summed across all plays/players for that team. 
Often interpreted as team-level efficiency.
# rec_yards_gained_diff_team | numeric | Team-level difference 
between actual and expected number of rec_yards_gained_diff for 
a game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# rush_yards_gained_diff_team | numeric | Team-level difference 
between actual and expected number of rush_yards_gained_diff 
for a game, summed across all plays/players for that team. 
Often interpreted as team-level efficiency.
# pass_touchdown_diff_team | numeric | Team-level difference 
between actual and expected number of pass_touchdown_diff for a 
game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# rec_touchdown_diff_team | numeric | Team-level difference 
between actual and expected number of rec_touchdown_diff for a 
game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# rush_touchdown_diff_team | numeric | Team-level difference 
between actual and expected number of rush_touchdown_diff for a 
game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# pass_two_point_conv_diff_team | numeric | Team-level 
difference between actual and expected number of 
pass_two_point_conv_diff for a game, summed across all plays/
players for that team. Often interpreted as team-level 
efficiency.
# rec_two_point_conv_diff_team | numeric | Team-level 
difference between actual and expected number of 
rec_two_point_conv_diff for a game, summed across all plays/
players for that team. Often interpreted as team-level 
efficiency.
# rush_two_point_conv_diff_team | numeric | Team-level 
difference between actual and expected number of 
rush_two_point_conv_diff for a game, summed across all plays/
players for that team. Often interpreted as team-level 
efficiency.
# pass_first_down_diff_team | numeric | Team-level difference 
between actual and expected number of pass_first_down_diff for 
a game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# rec_first_down_diff_team | numeric | Team-level difference 
between actual and expected number of rec_first_down_diff for a 
game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# rush_first_down_diff_team | numeric | Team-level difference 
between actual and expected number of rush_first_down_diff for 
a game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# pass_interception_diff_team | numeric | Team-level difference 
between actual and expected number of pass_interception_diff 
for a game, summed across all plays/players for that team. 
Often interpreted as team-level efficiency.
# rec_interception_diff_team | numeric | Team-level difference 
between actual and expected number of rec_interception_diff for 
a game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# pass_fantasy_points_diff_team | numeric | Team-level 
difference between actual and expected number of 
pass_fantasy_points_diff for a game, summed across all plays/
players for that team. Often interpreted as team-level 
efficiency.
# rec_fantasy_points_diff_team | numeric | Team-level 
difference between actual and expected number of 
rec_fantasy_points_diff for a game, summed across all plays/
players for that team. Often interpreted as team-level 
efficiency.
# rush_fantasy_points_diff_team | numeric | Team-level 
difference between actual and expected number of 
rush_fantasy_points_diff for a game, summed across all plays/
players for that team. Often interpreted as team-level 
efficiency.
# total_yards_gained_diff_team | numeric | Team-level 
difference between actual and expected number of 
total_yards_gained_diff for a game, summed across all plays/
players for that team. Often interpreted as team-level 
efficiency.
# total_touchdown_diff_team | numeric | Team-level difference 
between actual and expected number of total_touchdown_diff for 
a game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# total_first_down_diff_team | numeric | Team-level difference 
between actual and expected number of total_first_down_diff for 
a game, summed across all plays/players for that team. Often 
interpreted as team-level efficiency.
# total_fantasy_points_diff_team | numeric | Team-level 
difference between actual and expected number of 
total_fantasy_points_diff for a game, summed across all plays/
players for that team. Often interpreted as team-level 
efficiency.

# dictionary_nextgen_stats
# Field | Type | Description
# ----- | ---- | -----------
# season_type | character | Either REG or POST
# player_display_name | character | Full name of the player
# player_position | character | Position of the player 
accordinng to NGS
# team_abbr | character | Official team abbreveation
# player_gsis_id | character | Unique identifier of the player
# player_first_name | character | Player's first name
# player_last_name | character | Player's last name
# player_short_name | character | Short version of player's name
# season | numeric | The year of the NFL season. This 
reperesents the whole season, so regular season games that 
happen in January as well as playoff games will occur in the 
year after this number
# week | numeric | The week of the NFL season the game occurs 
in. Please note that the `game_type` will differ for weeks = 18 
because of the season expansion in 2021. Please use `game_type` 
to filter for regular season or postseason
# avg_time_to_throw | numeric | Average time elapsed from the 
time of snap to throw on every pass attempt for a passer (sacks 
excluded).
# avg_completed_air_yards | numeric | Average air yards on 
completed passes
# avg_intended_air_yards | numeric | Average air yards on all 
attempted passes
# avg_air_yards_differential | numeric | Air Yards Differential 
is calculated by subtracting the passer's average Intended Air 
Yards from his average Completed Air Yards. This stat indicates 
if he is on average attempting deep passes than he on average 
completes.
# aggressiveness | numeric | Aggressiveness tracks the amount 
of passing attempts a quarterback makes that are into tight 
coverage, where there is a defender within 1 yard or less of 
the receiver at the time of completion or incompletion. AGG is 
shown as a % of attempts into tight windows over all passing 
attempts.
# max_completed_air_distance | numeric | Air Distance is the 
amount of yards the ball has traveled on a pass, from the point 
of release to the point of reception (as the crow flies). 
Unlike Air Yards, Air Distance measures the actual distance the 
passer throws the ball.
# avg_air_yards_to_sticks | numeric | Air Yards to the Sticks 
shows the amount of Air Yards ahead or behind the first down 
marker on all attempts for a passer. The metric indicates if 
the passer is attempting his passes past the 1st down marker, 
or if he is relying on his skill position players to make yards 
after catch.
# attempts | numeric | The number of pass attempts
# pass_yards | numeric | Number of yards gained on pass plays
# pass_touchdowns | numeric | Number of touchdowns scored on 
pass plays
# interceptions | numeric | Number of interceptions thrown
# passer_rating | numeric | Overall NFL passer rating
# completions | numeric | Number of completed passes
# completion_percentage | numeric | Percentage of completed 
passes
# expected_completion_percentage | numeric | Using a passer's 
Completion Probability on every play, determine what a passer's 
completion percentage is expected to be.
# completion_percentage_above_expectation | numeric | A 
passer's actual completion percentage compared to their 
Expected Completion Percentage.
# avg_air_distance | numeric | A receiver's average depth of 
target
# max_air_distance | numeric | A receiver's maximum depth of 
target
# player_jersey_number | numeric | Player's jersey number
# avg_cushion | numeric | The distance (in yards) measured 
between a WR/TE and the defender they're lined up against at 
the time of snap on all targets.
# avg_separation | numeric | The distance (in yards) measured 
between a WR/TE and the nearest defender at the time of catch 
or incompletion.
# percent_share_of_intended_air_yards | numeric | The sum of 
the receivers total intended air yards (all attempts) over the 
sum of his team's total intended air yards. Represented as a 
percentage, this statistic represents how much of a team's deep 
yards does the player account for.
# receptions | numeric | The number of receptions for the 
receiver
# targets | numeric | The numnber of targets for the receiver
# catch_percentage | numeric | Percentage of caught passes 
relative to targets
# yards | numeric | The number of receiving yards
# rec_touchdowns | numeric | The number of touchdown receptions
# avg_yac | numeric | Average yards gained after catch by a 
receiver.
# avg_expected_yac | numeric | Average expected yards after 
catch, based on numerous factors using tracking data such as 
how open the receiver is, how fast they're traveling, how many 
defenders/blockers are in space, etc
# avg_yac_above_expectation | numeric | A receiver's YAC 
compared to their Expected YAC.
# efficiency | numeric | Rushing efficiency is calculated by 
taking the total distance a player traveled on rushing plays as 
a ball carrier according to Next Gen Stats (measured in yards) 
per rushing yards gained. The lower the number, the more of a 
North/South runner.
# percent_attempts_gte_eight_defenders | numeric | On every 
play, Next Gen Stats calculates how many defenders are stacked 
in the box at snap. Using that logic, DIB% calculates how often 
does a rusher see 8 or more defenders in the box against them.
# avg_time_to_los | numeric | Next Gen Stats measures the 
amount of time a ball carrier spends (measured to the 10th of a 
second) before crossing the Line of Scrimmage. TLOS is the 
average time behind the LOS on all rushing plays where the 
player is the rusher.
# rush_attempts | numeric | The number of rushing attempts
# rush_yards | numeric | The number of rushing yards gained
# expected_rush_yards | numeric | Expected rushing yards based 
on Nextgenstats' Big Data Bowl model
# rush_yards_over_expected | numeric | A rusher's rush yards 
gained compared to the expected rush yards
# avg_rush_yards | numeric | AVerage rush yards gained
# rush_yards_over_expected_per_att | numeric | Average rush 
yards above expectation
# rush_pct_over_expected | numeric | Rushing percentage above 
expectation
# rush_touchdowns | numeric | The number of scored rushing 
touchdowns

# dictionary_participation
# Field | Type | Description
# ----- | ---- | -----------
# nflverse_game_id | character | nflverse identifier for games. 
Format is season, week, away_team, home_team
# old_game_id | character | Legacy NFL game ID.
# play_id | integer | Numeric play id that when used with 
game_id and drive provides the unique identifier for a single 
play.
# possession_team | character | String abbreviation for the 
team with possession.
# offense_formation | character | Formation the offense lines 
up in to snap the ball.
# offense_personnel | character | Number of running backs, 
tight ends, and wide receivers on the field for the play. If 
there are more than the standard 5 offensive linemen and 1 
quarterback, they will be listed here as well.
# defenders_in_box | integer | Number of defensive players 
lined up in the box at the snap.
# defense_personnel | character | Number of defensive linemen, 
linebackers, and defensive backs on the field for the play.
# number_of_pass_rushers | integer | Number of defensive player 
who rushed the passer.
# players_on_play | character | A list of every player on the 
field for the play, by gsis_it_id
# offense_players | character | A list of every offensive 
player on the field for the play, by gsis_id
# defense_players | character | A list of every defensive 
player on the field for the play, by gsis_id
# n_offense | integer | Number of offensive players on the 
field for the play
# n_defense | integer | Number of defensive players on the 
field for the play
# ngs_air_yards | double | Distance (in yards) that the ball 
traveled in the air on a given passing play as tracked by NGS
# time_to_throw | double | Duration (in seconds) between the 
time of the ball being snapped and the time of release of a 
pass attempt
# was_pressure | logical | A boolean indicating whether or not 
the QB was pressured on a play
# defense_man_zone_type | character | A string indicating 
whether the defense was in man or zone coverage on a play
# defense_coverage_type | character | A string indicating what 
type of cover the defense was in on a play

# dictionary_pbp
# Field | Type | Description
# ----- | ---- | -----------
# play_id | numeric | Numeric play id that when used with 
game_id and drive provides the unique identifier for a single 
play.
# game_id | character | Ten digit identifier for NFL game.
# old_game_id | character | Legacy NFL game ID.
# home_team | character | String abbreviation for the home team.
# away_team | character | String abbreviation for the away team.
# season_type | character | 'REG' or 'POST' indicating if the 
game belongs to regular or post season.
# week | numeric | Season week.
# posteam | character | String abbreviation for the team with 
possession.
# posteam_type | character | String indicating whether the 
posteam team is home or away.
# defteam | character | String abbreviation for the team on 
defense.
# side_of_field | character | String abbreviation for which 
team's side of the field the team with possession is currently 
on.
# yardline_100 | numeric | Numeric distance in the number of 
yards from the opponent's endzone for the posteam.
# game_date | character | Date of the game.
# quarter_seconds_remaining | numeric | Numeric seconds 
remaining in the quarter.
# half_seconds_remaining | numeric | Numeric seconds remaining 
in the half.
# game_seconds_remaining | numeric | Numeric seconds remaining 
in the game.
# game_half | character | String indicating which half the play 
is in, either Half1, Half2, or Overtime.
# quarter_end | numeric | Binary indicator for whether or not 
the row of the data is marking the end of a quarter.
# drive | numeric | Numeric drive number in the game.
# sp | numeric | Binary indicator for whether or not a score 
occurred on the play.
# qtr | numeric | Quarter of the game (5 is overtime).
# down | numeric | The down for the given play.
# goal_to_go | numeric | Binary indicator for whether or not 
the posteam is in a goal down situation.
# time | character | Time at start of play provided in string 
format as minutes:seconds remaining in the quarter.
# yrdln | character | String indicating the current field 
position for a given play.
# ydstogo | numeric | Numeric yards in distance from either the 
first down marker or the endzone in goal down situations.
# ydsnet | numeric | Numeric value for total yards gained on 
the given drive.
# desc | character | Detailed string description for the given 
play.
# play_type | character | String indicating the type of play: 
pass (includes sacks), run (includes scrambles), punt, 
field_goal, kickoff, extra_point, qb_kneel, qb_spike, no_play 
(timeouts and penalties), and missing for rows indicating end 
of play.
# yards_gained | numeric | Numeric yards gained (or lost) by 
the possessing team, excluding yards gained via fumble 
recoveries and laterals.
# shotgun | numeric | Binary indicator for whether or not the 
play was in shotgun formation.
# no_huddle | numeric | Binary indicator for whether or not the 
play was in no_huddle formation.
# qb_dropback | numeric | Binary indicator for whether or not 
the QB dropped back on the play (pass attempt, sack, or 
scrambled).
# qb_kneel | numeric | Binary indicator for whether or not the 
QB took a knee.
# qb_spike | numeric | Binary indicator for whether or not the 
QB spiked the ball.
# qb_scramble | numeric | Binary indicator for whether or not 
the QB scrambled.
# pass_length | character | String indicator for pass length: 
short or deep.
# pass_location | character | String indicator for pass 
location: left, middle, or right.
# air_yards | numeric | Numeric value for distance in yards 
perpendicular to the line of scrimmage at where the targeted 
receiver either caught or didn't catch the ball.
# yards_after_catch | numeric | Numeric value for distance in 
yards perpendicular to the yard line where the receiver made 
the reception to where the play ended.
# run_location | character | String indicator for location of 
run: left, middle, or right.
# run_gap | character | String indicator for line gap of run: 
end, guard, or tackle
# field_goal_result | character | String indicator for result 
of field goal attempt: made, missed, or blocked.
# kick_distance | numeric | Numeric distance in yards for 
kickoffs, field goals, and punts.
# extra_point_result | character | String indicator for the 
result of the extra point attempt: good, failed, blocked, 
safety (touchback in defensive endzone is 1 point apparently), 
or aborted.
# two_point_conv_result | character | String indicator for 
result of two point conversion attempt: success, failure, 
safety (touchback in defensive endzone is 1 point apparently), 
or return.
# home_timeouts_remaining | numeric | Numeric timeouts 
remaining in the half for the home team.
# away_timeouts_remaining | numeric | Numeric timeouts 
remaining in the half for the away team.
# timeout | numeric | Binary indicator for whether or not a 
timeout was called by either team.
# timeout_team | character | String abbreviation for which team 
called the timeout.
# td_team | character | String abbreviation for which team 
scored the touchdown.
# td_player_name | character | String name of the player who 
scored a touchdown.
# td_player_id | character | Unique identifier of the player 
who scored a touchdown.
# posteam_timeouts_remaining | numeric | Number of timeouts 
remaining for the possession team.
# defteam_timeouts_remaining | numeric | Number of timeouts 
remaining for the team on defense.
# total_home_score | numeric | Score for the home team at the 
start of the play.
# total_away_score | numeric | Score for the away team at the 
start of the play.
# posteam_score | numeric | Score the posteam at the start of 
the play.
# defteam_score | numeric | Score the defteam at the start of 
the play.
# score_differential | numeric | Score differential between the 
posteam and defteam at the start of the play.
# posteam_score_post | numeric | Score for the posteam at the 
end of the play.
# defteam_score_post | numeric | Score for the defteam at the 
end of the play.
# score_differential_post | numeric | Score differential 
between the posteam and defteam at the end of the play.
# no_score_prob | numeric | Predicted probability of no score 
occurring for the rest of the half based on the expected points 
model.
# opp_fg_prob | numeric | Predicted probability of the defteam 
scoring a FG next. 'Next' in this context means the next score 
in the same game half.
# opp_safety_prob | numeric | Predicted probability of the 
defteam scoring a safety next. 'Next' in this context means the 
next score in the same game half.
# opp_td_prob | numeric | Predicted probability of the defteam 
scoring a TD next. 'Next' in this context means the next score 
in the same game half.
# fg_prob | numeric | Predicted probability of the posteam 
scoring a FG next. 'Next' in this context means the next score 
in the same game half.
# safety_prob | numeric | Predicted probability of the posteam 
scoring a safety next. 'Next' in this context means the next 
score in the same game half.
# td_prob | numeric | Predicted probability of the posteam 
scoring a TD next. 'Next' in this context means the next score 
in the same game half.
# extra_point_prob | numeric | Predicted probability of the 
posteam scoring an extra point.
# two_point_conversion_prob | numeric | Predicted probability 
of the posteam scoring the two point conversion.
# ep | numeric | Using the scoring event probabilities, the 
estimated expected points with respect to the possession team 
for the given play.
# epa | numeric | Expected points added (EPA) by the posteam 
for the given play.
# total_home_epa | numeric | Cumulative total EPA for the home 
team in the game so far.
# total_away_epa | numeric | Cumulative total EPA for the away 
team in the game so far.
# total_home_rush_epa | numeric | Cumulative total rushing EPA 
for the home team in the game so far.
# total_away_rush_epa | numeric | Cumulative total rushing EPA 
for the away team in the game so far.
# total_home_pass_epa | numeric | Cumulative total passing EPA 
for the home team in the game so far.
# total_away_pass_epa | numeric | Cumulative total passing EPA 
for the away team in the game so far.
# air_epa | numeric | EPA from the air yards alone. For 
completions this represents the actual value provided through 
the air. For incompletions this represents the hypothetical 
value that could've been added through the air if the pass was 
completed.
# yac_epa | numeric | EPA from the yards after catch alone. For 
completions this represents the actual value provided after the 
catch. For incompletions this represents the difference between 
the hypothetical air_epa and the play's raw observed EPA (how 
much the incomplete pass cost the posteam).
# comp_air_epa | numeric | EPA from the air yards alone only 
for completions.
# comp_yac_epa | numeric | EPA from the yards after catch alone 
only for completions.
# total_home_comp_air_epa | numeric | Cumulative total 
completions air EPA for the home team in the game so far.
# total_away_comp_air_epa | numeric | Cumulative total 
completions air EPA for the away team in the game so far.
# total_home_comp_yac_epa | numeric | Cumulative total 
completions yac EPA for the home team in the game so far.
# total_away_comp_yac_epa | numeric | Cumulative total 
completions yac EPA for the away team in the game so far.
# total_home_raw_air_epa | numeric | Cumulative total raw air 
EPA for the home team in the game so far.
# total_away_raw_air_epa | numeric | Cumulative total raw air 
EPA for the away team in the game so far.
# total_home_raw_yac_epa | numeric | Cumulative total raw yac 
EPA for the home team in the game so far.
# total_away_raw_yac_epa | numeric | Cumulative total raw yac 
EPA for the away team in the game so far.
# wp | numeric | Estimated win probabiity for the posteam given 
the current situation at the start of the given play.
# def_wp | numeric | Estimated win probability for the defteam.
# home_wp | numeric | Estimated win probability for the home 
team.
# away_wp | numeric | Estimated win probability for the away 
team.
# wpa | numeric | Win probability added (WPA) for the posteam.
# vegas_wpa | numeric | Win probability added (WPA) for the 
posteam: spread_adjusted model.
# vegas_home_wpa | numeric | Win probability added (WPA) for 
the home team: spread_adjusted model.
# home_wp_post | numeric | Estimated win probability for the 
home team at the end of the play.
# away_wp_post | numeric | Estimated win probability for the 
away team at the end of the play.
# vegas_wp | numeric | Estimated win probabiity for the posteam 
given the current situation at the start of the given play, 
incorporating pre-game Vegas line.
# vegas_home_wp | numeric | Estimated win probability for the 
home team incorporating pre-game Vegas line.
# total_home_rush_wpa | numeric | Cumulative total rushing WPA 
for the home team in the game so far.
# total_away_rush_wpa | numeric | Cumulative total rushing WPA 
for the away team in the game so far.
# total_home_pass_wpa | numeric | Cumulative total passing WPA 
for the home team in the game so far.
# total_away_pass_wpa | numeric | Cumulative total passing WPA 
for the away team in the game so far.
# air_wpa | numeric | WPA through the air (same logic as 
air_epa).
# yac_wpa | numeric | WPA from yards after the catch (same 
logic as yac_epa).
# comp_air_wpa | numeric | The air_wpa for completions only.
# comp_yac_wpa | numeric | The yac_wpa for completions only.
# total_home_comp_air_wpa | numeric | Cumulative total 
completions air WPA for the home team in the game so far.
# total_away_comp_air_wpa | numeric | Cumulative total 
completions air WPA for the away team in the game so far.
# total_home_comp_yac_wpa | numeric | Cumulative total 
completions yac WPA for the home team in the game so far.
# total_away_comp_yac_wpa | numeric | Cumulative total 
completions yac WPA for the away team in the game so far.
# total_home_raw_air_wpa | numeric | Cumulative total raw air 
WPA for the home team in the game so far.
# total_away_raw_air_wpa | numeric | Cumulative total raw air 
WPA for the away team in the game so far.
# total_home_raw_yac_wpa | numeric | Cumulative total raw yac 
WPA for the home team in the game so far.
# total_away_raw_yac_wpa | numeric | Cumulative total raw yac 
WPA for the away team in the game so far.
# punt_blocked | numeric | Binary indicator for if the punt was 
blocked.
# first_down_rush | numeric | Binary indicator for if a running 
play converted the first down.
# first_down_pass | numeric | Binary indicator for if a passing 
play converted the first down.
# first_down_penalty | numeric | Binary indicator for if a 
penalty converted the first down.
# third_down_converted | numeric | Binary indicator for if the 
first down was converted on third down.
# third_down_failed | numeric | Binary indicator for if the 
posteam failed to convert first down on third down.
# fourth_down_converted | numeric | Binary indicator for if the 
first down was converted on fourth down.
# fourth_down_failed | numeric | Binary indicator for if the 
posteam failed to convert first down on fourth down.
# incomplete_pass | numeric | Binary indicator for if the pass 
was incomplete.
# touchback | numeric | Binary indicator for if a touchback 
occurred on the play.
# interception | numeric | Binary indicator for if the pass was 
intercepted.
# punt_inside_twenty | numeric | Binary indicator for if the 
punt ended inside the twenty yard line.
# punt_in_endzone | numeric | Binary indicator for if the punt 
was in the endzone.
# punt_out_of_bounds | numeric | Binary indicator for if the 
punt went out of bounds.
# punt_downed | numeric | Binary indicator for if the punt was 
downed.
# punt_fair_catch | numeric | Binary indicator for if the punt 
was caught with a fair catch.
# kickoff_inside_twenty | numeric | Binary indicator for if the 
kickoff ended inside the twenty yard line.
# kickoff_in_endzone | numeric | Binary indicator for if the 
kickoff was in the endzone.
# kickoff_out_of_bounds | numeric | Binary indicator for if the 
kickoff went out of bounds.
# kickoff_downed | numeric | Binary indicator for if the 
kickoff was downed.
# kickoff_fair_catch | numeric | Binary indicator for if the 
kickoff was caught with a fair catch.
# fumble_forced | numeric | Binary indicator for if the fumble 
was forced.
# fumble_not_forced | numeric | Binary indicator for if the 
fumble was not forced.
# fumble_out_of_bounds | numeric | Binary indicator for if the 
fumble went out of bounds.
# solo_tackle | numeric | Binary indicator if the play had a 
solo tackle (could be multiple due to fumbles).
# safety | numeric | Binary indicator for whether or not a 
safety occurred.
# penalty | numeric | Binary indicator for whether or not a 
penalty occurred.
# tackled_for_loss | numeric | Binary indicator for whether or 
not a tackle for loss on a run play occurred.
# fumble_lost | numeric | Binary indicator for if the fumble 
was lost.
# own_kickoff_recovery | numeric | Binary indicator for if the 
kicking team recovered the kickoff.
# own_kickoff_recovery_td | numeric | Binary indicator for if 
the kicking team recovered the kickoff and scored a TD.
# qb_hit | numeric | Binary indicator if the QB was hit on the 
play.
# rush_attempt | numeric | Binary indicator for if the play was 
a run.
# pass_attempt | numeric | Binary indicator for if the play was 
a pass attempt (includes sacks).
# sack | numeric | Binary indicator for if the play ended in a 
sack.
# touchdown | numeric | Binary indicator for if the play 
resulted in a TD.
# pass_touchdown | numeric | Binary indicator for if the play 
resulted in a passing TD.
# rush_touchdown | numeric | Binary indicator for if the play 
resulted in a rushing TD.
# return_touchdown | numeric | Binary indicator for if the play 
resulted in a return TD. Returns may occur on any of: 
interception, fumble, kickoff, punt, or blocked kicks.
# extra_point_attempt | numeric | Binary indicator for extra 
point attempt.
# two_point_attempt | numeric | Binary indicator for two point 
conversion attempt.
# field_goal_attempt | numeric | Binary indicator for field 
goal attempt.
# kickoff_attempt | numeric | Binary indicator for kickoff.
# punt_attempt | numeric | Binary indicator for punts.
# fumble | numeric | Binary indicator for if a fumble occurred.
# complete_pass | numeric | Binary indicator for if the pass 
was completed.
# assist_tackle | numeric | Binary indicator for if an assist 
tackle occurred.
# lateral_reception | numeric | Binary indicator for if a 
lateral occurred on the reception.
# lateral_rush | numeric | Binary indicator for if a lateral 
occurred on a run.
# lateral_return | numeric | Binary indicator for if a lateral 
occurred on a return. Returns may occur on any of: 
interception, fumble, kickoff, punt, or blocked kicks.
# lateral_recovery | numeric | Binary indicator for if a 
lateral occurred on a fumble recovery.
# passer_player_id | character | Unique identifier for the 
player that attempted the pass.
# passer_player_name | character | String name for the player 
that attempted the pass.
# passing_yards | numeric | Numeric yards by the 
passer_player_name, including yards gained in pass plays with 
laterals. This should equal official passing statistics.
# receiver_player_id | character | Unique identifier for the 
receiver that was targeted on the pass.
# receiver_player_name | character | String name for the 
targeted receiver.
# receiving_yards | numeric | Numeric yards by the 
receiver_player_name, excluding yards gained in pass plays with 
laterals. This should equal official receiving statistics but 
could miss yards gained in pass plays with laterals. Please see 
the description of `lateral_receiver_player_name` for further 
information.
# rusher_player_id | character | Unique identifier for the 
player that attempted the run.
# rusher_player_name | character | String name for the player 
that attempted the run.
# rushing_yards | numeric | Numeric yards by the 
rusher_player_name, excluding yards gained in rush plays with 
laterals. This should equal official rushing statistics but 
could miss yards gained in rush plays with laterals. Please see 
the description of `lateral_rusher_player_name` for further 
information.
# lateral_receiver_player_id | character | Unique identifier 
for the player that received the last(!) lateral on a pass play.
# lateral_receiver_player_name | character | String name for 
the player that received the last(!) lateral on a pass play. If 
there were multiple laterals in the same play, this will only 
be the last player who received a lateral. Please see <https://
github.com/mrcaseb/nfl-data/tree/master/data/lateral_yards> for 
a list of plays where multiple players recorded lateral 
receiving yards.
# lateral_receiving_yards | numeric | Numeric yards by the 
`lateral_receiver_player_name` in pass plays with laterals. 
Please see the description of `lateral_receiver_player_name` 
for further information.
# lateral_rusher_player_id | character | Unique identifier for 
the player that received the last(!) lateral on a run play.
# lateral_rusher_player_name | character | String name for the 
player that received the last(!) lateral on a run play. If 
there were multiple laterals in the same play, this will only 
be the last player who received a lateral. Please see <https://
github.com/mrcaseb/nfl-data/tree/master/data/lateral_yards> for 
a list of plays where multiple players recorded lateral rushing 
yards.
# lateral_rushing_yards | numeric | Numeric yards by the 
`lateral_rusher_player_name` in run plays with laterals. Please 
see the description of `lateral_rusher_player_name` for further 
information.
# lateral_sack_player_id | character | Unique identifier for 
the player that received the lateral on a sack.
# lateral_sack_player_name | character | String name for the 
player that received the lateral on a sack.
# interception_player_id | character | Unique identifier for 
the player that intercepted the pass.
# interception_player_name | character | String name for the 
player that intercepted the pass.
# lateral_interception_player_id | character | Unique 
indentifier for the player that received the lateral on an 
interception.
# lateral_interception_player_name | character | String name 
for the player that received the lateral on an interception.
# punt_returner_player_id | character | Unique identifier for 
the punt returner.
# punt_returner_player_name | character | String name for the 
punt returner.
# lateral_punt_returner_player_id | character | Unique 
identifier for the player that received the lateral on a punt 
return.
# lateral_punt_returner_player_name | character | String name 
for the player that received the lateral on a punt return.
# kickoff_returner_player_name | character | String name for 
the kickoff returner.
# kickoff_returner_player_id | character | Unique identifier 
for the kickoff returner.
# lateral_kickoff_returner_player_id | character | Unique 
identifier for the player that received the lateral on a 
kickoff return.
# lateral_kickoff_returner_player_name | character | String 
name for the player that received the lateral on a kickoff 
return.
# punter_player_id | character | Unique identifier for the 
punter.
# punter_player_name | character | String name for the punter.
# kicker_player_name | character | String name for the kicker 
on FG or kickoff.
# kicker_player_id | character | Unique identifier for the 
kicker on FG or kickoff.
# own_kickoff_recovery_player_id | character | Unique 
identifier for the player that recovered their own kickoff.
# own_kickoff_recovery_player_name | character | String name 
for the player that recovered their own kickoff.
# blocked_player_id | character | Unique identifier for the 
player that blocked the punt or FG.
# blocked_player_name | character | String name for the player 
that blocked the punt or FG.
# tackle_for_loss_1_player_id | character | Unique identifier 
for one of the potential players with the tackle for loss.
# tackle_for_loss_1_player_name | character | String name for 
one of the potential players with the tackle for loss.
# tackle_for_loss_2_player_id | character | Unique identifier 
for one of the potential players with the tackle for loss.
# tackle_for_loss_2_player_name | character | String name for 
one of the potential players with the tackle for loss.
# qb_hit_1_player_id | character | Unique identifier for one of 
the potential players that hit the QB. No sack as the QB was 
not the ball carrier. For sacks please see `sack_player` or 
`half_sack_*_player`.
# qb_hit_1_player_name | character | String name for one of the 
potential players that hit the QB. No sack as the QB was not 
the ball carrier. For sacks please see `sack_player` or 
`half_sack_*_player`.
# qb_hit_2_player_id | character | Unique identifier for one of 
the potential players that hit the QB. No sack as the QB was 
not the ball carrier. For sacks please see `sack_player` or 
`half_sack_*_player`.
# qb_hit_2_player_name | character | String name for one of the 
potential players that hit the QB. No sack as the QB was not 
the ball carrier. For sacks please see `sack_player` or 
`half_sack_*_player`.
# forced_fumble_player_1_team | character | Team of one of the 
players with a forced fumble.
# forced_fumble_player_1_player_id | character | Unique 
identifier of one of the players with a forced fumble.
# forced_fumble_player_1_player_name | character | String name 
of one of the players with a forced fumble.
# forced_fumble_player_2_team | character | Team of one of the 
players with a forced fumble.
# forced_fumble_player_2_player_id | character | Unique 
identifier of one of the players with a forced fumble.
# forced_fumble_player_2_player_name | character | String name 
of one of the players with a forced fumble.
# solo_tackle_1_team | character | Team of one of the players 
with a solo tackle.
# solo_tackle_2_team | character | Team of one of the players 
with a solo tackle.
# solo_tackle_1_player_id | character | Unique identifier of 
one of the players with a solo tackle.
# solo_tackle_2_player_id | character | Unique identifier of 
one of the players with a solo tackle.
# solo_tackle_1_player_name | character | String name of one of 
the players with a solo tackle.
# solo_tackle_2_player_name | character | String name of one of 
the players with a solo tackle.
# assist_tackle_1_player_id | character | Unique identifier of 
one of the players with a tackle assist.
# assist_tackle_1_player_name | character | String name of one 
of the players with a tackle assist.
# assist_tackle_1_team | character | Team of one of the players 
with a tackle assist.
# assist_tackle_2_player_id | character | Unique identifier of 
one of the players with a tackle assist.
# assist_tackle_2_player_name | character | String name of one 
of the players with a tackle assist.
# assist_tackle_2_team | character | Team of one of the players 
with a tackle assist.
# assist_tackle_3_player_id | character | Unique identifier of 
one of the players with a tackle assist.
# assist_tackle_3_player_name | character | String name of one 
of the players with a tackle assist.
# assist_tackle_3_team | character | Team of one of the players 
with a tackle assist.
# assist_tackle_4_player_id | character | Unique identifier of 
one of the players with a tackle assist.
# assist_tackle_4_player_name | character | String name of one 
of the players with a tackle assist.
# assist_tackle_4_team | character | Team of one of the players 
with a tackle assist.
# tackle_with_assist | numeric | Binary indicator for if there 
has been a tackle with assist.
# tackle_with_assist_1_player_id | character | Unique 
identifier of one of the players with a tackle with assist.
# tackle_with_assist_1_player_name | character | String name of 
one of the players with a tackle with assist.
# tackle_with_assist_1_team | character | Team of one of the 
players with a tackle with assist.
# tackle_with_assist_2_player_id | character | Unique 
identifier of one of the players with a tackle with assist.
# tackle_with_assist_2_player_name | character | String name of 
one of the players with a tackle with assist.
# tackle_with_assist_2_team | character | Team of one of the 
players with a tackle with assist.
# pass_defense_1_player_id | character | Unique identifier of 
one of the players with a pass defense.
# pass_defense_1_player_name | character | String name of one 
of the players with a pass defense.
# pass_defense_2_player_id | character | Unique identifier of 
one of the players with a pass defense.
# pass_defense_2_player_name | character | String name of one 
of the players with a pass defense.
# fumbled_1_team | character | Team of one of the first player 
with a fumble.
# fumbled_1_player_id | character | Unique identifier of the 
first player who fumbled on the play.
# fumbled_1_player_name | character | String name of one of the 
first player who fumbled on the play.
# fumbled_2_player_id | character | Unique identifier of the 
second player who fumbled on the play.
# fumbled_2_player_name | character | String name of one of the 
second player who fumbled on the play.
# fumbled_2_team | character | Team of one of the second player 
with a fumble.
# fumble_recovery_1_team | character | Team of one of the 
players with a fumble recovery.
# fumble_recovery_1_yards | numeric | Yards gained by one of 
the players with a fumble recovery.
# fumble_recovery_1_player_id | character | Unique identifier 
of one of the players with a fumble recovery.
# fumble_recovery_1_player_name | character | String name of 
one of the players with a fumble recovery.
# fumble_recovery_2_team | character | Team of one of the 
players with a fumble recovery.
# fumble_recovery_2_yards | numeric | Yards gained by one of 
the players with a fumble recovery.
# fumble_recovery_2_player_id | character | Unique identifier 
of one of the players with a fumble recovery.
# fumble_recovery_2_player_name | character | String name of 
one of the players with a fumble recovery.
# sack_player_id | character | Unique identifier of the player 
who recorded a solo sack.
# sack_player_name | character | String name of the player who 
recorded a solo sack.
# half_sack_1_player_id | character | Unique identifier of the 
first player who recorded half a sack.
# half_sack_1_player_name | character | String name of the 
first player who recorded half a sack.
# half_sack_2_player_id | character | Unique identifier of the 
second player who recorded half a sack.
# half_sack_2_player_name | character | String name of the 
second player who recorded half a sack.
# return_team | character | String abbreviation of the return 
team. Returns may occur on any of: interception, fumble, 
kickoff, punt, or blocked kicks.
# return_yards | numeric | Yards gained by the return team. 
Returns may occur on any of: interception, fumble, kickoff, 
punt, or blocked kicks.
# penalty_team | character | String abbreviation of the team 
with the penalty.
# penalty_player_id | character | Unique identifier for the 
player with the penalty.
# penalty_player_name | character | String name for the player 
with the penalty.
# penalty_yards | numeric | Yards gained (or lost) by the 
posteam from the penalty.
# replay_or_challenge | numeric | Binary indicator for whether 
or not a replay or challenge.
# replay_or_challenge_result | character | String indicating 
the result of the replay or challenge.
# penalty_type | character | String indicating the penalty type 
of the first penalty in the given play. Will be `NA` if `desc` 
is missing the type.
# defensive_two_point_attempt | numeric | Binary indicator 
whether or not the defense was able to have an attempt on a two 
point conversion, this results following a turnover.
# defensive_two_point_conv | numeric | Binary indicator whether 
or not the defense successfully scored on the two point 
conversion.
# defensive_extra_point_attempt | numeric | Binary indicator 
whether or not the defense was able to have an attempt on an 
extra point attempt, this results following a blocked attempt 
that the defense recovers the ball.
# defensive_extra_point_conv | numeric | Binary indicator 
whether or not the defense successfully scored on an extra 
point attempt.
# safety_player_name | character | String name for the player 
who scored a safety.
# safety_player_id | character | Unique identifier for the 
player who scored a safety.
# season | numeric | 4 digit number indicating to which season 
the game belongs to.
# cp | numeric | Numeric value indicating the probability for a 
complete pass based on comparable game situations.
# cpoe | numeric | For a single pass play this is 1 - cp when 
the pass was completed or 0 - cp when the pass was incomplete. 
Analyzed for a whole game or season an indicator for the passer 
how much over or under expectation his completion percentage 
was.
# series | numeric | Starts at 1, each new first down 
increments, numbers shared across both teams NA: kickoffs, 
extra point/two point conversion attempts, non-plays, no posteam
# series_success | numeric | 1: scored touchdown, gained enough 
yards for first down.
# series_result | character | Possible values: First down, 
Touchdown, Opp touchdown, Field goal, Missed field goal, 
Safety, Turnover, Punt, Turnover on downs, QB kneel, End of half
# order_sequence | numeric | Column provided by NFL to fix 
out-of-order plays. Available 2011 and beyond with source "nfl".
# start_time | character | Kickoff time in eastern time zone.
# time_of_day | character | Time of day of play in UTC 
"HH:MM:SS" format. Available 2011 and beyond with source "nfl".
# stadium | character | Game site name.
# weather | character | String describing the weather including 
temperature, humidity and wind (direction and speed). Doesn't 
change during the game!
# nfl_api_id | character | UUID of the game in the new NFL API.
# play_clock | character | Time on the playclock when the ball 
was snapped.
# play_deleted | numeric | Binary indicator for deleted plays.
# play_type_nfl | character | Play type as listed in the NFL 
source. Slightly different to the regular play_type variable.
# special_teams_play | numeric | Binary indicator for whether 
play is special teams play from NFL source. Available 2011 and 
beyond with source "nfl".
# st_play_type | character | Type of special teams play from 
NFL source. Available 2011 and beyond with source "nfl".
# end_clock_time | character | Game time at the end of a given 
play.
# end_yard_line | character | String indicating the yardline at 
the end of the given play consisting of team half and yard line 
number.
# fixed_drive | numeric | Manually created drive number in a 
game.
# fixed_drive_result | character | Manually created drive 
result.
# drive_real_start_time | character | Local day time when the 
drive started (currently not used by the NFL and therefore 
mostly 'NA').
# drive_play_count | numeric | Numeric value of how many 
regular plays happened in a given drive.
# drive_time_of_possession | character | Time of possession in 
a given drive.
# drive_first_downs | numeric | Number of forst downs in a 
given drive.
# drive_inside20 | numeric | Binary indicator if the offense 
was able to get inside the opponents 20 yard line.
# drive_ended_with_score | numeric | Binary indicator the drive 
ended with a score.
# drive_quarter_start | numeric | Numeric value indicating in 
which quarter the given drive has started.
# drive_quarter_end | numeric | Numeric value indicating in 
which quarter the given drive has ended.
# drive_yards_penalized | numeric | Numeric value of how many 
yards the offense gained or lost through penalties in the given 
drive.
# drive_start_transition | character | String indicating how 
the offense got the ball.
# drive_end_transition | character | String indicating how the 
offense lost the ball.
# drive_game_clock_start | character | Game time at the 
beginning of a given drive.
# drive_game_clock_end | character | Game time at the end of a 
given drive.
# drive_start_yard_line | character | String indicating where a 
given drive started consisting of team half and yard line 
number.
# drive_end_yard_line | character | String indicating where a 
given drive ended consisting of team half and yard line number.
# drive_play_id_started | numeric | Play_id of the first play 
in the given drive.
# drive_play_id_ended | numeric | Play_id of the last play in 
the given drive.
# away_score | numeric | Total points scored by the away team.
# home_score | numeric | Total points scored by the home team.
# location | character | Either 'Home' o 'Neutral' indicating 
if the home team played at home or at a neutral site.
# result | numeric | Equals home_score - away_score and means 
the game outcome from the perspective of the home team.
# total | numeric | Equals home_score + away_score and means 
the total points scored in the given game.
# spread_line | numeric | The closing spread line for the game. 
A positive number means the home team was favored by that many 
points, a negative number means the away team was favored by 
that many points. (Source: Pro-Football-Reference)
# total_line | numeric | The closing total line for the game. 
(Source: Pro-Football-Reference)
# div_game | numeric | Binary indicator for if the given game 
was a division game.
# roof | character | One of 'dome', 'outdoors', 'closed', 
'open' indicating indicating the roof status of the stadium the 
game was played in. (Source: Pro-Football-Reference)
# surface | character | What type of ground the game was played 
on. (Source: Pro-Football-Reference)
# temp | numeric | The temperature at the stadium only for 
'roof' = 'outdoors' or 'open'.(Source: Pro-Football-Reference)
# wind | numeric | The speed of the wind in miles/hour only for 
'roof' = 'outdoors' or 'open'. (Source: Pro-Football-Reference)
# home_coach | character | First and last name of the home team 
coach. (Source: Pro-Football-Reference)
# away_coach | character | First and last name of the away team 
coach. (Source: Pro-Football-Reference)
# stadium_id | character | ID of the stadium the game was 
played in. (Source: Pro-Football-Reference)
# game_stadium | character | Name of the stadium the game was 
played in. (Source: Pro-Football-Reference)
# success | numeric | Binary indicator wheter epa > 0 in the 
given play.
# passer | character | Name of the dropback player (scrambles 
included) including plays with penalties.
# passer_jersey_number | numeric | Jersey number of the passer.
# rusher | character | Name of the rusher (no scrambles) 
including plays with penalties.
# rusher_jersey_number | numeric | Jersey number of the rusher.
# receiver | character | Name of the receiver including plays 
with penalties.
# receiver_jersey_number | numeric | Jersey number of the 
receiver.
# pass | numeric | Binary indicator if the play was a pass play 
(sacks and scrambles included).
# rush | numeric | Binary indicator if the play was a rushing 
play.
# first_down | numeric | Binary indicator if the play ended in 
a first down.
# aborted_play | numeric | Binary indicator if the play 
description indicates "Aborted".
# special | numeric | Binary indicator if "play_type" is one of 
"extra_point", "field_goal", "kickoff", or "punt".
# play | numeric | Binary indicator: 1 if the play was a 
'normal' play (including penalties), 0 otherwise.
# passer_id | character | ID of the player in the 'passer' 
column.
# rusher_id | character | ID of the player in the 'rusher' 
column.
# receiver_id | character | ID of the player in the 'receiver' 
column.
# name | character | Name of the 'passer' if it is not 'NA', or 
name of the 'rusher' otherwise.
# jersey_number | numeric | Jersey number of the player listed 
in the 'name' column.
# id | character | ID of the player in the 'name' column.
# fantasy_player_name | character | Name of the rusher on rush 
plays or receiver on pass plays (from official stats).
# fantasy_player_id | character | ID of the rusher on rush 
plays or receiver on pass plays (from official stats).
# fantasy | character | Name of the rusher on rush plays or 
receiver on pass plays.
# fantasy_id | character | ID of the rusher on rush plays or 
receiver on pass plays.
# out_of_bounds | numeric | 1 if play description contains ran 
ob, pushed ob, or sacked ob; 0 otherwise.
# home_opening_kickoff | numeric | 1 if the home team received 
the opening kickoff, 0 otherwise.
# qb_epa | numeric | Gives QB credit for EPA for up to the 
point where a receiver lost a fumble after a completed catch 
and makes EPA work more like passing yards on plays with 
fumbles.
# xyac_epa | numeric | Expected value of EPA gained after the 
catch, starting from where the catch was made. Zero yards after 
the catch would be listed as zero EPA.
# xyac_mean_yardage | numeric | Average expected yards after 
the catch based on where the ball was caught.
# xyac_median_yardage | numeric | Median expected yards after 
the catch based on where the ball was caught.
# xyac_success | numeric | Probability play earns positive EPA 
(relative to where play started) based on where ball was caught.
# xyac_fd | numeric | Probability play earns a first down based 
on where the ball was caught.
# xpass | numeric | Probability of dropback scaled from 0 to 1.
# pass_oe | numeric | Dropback percent over expected on a given 
play scaled from 0 to 100.

# dictionary_pfr_passing
# Field | Type | Description
# ----- | ---- | -----------
# player | character | Player name
# NOTE: PFR Advanced Stats fields are documented in the DATA 
SOURCE SELECTION RULES section below
# The actual field names in load_pfr_advstats() are: 
passing_drop_pct, passing_drops, times_pressured, etc.

# dictionary_pfr_advstats (PASSING)
# Field | Type | Description
# ----- | ---- | -----------
# game_id | character | nflfastR game ID
# pfr_game_id | character | PFR game ID  
# season | numeric | Season
# week | numeric | Week of season
# game_type | character | Type of game (REG/POST)
# team | character | Player's team
# opponent | character | Opposing team
# pfr_player_name | character | Player name from PFR
# pfr_player_id | character | PFR player ID
# passing_drops | numeric | Number of drops by receivers on 
player's passes
# passing_drop_pct | numeric | Percentage of passes dropped by 
receivers
# receiving_drop | numeric | Number of drops by this player 
when receiving
# receiving_drop_pct | numeric | Percentage of passes dropped 
by this player when receiving
# passing_bad_throws | numeric | Number of bad throws by player
# passing_bad_throw_pct | numeric | Percentage of throws that 
were bad
# times_sacked | numeric | Number of times sacked
# times_blitzed | numeric | Number of times defense blitzed
# times_hurried | numeric | Number of times hurried
# times_hit | numeric | Number of times hit
# times_pressured | numeric | Number of times pressured
# times_pressured_pct | numeric | Percentage of dropbacks 
pressured
# def_times_blitzed | numeric | Number of times defense blitzed 
(defensive stat)
# def_times_hurried | numeric | Number of times defense hurried 
QB (defensive stat)
# def_times_hitqb | numeric | Number of times defense hit QB 
(defensive stat)

# dictionary_player_stats
# Field | Type | Description
# ----- | ---- | -----------
# player_id |  | ID of the player. Use this to join to other 
sources.
# player_name |  | Name of the player
# recent_team |  | Most recent team player appears in `pbp` 
with.
# season |  | Official NFL season
# week |  | Game week number
# season_type |  | `REG` for regular season, `POST` for 
postseason
# completions |  | The number of completed passes.
# attempts |  | The number of pass attempts as defined by the 
NFL.
# passing_yards |  | Yards gained on pass plays.
# passing_tds |  | The number of passing touchdowns.
# interceptions |  | The number of interceptions thrown.
# sacks |  | The Number of times sacked.
# sack_yards |  | Yards lost on sack plays.
# sack_fumbles |  | The number of sacks with a fumble.
# sack_fumbles_lost |  | The number of sacks with a lost fumble.
# passing_air_yards |  | Passing air yards (includes incomplete 
passes).
# passing_yards_after_catch |  | Yards after the catch gained 
on plays in which player was the passer (this is an unofficial 
stat and may differ slightly between different sources).
# passing_first_downs |  | First downs on pass attempts.
# passing_epa |  | Total expected points added on pass attempts 
and sacks. NOTE: this uses the variable `qb_epa`, which gives 
QB credit for EPA for up to the point where a receiver lost a 
fumble after a completed catch and makes EPA work more like 
passing yards on plays with fumbles.
# passing_2pt_conversions |  | Two-point conversion passes.
# dakota |  | Adjusted EPA + CPOE composite based on 
coefficients which best predict adjusted EPA/play in the 
following year.
# carries |  | The number of official rush attempts (incl. 
scrambles and kneel downs). Rushes after a lateral reception 
don't count as carry.
# rushing_yards |  | Yards gained when rushing with the ball 
(incl. scrambles and kneel downs). Also includes yards gained 
after obtaining a lateral on a play that started with a rushing 
attempt.
# rushing_tds |  | The number of rushing touchdowns (incl. 
scrambles). Also includes touchdowns after obtaining a lateral 
on a play that started with a rushing attempt.
# rushing_fumbles |  | The number of rushes with a fumble.
# rushing_fumbles_lost |  | The number of rushes with a lost 
fumble.
# rushing_first_downs |  | First downs on rush attempts (incl. 
scrambles).
# rushing_epa |  | Expected points added on rush attempts 
(incl. scrambles and kneel downs).
# rushing_2pt_conversions |  | Two-point conversion rushes
# receptions |  | The number of pass receptions. Lateral 
receptions officially don't count as reception.
# targets |  | The number of pass plays where the player was 
the targeted receiver.
# receiving_yards |  | Yards gained after a pass reception. 
Includes yards gained after receiving a lateral on a play that 
started as a pass play.
# receiving_tds |  | The number of touchdowns following a pass 
reception. Also includes touchdowns after receiving a lateral 
on a play that started as a pass play.
# receiving_air_yards |  | Receiving air yards (incl. 
incomplete passes).
# receiving_yards_after_catch |  | Yards after the catch gained 
on plays in which player was receiver (this is an unofficial 
stat and may differ slightly between different sources).
# receiving_fumbles |  | The number of fumbles after a pass 
reception.
# receiving_fumbles_lost |  | The number of fumbles lost after 
a pass reception.
# receiving_2pt_conversions |  | Two-point conversion receptions
# fantasy_points |  | Standard fantasy points.
# fantasy_points_ppr |  | PPR fantasy points.
# air_yards_share |  | Player's share of the team's air yards 
in this game
# pacr |  | Passing (yards) Air (yards) Conversion Ratio - the 
number of passing yards per air yards thrown per game
# racr |  | Receiving (yards) Air (yards) Conversion Ratio - 
the number of receiving yards per air yards targeted per game
# receiving_epa |  | Total EPA on plays where this receiver was 
targeted
# receiving_first_downs |  | Total number of first downs gained 
on receptions
# special_teams_tds |  | Total number of kick/punt return 
touchdowns
# wopr |  | Weighted OPportunity Rating - 1.5 x target_share + 
0.7 x air_yards_share - a weighted average that contextualizes 
total fantasy usage.
# target_share |  | Player's share of team receiving targets in 
this game

# dictionary_player_stats_def
# Field | Type | Description
# ----- | ---- | -----------
# def_tackles | numeric | Total number of tackles for this 
player
# def_tackles_solo | numeric | Total number of solo tackles for 
this player
# def_tackles_with_assist | numeric | Number of tackles this 
player had with an assisted tackle
# def_tackle_assists | numeric | Number of assisted tackles for 
this player
# def_tackles_for_loss | numeric | Number of tackles for loss 
(TFL) for this player
# def_tackles_for_loss_yards | numeric | Yards lost from TFLs 
involving this player
# def_fumbles_forced | numeric | Number of times a fumble was 
forced from this player
# def_sacks | numeric | Number of sacks form this player
# def_sack_yards | numeric | Yards lost from sacks forced by 
this player
# def_qb_hits | numeric | Number of QB hits from this player 
(should not include plays where the QB was sacked)
# def_interceptions | numeric | Number of interceptions forced 
by this player
# def_interception_yards | numeric | yards gained/lost by 
interception returns from this player
# def_pass_defended | numeric | Number of passes defended/
broken up by this player
# def_tds | numeric | Number of defensive touchdowns scored by 
this player
# def_fumbles | numeric | Number of fumbles by this player
# def_fumble_recovery_own | numeric | Number of times a 
player's team fumbled the ball and this player recovered
# def_fumble_recovery_yards_own | numeric | Number of yards 
gained/lost from fumble recoveries that happened because the 
player's team fumbled the ball and this player recovered the 
fumble on that same play
# def_fumble_recovery_opp | numeric | Number of times a 
player's opponent fumbled the ball and this player recovered
# def_fumble_recovery_yards_opp | numeric | Number of yards 
gained/lost from fumble recoveries that happened because the 
player's opponent fumbled the ball and this player recovered 
the fumble on that same play
# def_safety | numeric | Number of times this player forced a 
defensive safety
# def_penalty | numeric | Number of times this player was 
penalized defensively
# def_penalty_yards | numeric | Number of penalty yards for 
this player defensively

# dictionary_roster_status
# Available fields:
# status: ACT, EXE, DEV, CUT, E14 ... and 14 more
# description: On the active roster, On the comissioner's 
exempt list, On the practice squad, Cut from the team's roster, 
On the roster as an exempt international player. See https://
www.nfl.com/news/what-is-the-international-player-pathway for 
details ... and 14 more

# dictionary_rosters
# Field | Type | Description
# ----- | ---- | -----------
# season | numeric | NFL season. Defaults to current year after 
March, otherwise is previous year.
# team | character | NFL team. Uses official abbreviations as 
per NFL.com
# position | character | Primary position as reported by NFL.com
# depth_chart_position | character | Position assigned on depth 
chart. Not always accurate!
# jersey_number | numeric | Jersey number. Often useful for 
joins by name/team/jersey.
# status | character | Roster status: describes things like 
Active, Inactive, Injured Reserve, Practice Squad etc
# full_name | character | Full name as per NFL.com
# first_name | character | First name as per NFL.com
# last_name | character | Last name as per NFL.com
# birth_date | date | Birthdate, as recorded by Sleeper API
# height | character | Official height, in inches
# weight | character | Official weight, in pounds
# college | character | Official college (usually the last one 
attended)
# high_school | character | High school
# gsis_id | character | Game Stats and Info Service ID: the 
primary ID for play-by-play data.
# headshot_url | character | A URL string that points to player 
photos used by NFL.com (or sometimes ESPN)
# sleeper_id | character | Player ID for Sleeper API
# espn_id | numeric | Player ID for ESPN API
# yahoo_id | numeric | Player ID for Yahoo API
# rotowire_id | numeric | Player ID for Rotowire
# pff_id | numeric | Player ID for Pro Football Focus
# fantasy_data_id | numeric | Player ID for FantasyData
# years_exp | numeric | Years played in league
# sportradar_id | character | Player ID for Sportradar API
# pfr_id | character | Player ID for Pro Football Reference

# dictionary_snap_counts
# Field | Type | Description
# ----- | ---- | -----------
# game_id | character | nflfastR game ID
# pfr_game_id | character | PFR game ID
# season | numeric | Season of game
# game_type | character | Type of game (regular or postseason)
# week | numeric | Week of game in NFL season
# player | character | Player name
# pfr_player_id | character | Player PFR ID
# position | character | Position of player
# team | character | Team of player
# opponent | character | Opposing team of player
# offense_snaps | numeric | Number of snaps on offense
# offense_pct | numeric | Percent of offensive snaps taken
# defense_snaps | numeric | Number of snaps on defense
# defense_pct | numeric | Percent of defensive snaps taken
# st_snaps | numeric | Number of snaps on special teams
# st_pct | numeric | Percent of special teams snaps taken