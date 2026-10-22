"""Flatten the Sleeper game logs into work/games.parquet: one row per player per team game,
with fantasy points under the LLC crabsketball scoring. Rows with no seconds played are kept as
DNPs (flag played=False) so we can tell when a regular sat out."""
import glob
import json
import os

import pandas as pd

WORK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work")
# read live from Sleeper by refresh_nba_values.py; copied here so the study is reproducible
SCORING = {"pts": 1, "reb": 1, "ast": 1, "stl": 1, "blk": 1, "to": -1,
           "fgm": 1, "fga": -1, "ftm": 1, "fta": -1}
KEEP = ["pts", "reb", "ast", "stl", "blk", "to", "fgm", "fga", "ftm", "fta", "tpm", "oreb", "pf"]

rows = []
for f in sorted(glob.glob(os.path.join(WORK, "games_*_w*.json"))):
    for x in json.load(open(f)):
        s = x["stats"]
        if not x.get("game_id") or not x.get("team"):
            continue
        r = {"season": int(x["season"]), "week": x["week"], "date": x["date"], "game_id": x["game_id"],
             "player_id": x["player_id"], "team": x["team"], "opp": x.get("opponent"),
             "min": (s.get("sp") or 0) / 60}
        for k in KEEP:
            r[k] = s.get(k) or 0.0
        rows.append(r)

g = pd.DataFrame(rows).drop_duplicates(["player_id", "game_id"])
g["date"] = pd.to_datetime(g["date"])
g["played"] = g["min"] > 0
g["fp"] = sum(g[k] * w for k, w in SCORING.items())

players = json.load(open(os.path.join(WORK, "players.json")))
meta = pd.DataFrame([{"player_id": k, "name": f"{v.get('first_name','')} {v.get('last_name','')}".strip(),
                      "pos": v.get("position"), "birth": v.get("birth_date"), "exp_now": v.get("years_exp")}
                     for k, v in players.items()])
# players who've left the league aren't in today's player list; take names from the logs
names = {}
for f in glob.glob(os.path.join(WORK, "games_*_w*.json")):
    for x in json.load(open(f)):
        p = x.get("player") or {}
        if p.get("last_name"):
            names[x["player_id"]] = (f"{p.get('first_name','')} {p['last_name']}".strip(), p.get("position"))
miss = [pid for pid in names if pid not in set(meta.player_id)]
meta = pd.concat([meta, pd.DataFrame([{"player_id": p, "name": names[p][0], "pos": names[p][1]} for p in miss])])
meta.to_parquet(os.path.join(WORK, "players.parquet"))
g.to_parquet(os.path.join(WORK, "games.parquet"))
print(g.groupby("season").agg(rows=("fp", "size"), played=("played", "sum"), games=("game_id", "nunique"),
                               fp_mean=("fp", lambda v: v[g.loc[v.index, "played"]].mean())))
