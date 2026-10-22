import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import roc_auc_score
import xgboost as xgb
cp = pd.read_parquet("work/checkpoints.parquet")
print(cp.groupby("pos").breakout.agg(["size", "mean"]).round(4))
cp["big"] = cp.pos.isin(["C"]).astype(int)
cp["prior_missing"] = cp.prior_fppg.isna().astype(int)
cp["prior_fppg_f"] = cp.prior_fppg.fillna(8)
cp["age_f"] = cp.age.fillna(26)
cp["traded_i"] = cp.traded.astype(int)
cp["undrafted_i"] = cp.undrafted.astype(int)
F = ["role_fppg", "fp_per_min", "min3", "min_jump", "fp3", "fppg", "mpg", "usage_per_min", "vacated", "prior_fppg_f",
     "prior_missing", "age_f", "gp_share", "starterish3", "big", "traded_i", "undrafted_i", "reb_pg", "stocks_pg", "ast_pg", "tpm_pg", "week"]
X, y = cp[F].fillna(0).values, cp.breakout.values

def evaluate(name, make, cols=F):
    preds = np.zeros(len(cp))
    for s in sorted(cp.season.unique()):
        tr, te = cp.season != s, cp.season == s
        m = make(); m.fit(cp.loc[tr, cols].fillna(0).values, y[tr]); preds[te.values] = m.predict_proba(cp.loc[te, cols].fillna(0).values)[:, 1]
    cp[name] = preds
    # each week, take the top 5 / top 10 waiver names: how often did they become top-60 the rest of the way?
    p5 = cp.sort_values(name, ascending=False).groupby(["season", "week"]).head(5).breakout.mean()
    p10 = cp.sort_values(name, ascending=False).groupby(["season", "week"]).head(10).breakout.mean()
    # how many of the eventual breakouts were in the top 10 the first week they were on waivers... and ever
    top10 = cp.sort_values(name, ascending=False).groupby(["season", "week"]).head(10)
    caught = top10[top10.breakout].groupby(["season", "player_id"]).ngroups
    total = cp[cp.breakout].groupby(["season", "player_id"]).ngroups
    print(f"{name:10s} AUC {roc_auc_score(y, preds):.3f}  hit@5 {p5:.3f}  hit@10 {p10:.3f}  breakouts ever in weekly top10 {caught}/{total}")

evaluate("naive_fp3", lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)), ["fp3"])
evaluate("naive_role", lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)), ["role_fppg"])
evaluate("logit", lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=4000, C=0.5)))
evaluate("xgb", lambda: xgb.XGBClassifier(n_estimators=300, max_depth=3, learning_rate=0.03, subsample=0.8, colsample_bytree=0.8, min_child_weight=5, eval_metric="logloss"))

lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=4000, C=0.5)).fit(X, y)
coef = pd.Series(lr[-1].coef_[0], F).sort_values()
print("\nstandardized logit coefficients\n", coef.round(3).to_string())
m = xgb.XGBClassifier(n_estimators=300, max_depth=3, learning_rate=0.03, subsample=0.8, colsample_bytree=0.8, min_child_weight=5).fit(X, y)
imp = pd.Series(m.get_booster().get_score(importance_type="gain")); imp.index = [F[int(k[1:])] for k in imp.index]
print("\nxgb gain\n", imp.sort_values(ascending=False).round(1).to_string())
cp.to_parquet("work/checkpoints_scored.parquet")
