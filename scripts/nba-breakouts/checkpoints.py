"""Build work/checkpoints.parquet: for every season (2019-2025, the years Sleeper has ADP) and every
week, each player who's probably on waivers, what he looked like through that week, and whether he
was a top-60 fantasy player per game for the rest of the season.

"Probably on waivers" in a 10-team, 11-man league (~110 rostered): drafted outside the top 110 (or
undrafted) and not already a top-80 scorer per game this season."""
import json
import os

import numpy as np
import pandas as pd

WORK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work")
ROSTERED = 110
ALREADY_GOOD = 80
TOP = 60
SEASONS = range(2019, 2026)

g = pd.read_parquet(os.path.join(WORK, "games.parquet"))
meta = pd.read_parquet(os.path.join(WORK, "players.parquet")).set_index("player_id")


def adp_of(season):
    d = json.load(open(os.path.join(WORK, f"proj_{season}.json")))
    out = {}
    for x in d:
        a = x["stats"].get("adp_std")
        if a and a < 999:
            out[x["player_id"]] = a
    return out


def season_totals(df):
    p = df[df.played]
    t = p.groupby("player_id").agg(gp=("fp", "size"), fp=("fp", "sum"), min=("min", "sum"))
    t["fppg"] = t.fp / t.gp
    t["mpg"] = t["min"] / t.gp
    return t


def team_vacated(before, mpg):
    """Minutes per game of each team's regulars (20+ mpg over 5+ games) who sat both of the
    team's last two games, or have left the team."""
    out = {}
    for team, tg in before.groupby("team"):
        dates = sorted(tg.date.unique())[-2:]
        recent = tg[tg.date.isin(dates) & tg.played].player_id.unique()
        regs = mpg[(mpg.team == team) & (mpg.mpg >= 20) & (mpg.gp >= 5)]
        out[team] = regs[~regs.index.isin(recent)].mpg.sum()
    return out


rows = []
for season in SEASONS:
    s = g[g.season == season].sort_values("date")
    adp = adp_of(season)
    prior = season_totals(g[g.season == season - 1])
    first_season = g[g.played].groupby("player_id").season.min()
    league_rate = s[s.played].fp.sum() / s[s.played]["min"].sum()
    last_week = s.week.max()
    start = s.date.min()
    for week in range(2, last_week - 3):
        before, after = s[s.week <= week], s[s.week > week]
        pb = before[before.played]
        if pb.empty:
            continue
        t = season_totals(before)
        t["team"] = pb.groupby("player_id").team.last()
        t["first_team"] = pb.groupby("player_id").team.first()
        # rank against everyone with a couple of games, the way a manager scanning the leaderboard would
        ranked = t[t.gp >= 2].fppg.rank(ascending=False)
        t["rank_now"] = ranked
        vac = team_vacated(before, t)
        team_gp = before.groupby("team").game_id.nunique()

        last3 = pb.groupby("player_id").tail(3).groupby("player_id")
        l3 = last3.agg(min3=("min", "mean"), fp3=("fp", "mean"))
        l3["starterish3"] = last3["min"].apply(lambda m: (m >= 28).mean())
        usage = pb.assign(u=pb.fga + 0.44 * pb.fta + pb.to).groupby("player_id").u.sum()
        tpm = pb.groupby("player_id").tpm.sum()
        stocks = pb.assign(k=pb.stl + pb.blk).groupby("player_id").k.sum()
        reb = pb.groupby("player_id").reb.sum()
        ast = pb.groupby("player_id").ast.sum()

        # rest of season: top-60 per game among players who played a fair share of it
        ros = season_totals(after)
        ros_team_g = after.groupby("team").game_id.nunique().median()
        q = ros[ros.gp >= max(8, 0.4 * ros_team_g)]
        ros_rank = q.fppg.rank(ascending=False)

        for pid, r in t.iterrows():
            if r.gp < 2:
                continue
            a = adp.get(pid)
            if (a is not None and a <= ROSTERED) or r.rank_now <= ALREADY_GOOD:
                continue
            m = meta.loc[pid] if pid in meta.index else None
            birth = pd.to_datetime(m["birth"]) if m is not None and m["birth"] else None
            k = 120.0  # shrink per-minute rates toward league average by 120 minutes
            rate = (r.fp + k * league_rate) / (r["min"] + k)
            l = l3.loc[pid]
            pr = prior.loc[pid] if pid in prior.index else None
            rows.append({
                "season": season, "week": week, "player_id": pid,
                "name": m["name"] if m is not None else pid, "pos": m["pos"] if m is not None else None,
                "team": r.team, "adp": a if a is not None else np.nan, "undrafted": a is None,
                "rank_now": r.rank_now, "gp": r.gp, "gp_share": r.gp / team_gp.get(r.team, r.gp),
                "fppg": r.fppg, "mpg": r.mpg, "fp_per_min": rate,
                "min3": l.min3, "fp3": l.fp3, "min_jump": l.min3 - r.mpg, "starterish3": l.starterish3,
                "role_fppg": rate * l.min3,
                "usage_per_min": usage[pid] / max(r["min"], 1), "tpm_pg": tpm[pid] / r.gp,
                "stocks_pg": stocks[pid] / r.gp, "reb_pg": reb[pid] / r.gp, "ast_pg": ast[pid] / r.gp,
                "vacated": vac.get(r.team, 0.0) - (r.mpg if r.mpg >= 20 and pid not in pb[pb.date.isin(sorted(before[before.team == r.team].date.unique())[-2:])].player_id.values else 0),
                "traded": r.team != r.first_team,
                "prior_fppg": pr.fppg if pr is not None else np.nan,
                "prior_mpg": pr.mpg if pr is not None else np.nan,
                "seasons_in": season - first_season.get(pid, season) + 1,
                "age": (start - birth).days / 365.25 if birth is not None else np.nan,
                "ros_gp": ros.gp.get(pid, 0), "ros_fppg": ros.fppg.get(pid, np.nan),
                "ros_rank": ros_rank.get(pid, np.nan),
                "breakout": bool(ros_rank.get(pid, 999) <= TOP),
            })
    print(season, len(rows))

cp = pd.DataFrame(rows)
cp.to_parquet(os.path.join(WORK, "checkpoints.parquet"))
print(cp.groupby("season").breakout.agg(["size", "sum", "mean"]))
