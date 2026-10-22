"""Train and backtest the fantasy projection and breakout models.

  ../fourth-down/.venv/bin/python train.py backtest   # walk-forward 2021-2025, prints the report
  ../fourth-down/.venv/bin/python train.py predict    # fit on everything, score the upcoming week

Next game (PPR points): a mean model for the projection and a quantile model
for the floor (10th percentile), median and ceiling (90th).
Breakout: chance a player who isn't a weekly starter yet averages starter-level
PPR over his next 4 games (RB/WR 15+, TE 11+, QB 20+, while scoring at least
3 a game below that so far). Trained on weeks 4-14 of past seasons.

predict writes data/nfl/projections.parquet for the site, with the three
biggest reasons (SHAP contributions) behind each projection.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import roc_auc_score

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
OUT = HERE.parents[1] / "data" / "nfl" / "projections.parquet"

ID_COLS = ["player_id", "name", "season", "game_id", "team", "opp", "position", "upcoming", "ppr", "xfp_game"]
STARTER = {"QB": 20.0, "RB": 15.0, "WR": 15.0, "TE": 11.0}
MARGIN = 3.0
HORIZON = 4

# Plain-English names for the "why" column on the site.
LABELS = {
    "xfp_l3": "usage over the last 3 games",
    "xfp_pg": "usage this season",
    "xfp_prev": "usage last season",
    "xfp_last": "usage last game",
    "xfp_max": "best usage game this season",
    "ppr_pg": "points this season",
    "ppr_l3": "points over the last 3 games",
    "ppr_prev": "points last season",
    "luck_pg": "points vs expected this season",
    "xtd_pg": "red-zone work",
    "xtd_l3": "recent red-zone work",
    "tgt_share": "target share",
    "tgt_share_l3": "recent target share",
    "car_share": "carry share",
    "car_share_l3": "recent carry share",
    "ay_share": "air-yards share",
    "snap_pct": "snap share",
    "snap_l3": "recent snap share",
    "separation": "separation",
    "yac_oe": "YAC over expected",
    "ryoe_att": "rush yards over expected",
    "time_to_throw": "time to throw",
    "implied_total": "Vegas team total",
    "spread": "point spread (game script)",
    "total_line": "game over/under",
    "opp_pos_allowed": "opponent's points allowed to the position",
    "opp_pos_allowed_prev": "opponent's points allowed last season",
    "opp_def_epa": "opponent defense",
    "team_proe": "team pass rate",
    "team_plays": "team pace",
    "team_off_epa": "team offense",
    "qb_epa": "quarterback play",
    "vacated_tgt": "targets freed up by injured teammates",
    "vacated_car": "carries freed up by injured teammates",
    "temp_f": "temperature",
    "wind_mph": "wind",
    "precip_mm": "rain",
    "indoor": "dome",
    "home": "home field",
    "rest": "rest days",
    "age": "age",
    "years_exp": "experience",
    "draft_pick": "draft capital",
    "games_to_date": "games played",
    "games_prev": "games played last season",
    "snap_prev": "snap share last season",
    "tgt_share_prev": "target share last season",
    "opp_games": "opponent games played",
    "qb_dropbacks": "quarterback experience",
    "week": "week of the season",
    "primetime": "primetime game",
    "div_game": "division game",
    "draft_round": "draft round",
    "is_qb": "position",
    "is_rb": "position",
    "is_wr": "position",
    "is_te": "position",
}


def load() -> tuple[pd.DataFrame, list[str]]:
    df = pd.read_parquet(WORK / "player_games.parquet")
    feats = [c for c in df.columns if c not in ID_COLS]
    df[feats] = df[feats].astype(float)
    return df, feats


def with_breakout_label(df: pd.DataFrame) -> pd.DataFrame:
    """Future PPR per game over the next HORIZON games played, this one included."""
    df = df.sort_values(["player_id", "season", "week"]).copy()
    g = df.groupby(["player_id", "season"]).ppr
    fut = sum(g.shift(-k) for k in range(HORIZON))
    cnt = sum(g.shift(-k).notna().astype(int) for k in range(HORIZON))
    df["future_ppg"] = fut / HORIZON
    df["future_n"] = cnt
    bar = df.position.map(STARTER)
    df["bo_eligible"] = (df.games_to_date >= 3) & (df.ppr_pg.fillna(0) < bar - MARGIN)
    df["breakout"] = (df.future_ppg >= bar).astype(int)
    return df


def fit_points(X: pd.DataFrame, y: pd.Series) -> tuple[xgb.XGBRegressor, xgb.XGBRegressor]:
    common = dict(n_estimators=600, learning_rate=0.03, max_depth=5, subsample=0.8,
                  colsample_bytree=0.8, min_child_weight=20, tree_method="hist", n_jobs=4)
    mean = xgb.XGBRegressor(objective="reg:squarederror", **common).fit(X, y)
    quant = xgb.XGBRegressor(objective="reg:quantileerror", quantile_alpha=np.array([0.1, 0.5, 0.9]), **common).fit(X, y)
    return mean, quant


def fit_breakout(X: pd.DataFrame, y: pd.Series) -> xgb.XGBClassifier:
    return xgb.XGBClassifier(
        n_estimators=400, learning_rate=0.03, max_depth=4, subsample=0.8, colsample_bytree=0.8,
        min_child_weight=10, tree_method="hist", eval_metric="logloss", n_jobs=4,
    ).fit(X, y)


def calibrated_breakout(bt: pd.DataFrame, feats: list[str]):
    """Breakout classifier plus an isotonic map fit on leave-one-season-out
    predictions, because the raw model is overconfident above ~30%."""
    oof = np.full(len(bt), np.nan)
    seasons = bt.season.values
    for s in np.unique(seasons):
        tr, te = seasons != s, seasons == s
        oof[te] = fit_breakout(bt[feats][tr], bt.breakout[tr]).predict_proba(bt[feats][te])[:, 1]
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(oof, bt.breakout)
    clf = fit_breakout(bt[feats], bt.breakout)
    return lambda X: iso.predict(clf.predict_proba(X)[:, 1])


def baseline(df: pd.DataFrame, col: str, prev: str) -> pd.Series:
    """Season to date, else last season, else the position average."""
    pos_mean = df.groupby("position").ppr.transform("mean")
    return df[col].fillna(df[prev]).fillna(pos_mean)


def backtest(df: pd.DataFrame, feats: list[str]) -> None:
    played = df[~df.upcoming].copy()
    played = with_breakout_label(played)
    rows, bo_rows = [], []
    for season in range(2021, 2026):
        train = played[played.season < season]
        test = played[played.season == season].copy()
        mean, quant = fit_points(train[feats], train.ppr)
        test["proj"] = mean.predict(test[feats])
        q = quant.predict(test[feats])
        test["floor"], test["median"], test["ceiling"] = q[:, 0], q[:, 1], q[:, 2]
        test["base_ppr"] = baseline(test, "ppr_pg", "ppr_prev")
        test["base_xfp"] = baseline(test, "xfp_pg", "xfp_prev")
        rows.append(test)

        bt = train[train.bo_eligible & train.week.between(4, 14) & (train.future_n >= 3)]
        be = test[test.bo_eligible & test.week.between(4, 14) & (test.future_n >= 3)].copy()
        be["p"] = calibrated_breakout(bt, feats)(be[feats])
        bo_rows.append(be)

    r = pd.concat(rows)
    mae = lambda c: (r[c] - r.ppr).abs().mean()
    print("Next game, PPR points, 2021-2025 walk-forward")
    print(f"  model MAE {mae('proj'):.2f} | season PPR/game {mae('base_ppr'):.2f} | season xFP/game {mae('base_xfp'):.2f}")
    for pos, g in r.groupby("position"):
        m = (g.proj - g.ppr).abs().mean()
        b = (g.base_xfp - g.ppr).abs().mean()
        b2 = (g.base_ppr - g.ppr).abs().mean()
        print(f"  {pos}: model {m:.2f} | ppr {b2:.2f} | xfp {b:.2f} | n {len(g)}")
    # Ranking within a position each week: what start/sit decisions use.
    def week_corr(c: str) -> float:
        return r.groupby(["season", "week", "position"]).apply(
            lambda g: g[c].corr(g.ppr, method="spearman") if len(g) > 10 else np.nan, include_groups=False
        ).mean()
    print(f"  weekly rank correlation: model {week_corr('proj'):.3f} | ppr {week_corr('base_ppr'):.3f} | xfp {week_corr('base_xfp'):.3f}")
    print(f"  below floor {np.mean(r.ppr < r.floor):.1%} (target 10%) | above ceiling {np.mean(r.ppr > r.ceiling):.1%} (target 10%)")
    big = r[r.ppr >= 25]
    print(f"  25+ point games: {len(big)}; ceiling caught {np.mean(big.ceiling >= 20):.1%} with a 20+ ceiling")

    b = pd.concat(bo_rows)
    print("\nBreakout (next 4 games at starter level), 2021-2025")
    print(f"  rows {len(b)}, base rate {b.breakout.mean():.1%}, AUC {roc_auc_score(b.breakout, b.p):.3f}")
    top = b.sort_values("p", ascending=False).groupby(["season", "week"]).head(10)
    print(f"  weekly top 10 hit rate {top.breakout.mean():.1%}")
    # Calibration: does a 30% pick break out about 30% of the time?
    b["bucket"] = pd.cut(b.p, [0, 0.05, 0.1, 0.2, 0.3, 0.5, 1.0])
    print(b.groupby("bucket", observed=True).agg(n=("p", "size"), predicted=("p", "mean"), actual=("breakout", "mean")).round(3).to_string())
    for pos, g in b.groupby("position"):
        if g.breakout.sum() > 5:
            print(f"  {pos}: base {g.breakout.mean():.1%}, AUC {roc_auc_score(g.breakout, g.p):.3f}")
    report = {
        "mae": round(mae("proj"), 3), "mae_ppr": round(mae("base_ppr"), 3), "mae_xfp": round(mae("base_xfp"), 3),
        "rank_corr": round(week_corr("proj"), 3), "rank_corr_xfp": round(week_corr("base_xfp"), 3),
        "below_floor": round(float(np.mean(r.ppr < r.floor)), 3), "above_ceiling": round(float(np.mean(r.ppr > r.ceiling)), 3),
        "breakout_auc": round(roc_auc_score(b.breakout, b.p), 3), "breakout_base": round(b.breakout.mean(), 4),
        "breakout_top10": round(top.breakout.mean(), 3),
    }
    (WORK / "backtest.json").write_text(json.dumps(report, indent=2))


def reasons(model: xgb.XGBRegressor, X: pd.DataFrame, feats: list[str]) -> list[str]:
    """Top three SHAP contributions per row, e.g. '+3.1 usage over the last 3 games'."""
    contrib = model.get_booster().predict(xgb.DMatrix(X), pred_contribs=True)[:, :-1]
    out = []
    for row in contrib:
        idx = np.argsort(-np.abs(row))[:3]
        out.append(json.dumps([[LABELS.get(feats[i], feats[i]), round(float(row[i]), 1)] for i in idx]))
    return out


def predict(df: pd.DataFrame, feats: list[str]) -> None:
    played = with_breakout_label(df[~df.upcoming])
    up = df[df.upcoming].copy()
    mean, quant = fit_points(played[feats], played.ppr)
    up["proj"] = mean.predict(up[feats])
    q = quant.predict(up[feats])
    up["floor"], up["median"], up["ceiling"] = q[:, 0], q[:, 1], q[:, 2]
    # Quantile crossings are rare but possible; keep floor <= median <= ceiling.
    up[["floor", "median", "ceiling"]] = np.sort(up[["floor", "median", "ceiling"]].values, axis=1)
    up["why"] = reasons(mean, up[feats], feats)

    bt = played[played.bo_eligible & played.week.between(4, 14) & (played.future_n >= 3)]
    prob = calibrated_breakout(bt, feats)
    bar = up.position.map(STARTER)
    eligible = (up.games_to_date >= 3) & (up.ppr_pg.fillna(0) < bar - MARGIN)
    up["breakout_prob"] = np.where(eligible, prob(up[feats]), np.nan)

    keep = ["player_id", "name", "season", "week", "game_id", "team", "opp", "position",
            "proj", "floor", "median", "ceiling", "breakout_prob", "why",
            "games_to_date", "ppr_pg", "xfp_pg", "ppr_l3", "xfp_l3", "luck_pg",
            "tgt_share", "tgt_share_l3", "car_share", "car_share_l3", "snap_pct", "snap_l3",
            "separation", "yac_oe", "ryoe_att", "vacated_tgt", "vacated_car",
            "implied_total", "spread", "home", "indoor", "temp_f", "wind_mph", "precip_mm",
            "opp_pos_allowed", "age", "years_exp"]
    res = up[keep].sort_values("proj", ascending=False)
    # float32 model output prints as 18.100000381 in SQL answers; store tidy float64.
    for c in ["proj", "floor", "median", "ceiling"]:
        res[c] = res[c].astype("float64").round(1)
    res["breakout_prob"] = res.breakout_prob.astype("float64").round(3)
    res.to_parquet(OUT, index=False)
    # Backtest scores travel with the projections so the site can show them.
    meta = json.loads((WORK / "backtest.json").read_text()) if (WORK / "backtest.json").exists() else {}
    meta["generated"] = pd.Timestamp.now(tz="UTC").isoformat()
    OUT.with_name("projections-meta.json").write_text(json.dumps(meta))
    print(f"wrote {len(res)} projections for {res.season.iat[0]} week {int(res.week.min())}-{int(res.week.max())} to {OUT}")
    print(res.head(10)[["name", "position", "opp", "proj", "floor", "ceiling"]].round(1).to_string(index=False))
    b = res[res.breakout_prob.notna()].sort_values("breakout_prob", ascending=False)
    print(b.head(10)[["name", "position", "ppr_pg", "xfp_l3", "breakout_prob", "ceiling"]].round(2).to_string(index=False))


if __name__ == "__main__":
    df, feats = load()
    if len(sys.argv) > 1 and sys.argv[1] == "predict":
        predict(df, feats)
    else:
        backtest(df, feats)
