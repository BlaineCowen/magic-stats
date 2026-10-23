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
CLIMATE_MIN_GAMES = 4  # fewer recorded games than this at a stadium in a month: use the league month


def climate(df: pd.DataFrame) -> dict:
    """Typical game-time temperature and wind for open-air games: by home team and month, by month, overall.

    nflverse leaves weather blank for some outdoor games (most of 2022, and the current season until it's
    backfilled). Left blank, those kicks take xgboost's missing-value branch, which domes taught to expect
    perfect conditions: 89% on a 43-yarder at Soldier Field in October, against about 80% in reality.
    """
    g = df[df.outdoors == 1].drop_duplicates("game_id")
    g = g.assign(month=pd.to_datetime(g.game_date).dt.month)[["home_team", "month", "temp", "wind"]].dropna()
    med = lambda x: {"temp": float(x.temp.median()), "wind": float(x.wind.median())}
    team = {}
    for (t, m), x in g.groupby(["home_team", "month"]):
        if len(x) >= CLIMATE_MIN_GAMES:
            team.setdefault(t, {})[str(m)] = med(x)
    month = {str(m): med(x) for m, x in g.groupby("month") if len(x) >= CLIMATE_MIN_GAMES}
    return {"team": team, "month": month, "all": med(g)}


def fill_weather(df: pd.DataFrame, clim: dict) -> pd.DataFrame:
    """Fill blank temperature and wind on open-air kicks with the typical value for that stadium and month."""
    df = df.copy()
    month = pd.to_datetime(df.game_date).dt.month.astype(str)
    for col in ["temp", "wind"]:
        need = (df.outdoors == 1) & df[col].isna()
        df.loc[need, col] = [
            clim["team"].get(t, {}).get(m, clim["month"].get(m, clim["all"]))[col]
            for t, m in zip(df.home_team[need], month[need])
        ]
    return df


def attempts(fill: bool = True) -> pd.DataFrame:
    plays = pd.read_parquet(WORK / "plays.parquet")
    df = plays[(plays.play_type == "field_goal") & plays.kick_distance.notna() & plays.field_goal_result.notna()].copy()
    df["made"] = (df.field_goal_result == "made").astype(int)
    # domes have no weather; xgboost treats NaN as missing
    df.loc[df.dome == 1, ["temp", "wind"]] = np.nan
    if fill:
        df = fill_weather(df, climate(plays))
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
        # outdoor holdout kicks with weather recorded, scored as if nflverse had left it blank: the old
        # model gets NaN, the filled model gets the stadium/month climate
        clim = climate(pd.read_parquet(WORK / "plays.parquet"))
        raw = add_kicker_rating(attempts(fill=False))
        old = fit(raw[raw.season <= 2022], WEATHER)
        out = test[(test.outdoors == 1) & raw.loc[test.index, "temp"].notna()]
        blank = out.assign(temp=np.nan, wind=np.nan)
        for name, model, x in [("blank, old", old, blank), ("climate, new", fit(train, WEATHER), fill_weather(blank, clim)),
                               ("actual weather", fit(train, WEATHER), out)]:
            p = model.predict(xgb.DMatrix(x[WEATHER]))
            print(f"outdoor, {name:15s} logloss {log_loss(out.made, p):.4f}  mean pred {p.mean():.3f} vs made {out.made.mean():.3f}"
                  f"  | 40-49 yds {p[out.kick_distance.between(40, 49).to_numpy()].mean():.3f}"
                  f" vs {out.made[out.kick_distance.between(40, 49)].mean():.3f}  (n={len(out)})")
    else:
        # kicker ratings barely moved holdout log loss (0.3614 -> 0.3610) and hurt 50+ yd kicks, so ship weather only
        model = fit(df, WEATHER)
        model.save_model(WORK / "fg_model.json")
        json.dump(climate(pd.read_parquet(WORK / "plays.parquet")), open(WORK / "climate.json", "w"))
        json.dump({"features": WEATHER}, open(WORK / "fg_meta.json", "w"))
        print("saved fg model,", len(df), "attempts")
