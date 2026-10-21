"""Win probability model (nflfastR wp_spread feature set, xgboost, monotone constraints).

    python train_wp.py validate   # train 1999-2022, score 2023-2025 against nflfastR's vegas_wp
    python train_wp.py            # train on everything and write work/wp_model.json
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import brier_score_loss, log_loss

WORK = Path(__file__).resolve().parent / "work"

FEATURES = [
    "receive_2h_ko", "spread_time", "home", "half_seconds_remaining", "game_seconds_remaining",
    "diff_time_ratio", "score_differential", "down", "ydstogo", "yardline_100",
    "posteam_timeouts_remaining", "defteam_timeouts_remaining",
]
MONOTONE = (0, 1, 0, 0, 0, 1, 1, -1, -1, -1, 1, -1)
PARAMS = {
    "objective": "binary:logistic",
    "eval_metric": "logloss",
    "eta": 0.025,
    "max_depth": 5,
    "min_child_weight": 50,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "monotone_constraints": str(MONOTONE),
    "nthread": 6,
}
ROUNDS = 1500


def training_rows() -> pd.DataFrame:
    df = pd.read_parquet(WORK / "plays.parquet")
    df = df[
        df.down.notna() & (df.qtr <= 4) & df.home_score.notna() & df.spread_line.notna()
        & df.posteam_timeouts_remaining.notna() & (df.label_win != 0.5)
    ]
    return df


def fit(train: pd.DataFrame) -> xgb.Booster:
    d = xgb.DMatrix(train[FEATURES], label=train.label_win)
    return xgb.train(PARAMS, d, ROUNDS)


if __name__ == "__main__":
    df = training_rows()
    if sys.argv[1:] == ["validate"]:
        train, test = df[df.season <= 2022], df[df.season.between(2023, 2025)]
        model = fit(train)
        p = model.predict(xgb.DMatrix(test[FEATURES]))
        ok = test.vegas_wp.notna()
        print(f"holdout plays {len(test)}")
        print(f"ours    logloss {log_loss(test.label_win, p):.4f}  brier {brier_score_loss(test.label_win, p):.4f}")
        print(f"nflfastR logloss {log_loss(test.label_win[ok], test.vegas_wp[ok].clip(1e-6, 1-1e-6)):.4f}  "
              f"brier {brier_score_loss(test.label_win[ok], test.vegas_wp[ok]):.4f}  (trained in-sample on these seasons)")
        bins = pd.cut(p, np.linspace(0, 1, 11))
        print(pd.DataFrame({"pred": p, "won": test.label_win.values}).groupby(bins, observed=True).agg(
            n=("won", "size"), pred=("pred", "mean"), actual=("won", "mean")).round(3))
    else:
        model = fit(df)
        model.save_model(WORK / "wp_model.json")
        print("saved", WORK / "wp_model.json", len(df), "rows")
