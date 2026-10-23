"""Bootstrap replicates of the win probability, go-for-it and field goal models, for margins of error.

Each replicate resamples whole games with replacement (as xgboost weights, so no rows are copied) and
retrains a lighter version of each model. The site runs every decision through all replicates and reports
how often they agree on the best call (after Brill, Yurko & Wyner, "Analytics, have some humility", 2023).

    python train_boot.py [B]            # default 12; writes src/lib/fourth/models/boot/*.json.gz
    python train_boot.py [B] --fg-only  # retrain just the field goal replicates
"""

import gzip
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

import export
import train_fg
import train_go
import train_wp

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "src" / "lib" / "fourth" / "models" / "boot"

# lighter than the shipped models (fewer, larger steps) so 12 copies stay small and fast to evaluate;
# only their spread is used, centered on the shipped model's answer
WP_LIGHT = {**train_wp.PARAMS, "eta": 0.08}
WP_ROUNDS = 450
GO_LIGHT = {"objective": "multi:softprob", "num_class": train_go.NCLASS, "eta": 0.1, "gamma": 2, "subsample": 0.8,
            "colsample_bytree": 0.8, "max_depth": 4, "min_child_weight": 1, "nthread": 8}
GO_ROUNDS = 200


def game_weights(games: pd.Series, rng: np.random.Generator) -> pd.Series:
    ids = games.unique()
    draws = pd.Series(rng.choice(ids, size=len(ids), replace=True)).value_counts()
    return games.map(draws).fillna(0).astype(float)


def save(model: xgb.Booster, feats: list[str], sample: pd.DataFrame, name: str, nclass: int = 1) -> None:
    data = json.dumps(export.compact(model, feats, sample, nclass), separators=(",", ":")).encode()
    with gzip.open(OUT / f"{name}.json.gz", "wb", compresslevel=9) as f:
        f.write(data)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    B = int(args[0]) if args else 12
    fg_only = "--fg-only" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20261021)

    wp_rows = train_wp.training_rows()
    go_rows = train_go.plays()
    go_rows = go_rows[go_rows.season.between(2006, 2025)]
    go_w4 = np.where(go_rows.down == 4, train_go.SHIP["w4"], 1.0)
    fg_rows = train_fg.attempts()
    fg_feats = json.load(open(HERE / "work" / "fg_meta.json"))["features"]

    for b in range(B):
        t = time.time()
        # draw every model's weights even with --fg-only, so its replicates match a full run's
        w_wp = game_weights(wp_rows.game_id, rng)
        w_go = game_weights(go_rows.game_id, rng) * go_w4
        if not fg_only:
            m = xgb.train(WP_LIGHT, xgb.DMatrix(wp_rows[train_wp.FEATURES], label=wp_rows.label_win, weight=w_wp), WP_ROUNDS)
            save(m, train_wp.FEATURES, wp_rows, f"wp_{b}")
            m = xgb.train(GO_LIGHT, xgb.DMatrix(go_rows[train_go.MORE], label=go_rows.label, weight=w_go), GO_ROUNDS)
            save(m, train_go.MORE, go_rows[go_rows.down == 4], f"go_{b}", train_go.NCLASS)

        w = game_weights(fg_rows.game_id, rng)
        params = {"objective": "binary:logistic", "eta": 0.03, "max_depth": 3, "min_child_weight": 30, "subsample": 0.8,
                  "nthread": 6, "monotone_constraints": str(tuple(train_fg.MONO.get(f, 0) for f in fg_feats))}
        m = xgb.train(params, xgb.DMatrix(fg_rows[fg_feats], label=fg_rows.made, weight=w), 600)
        save(m, fg_feats, fg_rows, f"fg_{b}")
        print(f"replicate {b + 1}/{B} done in {time.time() - t:.0f}s", flush=True)

    sizes = sum(f.stat().st_size for f in OUT.glob("*.json.gz"))
    print(f"wrote {B} replicates, {sizes / 1e6:.1f} MB")
