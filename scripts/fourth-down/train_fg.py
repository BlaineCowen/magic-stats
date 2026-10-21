"""Field goal make probability.

    python train_fg.py validate   # compare feature sets on 2023-2025 holdout
    python train_fg.py            # write work/fg_model.json (+ kicker ratings)
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import brier_score_loss, log_loss

WORK = Path(__file__).resolve().parent / "work"

BASE = ["kick_distance", "season", "outdoors", "retractable"]
WEATHER = BASE + ["temp", "wind"]
KICKER = WEATHER + ["kicker_rating"]
MONO = {"kick_distance": -1, "season": 1, "temp": 1, "wind": -1, "kicker_rating": 1}
PRIOR_N = 40  # shrinkage weight (attempts) toward league average for kicker ratings


def attempts() -> pd.DataFrame:
    df = pd.read_parquet(WORK / "plays.parquet")
    df = df[(df.play_type == "field_goal") & df.kick_distance.notna() & df.field_goal_result.notna()].copy()
    df["made"] = (df.field_goal_result == "made").astype(int)
    # domes have no weather; xgboost treats NaN as missing
    df.loc[df.dome == 1, ["temp", "wind"]] = np.nan
    return df.sort_values(["game_date", "game_id", "play_id"]).reset_index(drop=True)


def add_kicker_rating(df: pd.DataFrame) -> pd.DataFrame:
    """Shrunk career makes-over-expected per attempt, using only kicks before this one (no leakage)."""
    base = fit(df, BASE)
    df = df.copy()
    df["xmake"] = base.predict(xgb.DMatrix(df[BASE]))
    df["resid"] = df.made - df.xmake
    g = df.groupby("kicker_player_id")
    prior_sum = g.resid.cumsum() - df.resid
    prior_n = g.cumcount()
    df["kicker_rating"] = prior_sum / (prior_n + PRIOR_N)
    return df


def fit(df: pd.DataFrame, feats: list[str]) -> xgb.Booster:
    params = {
        "objective": "binary:logistic", "eta": 0.03, "max_depth": 3, "min_child_weight": 30,
        "subsample": 0.8, "nthread": 6,
        "monotone_constraints": str(tuple(MONO.get(f, 0) for f in feats)),
    }
    return xgb.train(params, xgb.DMatrix(df[feats], label=df.made), 600)


if __name__ == "__main__":
    df = add_kicker_rating(attempts())
    if sys.argv[1:] == ["validate"]:
        train, test = df[df.season <= 2022], df[df.season.between(2023, 2025)]
        print(f"holdout attempts {len(test)}, make rate {test.made.mean():.3f}")
        for name, feats in [("base", BASE), ("+weather", WEATHER), ("+weather+kicker", KICKER)]:
            p = fit(train, feats).predict(xgb.DMatrix(test[feats]))
            print(f"{name:18s} logloss {log_loss(test.made, p):.4f}  brier {brier_score_loss(test.made, p):.4f}")
        long = test[test.kick_distance >= 50]
        for name, feats in [("base", BASE), ("+weather+kicker", KICKER)]:
            p = fit(train, feats).predict(xgb.DMatrix(long[feats]))
            print(f"50+ yds {name:15s} logloss {log_loss(long.made, p):.4f}  (n={len(long)})")
    else:
        # kicker ratings barely moved holdout log loss (0.3614 -> 0.3610) and hurt 50+ yd kicks, so ship weather only
        model = fit(df, WEATHER)
        model.save_model(WORK / "fg_model.json")
        json.dump({"features": WEATHER}, open(WORK / "fg_meta.json", "w"))
        print("saved fg model,", len(df), "attempts")
