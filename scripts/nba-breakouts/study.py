import json, os
import numpy as np, pandas as pd
WORK = "work"
g = pd.read_parquet(f"{WORK}/games.parquet"); meta = pd.read_parquet(f"{WORK}/players.parquet").set_index("player_id")
cp = pd.read_parquet(f"{WORK}/checkpoints.parquet")
pd.set_option("display.width", 250); pd.set_option("display.max_rows", 200)

print("=== Season-long: drafted outside top 110 (or undrafted), finished top 50 FPPG (>=50% of games)")
out = []
for s in range(2019, 2026):
    d = json.load(open(f"{WORK}/proj_{s}.json")); adp = {x["player_id"]: x["stats"].get("adp_std") for x in d}
    p = g[(g.season == s) & g.played]; tg = g[g.season == s].groupby("team").game_id.nunique().median()
    t = p.groupby("player_id").agg(gp=("fp", "size"), fppg=("fp", "mean"), mpg=("min", "mean"))
    t = t[t.gp >= 0.5 * tg]; t["rank"] = t.fppg.rank(ascending=False)
    pr = g[(g.season == s - 1) & g.played].groupby("player_id").agg(pgp=("fp","size"), pfppg=("fp", "mean"), pmpg=("min", "mean"))
    for pid, r in t[t["rank"] <= 50].iterrows():
        a = adp.get(pid) or 999
        if a > 110:
            q = pr.loc[pid] if pid in pr.index else None
            out.append(dict(season=s, name=meta.name.get(pid), rank=int(r["rank"]), fppg=round(r.fppg,1), mpg=round(r.mpg,1),
                            adp=None if a >= 999 else a, prev_fppg=None if q is None else round(q.pfppg,1), prev_mpg=None if q is None else round(q.pmpg,1)))
so = pd.DataFrame(out); print(so.to_string(index=False)); so.to_csv(f"{WORK}/season_breakouts.csv", index=False)

print("\n=== In-season: distinct breakout players (first week they were on waivers and later top-60)")
b = cp[cp.breakout].sort_values("week").groupby(["season","player_id"]).first().reset_index()
print(len(b), "player-seasons;", cp.groupby(["season","player_id"]).ngroups, "player-seasons in the pool")

base = cp.breakout.mean()
def lift(col, bins, labels=None):
    c = pd.cut(cp[col], bins, labels=labels)
    r = cp.groupby(c, observed=True).breakout.agg(n="size", rate="mean"); r["x_base"] = r.rate / base
    print(f"\n-- {col}"); print(r.round(4).to_string())
print(f"\nbase rate {base:.4f}")
lift("role_fppg", [-99, 10, 15, 20, 25, 30, 99])
lift("fp_per_min", [0, .5, .6, .7, .8, .9, 5])
lift("min3", [0, 15, 20, 25, 30, 35, 60])
lift("min_jump", [-60, -3, 3, 6, 10, 60])
lift("fp3", [-99, 10, 15, 20, 25, 30, 99])
lift("usage_per_min", [0, .3, .4, .5, .6, 5])
lift("vacated", [-1, 1, 20, 40, 70, 300])
lift("prior_fppg", [-99, 10, 15, 20, 25, 99])
lift("age", [0, 21, 23, 25, 28, 31, 50])
lift("seasons_in", [0, 1, 2, 3, 5, 20])
lift("gp_share", [0, .5, .8, 1.01])
lift("rank_now", [0, 120, 160, 220, 999])
print(cp.groupby("traded").breakout.agg(["size","mean"]))
print(cp.groupby("undrafted").breakout.agg(["size","mean"]))
