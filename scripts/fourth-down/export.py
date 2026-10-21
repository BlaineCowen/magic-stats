"""Export trained models to the compact JSON the TypeScript evaluator reads (src/lib/fourth/models/).

Each tree becomes flat arrays: f = split feature (-1 for a leaf), t = threshold or leaf value,
l / r = children, d = 1 if missing values go left. base_margin is measured, not read from the JSON,
so it is right for every objective. Also writes parity fixtures for the TypeScript test.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
OUT = HERE.parents[1] / "src" / "lib" / "fourth" / "models"

from train_go import NCLASS  # noqa: E402
from train_wp import FEATURES as WP_FEATURES  # noqa: E402


def compact(booster: xgb.Booster, features: list[str], sample: pd.DataFrame, nclass: int = 1) -> dict:
    raw = json.loads(booster.save_raw("json"))
    gb = raw["learner"]["gradient_booster"]["model"]
    trees = []
    for t in gb["trees"]:
        leaf = np.array(t["left_children"]) == -1
        trees.append({
            "f": [-1 if lf else int(i) for i, lf in zip(t["split_indices"], leaf)],
            "t": [float(np.float32(v)) for v in t["split_conditions"]],
            "l": t["left_children"],
            "r": t["right_children"],
            "d": t["default_left"],
        })
    tree_class = gb["tree_info"]
    # measure the base margin: full margin minus summed leaves, on one row
    x = sample[features].iloc[:1]
    margin = booster.predict(xgb.DMatrix(x), output_margin=True).reshape(-1, nclass)[0]
    leaves = np.zeros(nclass)
    row = x.iloc[0].to_numpy(dtype=np.float32)
    for tree, c in zip(trees, tree_class):
        n = 0
        while tree["f"][n] != -1:
            v = row[tree["f"][n]]
            if np.isnan(v):
                n = tree["l"][n] if tree["d"][n] else tree["r"][n]
            else:
                n = tree["l"][n] if v < tree["t"][n] else tree["r"][n]
        leaves[c] += tree["t"][n]
    base = (margin - leaves).astype(float).tolist()
    return {"features": features, "nclass": nclass, "base": base, "treeClass": tree_class, "trees": trees}


def fixtures(booster, features, df, nclass=1, n=25):
    rows = df[features].sample(n, random_state=1)
    pred = booster.predict(xgb.DMatrix(rows)).reshape(len(rows), -1)
    return [{"x": [None if pd.isna(v) else float(v) for v in r], "p": [float(v) for v in p]}
            for r, p in zip(rows.to_numpy(), pred)]


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    plays = pd.read_parquet(WORK / "plays.parquet")
    plays["era3"] = plays.season.between(2014, 2017).astype(int)
    plays["era4"] = (plays.season >= 2018).astype(int)
    plays["era5"] = (plays.season >= 2022).astype(int)
    plays["posteam_total"] = (plays.total_line + plays.posteam_spread) / 2
    sample = plays[plays.down.notna() & plays.spread_line.notna()]
    fx = {}

    wp = xgb.Booster(model_file=str(WORK / "wp_model.json"))
    json.dump(compact(wp, WP_FEATURES, sample), open(OUT / "wp.json", "w"), separators=(",", ":"))
    fx["wp"] = fixtures(wp, WP_FEATURES, sample)

    go_feats = json.load(open(WORK / "go_meta.json"))["features"]
    go = xgb.Booster(model_file=str(WORK / "go_model.json"))
    json.dump(compact(go, go_feats, sample, NCLASS), open(OUT / "go.json", "w"), separators=(",", ":"))
    fx["go"] = fixtures(go, go_feats, sample[sample.down == 4], NCLASS)

    fg_feats = json.load(open(WORK / "fg_meta.json"))["features"]
    fg = xgb.Booster(model_file=str(WORK / "fg_model.json"))
    kicks = plays[plays.play_type == "field_goal"].copy()
    kicks.loc[kicks.dome == 1, ["temp", "wind"]] = np.nan
    json.dump(compact(fg, fg_feats, kicks), open(OUT / "fg.json", "w"), separators=(",", ":"))
    fx["fg"] = fixtures(fg, fg_feats, kicks)

    json.dump(json.load(open(WORK / "punt_table.json")), open(OUT / "punt.json", "w"), separators=(",", ":"))
    json.dump(fx, open(OUT / "fixtures.json", "w"), separators=(",", ":"))
    for f in sorted(OUT.glob("*.json")):
        print(f"{f.name:15s} {f.stat().st_size / 1e6:.2f} MB")
