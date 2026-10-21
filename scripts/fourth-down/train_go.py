"""Go-for-it yards-gained model (nfl4th design: 76-class multinomial over yards gained in [-10, 65]).

    python train_go.py validate   # nfl4th replica vs. variants, scored on 2023-2025 4th downs
    python train_go.py            # write work/go_model.json
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import log_loss

WORK = Path(__file__).resolve().parent / "work"
NCLASS = 76  # yards -10..65

NFL4TH = ["down", "ydstogo", "yardline_100", "era3", "era4", "outdoors", "retractable", "dome",
          "posteam_spread", "total_line", "posteam_total"]
MORE = NFL4TH + ["era5"]
TEAM = MORE + ["off_epa", "def_epa"]
# Score and clock scored best on the 2023-25 holdout (0.6334 vs 0.6362 without), but they let the model
# learn who chooses to go: neutral-game 4th & longs are rare oddities, and it put 4th & 12 from your own
# 20 at 56%. The calculator asks "what if they went", so the shipped model leaves game state out.
STATE = MORE + ["score_differential", "game_seconds_remaining", "half_seconds_remaining"]


def team_strength(df: pd.DataFrame) -> pd.DataFrame:
    """Offense EPA/play and opponent defense EPA/play allowed, using only games before this one.

    Season-to-date mean shrunk toward the team's previous-season mean (weight 6 games), which in turn is
    shrunk toward 0, so week 1 still has a sensible value.
    """
    plays = df[df.rush_attempt.eq(1) | df.pass_attempt.eq(1)]
    g = plays.groupby(["season", "week", "game_id", "posteam", "defteam"]).epa.agg(["sum", "count"]).reset_index()

    def rolling(side: str) -> pd.DataFrame:
        t = g.groupby(["season", "week", "game_id", side])[["sum", "count"]].sum().reset_index().sort_values(["season", "week"])
        t["cum_sum"] = t.groupby(["season", side])["sum"].cumsum() - t["sum"]
        t["cum_n"] = t.groupby(["season", side])["count"].cumsum() - t["count"]
        season = t.groupby(["season", side])[["sum", "count"]].sum()
        prev = (season["sum"] / season["count"]).rename("prev").reset_index()
        prev["season"] += 1
        t = t.merge(prev, on=["season", side], how="left")
        prior = t.prev.fillna(0) * 0.5
        w = 6 * 62  # ~6 games of plays
        t["val"] = (t.cum_sum + prior * w) / (t.cum_n + w)
        return t[["game_id", side, "val"]]

    off = rolling("posteam").rename(columns={"val": "off_epa"})
    de = rolling("defteam").rename(columns={"val": "def_epa"})
    df = df.merge(off, on=["game_id", "posteam"], how="left").merge(de, on=["game_id", "defteam"], how="left")
    return df


def plays() -> pd.DataFrame:
    df = pd.read_parquet(WORK / "plays.parquet")
    df = df[df.down.isin([3, 4]) & df.qb_kneel.eq(0) & df.qb_spike.ne(1) & df.yardline_100.notna()
            & df.spread_line.notna() & (df.qtr <= 5)]
    df = df[df.play_type_nfl.isin(["RUSH", "PASS", "SACK"]) | df.first_down_penalty.eq(1)]
    df = df[df.rush_attempt.eq(1) | df.pass_attempt.eq(1) | df.first_down_penalty.eq(1)].copy()
    # fake punts / field goals succeed far more often than a real attempt from the same spot, and in
    # neutral game states they're most of the 4th & long "attempts"; they aren't the choice being modeled
    fake = df["desc"].str.contains(r"\((?:Punt|Field Goal) formation\)", case=False, na=False)
    df = df[~fake]
    # defensive penalty that gives a first down counts as converting (nfl4th convention)
    pen = df.first_down_penalty.eq(1) & df.penalty_team.eq(df.defteam)
    df.loc[pen, "yards_gained"] = np.where(df.loc[pen, "penalty_yards"] < df.loc[pen, "ydstogo"],
                                           df.loc[pen, "ydstogo"], df.loc[pen, "penalty_yards"])
    df = df[df.yards_gained.notna()]
    df["label"] = df.yards_gained.clip(-10, 65).astype(int) + 10
    df["era3"] = df.season.between(2014, 2017).astype(int)
    df["era4"] = (df.season >= 2018).astype(int)
    df["era5"] = (df.season >= 2022).astype(int)
    df["posteam_total"] = (df.total_line + df.posteam_spread) / 2
    return df


def fit(df: pd.DataFrame, feats: list[str], rounds: int = 1124, depth: int = 2, w4: float = 1.0) -> xgb.Booster:
    params = {"objective": "multi:softprob", "num_class": NCLASS, "eta": 0.03, "gamma": 2,
              "subsample": 0.8, "colsample_bytree": 0.8, "max_depth": depth, "min_child_weight": 1,
              "nthread": 8}
    w = np.where(df.down == 4, w4, 1.0)
    return xgb.train(params, xgb.DMatrix(df[feats], label=df.label, weight=w), rounds)


# nfl4th's depth-2 trees can't separate real 4th down attempts from 3rd downs; on the 2023-25
# holdout depth 4 with 4th downs weighted x3 scored 0.6358 conversion log loss vs 0.6389 (depth 2)
SHIP = {"rounds": 700, "depth": 4, "w4": 3.0}


def score(model, test, feats, name):
    p = model.predict(xgb.DMatrix(test[feats]))
    mll = log_loss(test.label, p, labels=range(NCLASS))
    # conversion probability: P(gain >= ydstogo)
    need = (test.ydstogo.values + 10).astype(int)
    conv = np.array([row[n:].sum() for row, n in zip(p, need)])
    made = (test.yards_gained.values >= test.ydstogo.values).astype(int)
    print(f"{name:28s} multiclass {mll:.4f}  conversion logloss {log_loss(made, conv):.4f}  "
          f"pred {conv.mean():.3f} vs actual {made.mean():.3f}")


if __name__ == "__main__":
    df = plays()
    if sys.argv[1:] == ["validate"]:
        df = team_strength(df)
        test = df[df.season.between(2023, 2025) & (df.down == 4)]
        print(f"holdout 4th down attempts: {len(test)}")
        replica = df[df.season.between(2014, 2019) & (df.week <= 17)]
        score(fit(replica, NFL4TH), test, NFL4TH, "nfl4th replica (2014-19)")
        more = df[df.season.between(2006, 2022)]
        score(fit(more, MORE), test, MORE, "2006-22 incl. playoffs")
        score(fit(more, TEAM), test, TEAM, "2006-22 + team EPA")
    else:
        # team EPA didn't beat the spread on the 2023-25 holdout (0.6389 either way), so it stays out
        feats = MORE
        train = df[df.season.between(2006, 2025)]
        model = fit(train, feats, **SHIP)
        latest = df[(df.season == 2026) & (df.down == 4)]
        if len(latest):
            score(model, latest, feats, "2026 4th downs (unseen)")
        model.save_model(WORK / "go_model.json")
        json.dump({"features": feats}, open(WORK / "go_meta.json", "w"))
        print("saved go model", feats)
