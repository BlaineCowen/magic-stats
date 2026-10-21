"""Build the play-level training table for the 4th down models from the nflverse pbp cache.

Writes work/plays.parquet: one row per scrimmage/kick play with the game-state features the
win-probability, go-for-it, field goal and punt models use.
"""

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PBP = ROOT / "data" / "nfl" / "pbp"
WORK = Path(__file__).resolve().parent / "work"

COLS = [
    "game_id", "play_id", "season", "week", "season_type", "home_team", "away_team", "posteam",
    "defteam", "posteam_type", "qtr", "down", "ydstogo", "yardline_100", "half_seconds_remaining",
    "game_seconds_remaining", "score_differential", "posteam_score", "defteam_score",
    "posteam_timeouts_remaining", "defteam_timeouts_remaining", "home_opening_kickoff",
    "spread_line", "total_line", "roof", "play_type", "yards_gained", "touchdown", "td_team",
    "safety", "interception", "fumble_lost", "penalty", "first_down", "fourth_down_converted",
    "fourth_down_failed", "field_goal_result", "kick_distance", "punt_blocked", "qb_kneel",
    "qb_spike", "result", "home_score", "away_score", "desc", "wp", "vegas_wp", "drive",
    "fixed_drive", "special_teams_play", "return_yards", "touchback", "aborted_play", "epa",
    "temp", "wind", "kicker_player_id", "kicker_player_name", "punter_player_id", "surface",
    "fumble", "pass_attempt", "rush_attempt", "sack", "two_point_attempt", "extra_point_result",
    "two_point_conv_result", "game_date", "penalty_yards", "first_down_penalty", "play_type_nfl",
    "penalty_team", "return_touchdown", "posteam_score_post", "defteam_score_post",
]


def load() -> pd.DataFrame:
    frames = []
    for f in sorted(PBP.glob("*.parquet")):
        df = pd.read_parquet(f, columns=[c for c in COLS])
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    return df


def features(df: pd.DataFrame) -> pd.DataFrame:
    df = df[df.posteam.notna() & df.qtr.notna()].copy()
    df["home"] = (df.posteam == df.home_team).astype(int)
    # nflverse spread_line is the home team's expected margin (positive = home favored)
    df["posteam_spread"] = np.where(df.home == 1, df.spread_line, -df.spread_line)
    elapsed = ((3600 - df.game_seconds_remaining) / 3600).clip(lower=0)
    df["spread_time"] = df.posteam_spread * np.exp(-4 * elapsed)
    df["diff_time_ratio"] = df.score_differential / np.exp(-4 * elapsed)
    # home_opening_kickoff = 1 when the home team received the opening kick, so the away team gets the 2H kick
    recv_2h_home = df.home_opening_kickoff == 0
    df["receive_2h_ko"] = (
        (df.qtr <= 2) & np.where(df.home == 1, recv_2h_home, ~recv_2h_home)
    ).astype(int)
    df["outdoors"] = df.roof.isin(["outdoors", "open"]).astype(int)
    df["retractable"] = (df.roof == "retractable").astype(int)
    df["dome"] = (df.roof == "dome").astype(int)
    # final margin from the offense's perspective; ties get 0.5
    margin = np.where(df.home == 1, df.home_score - df.away_score, df.away_score - df.home_score)
    df["label_win"] = np.select([margin > 0, margin < 0], [1.0, 0.0], 0.5)
    return df


if __name__ == "__main__":
    WORK.mkdir(exist_ok=True)
    df = features(load())
    df.to_parquet(WORK / "plays.parquet", index=False)
    print(len(df), "plays,", df.season.min(), "-", df.season.max())
    print(df.groupby("season").size().tail(4))
