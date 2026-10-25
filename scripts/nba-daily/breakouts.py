#!/usr/bin/env python3
"""Breakout watch for the LLC crabsketball league.

  scripts/fourth-down/.venv/bin/python scripts/nba-daily/breakouts.py

A breakout is mostly a good per-minute player getting more minutes, so for
every player this works out:
  * Points per minute under the league's scoring, shrunk toward his 2025 rate
    (and the league average) so a hot 40 minutes doesn't look like a new star.
  * Minutes: season average, last 3 games, and Sleeper's projection for his
    next game.
  * Role points: points per minute x minutes. "Now" uses the last 3 games,
    "projected" uses Sleeper's minutes. A role well above his season average
    is the early sign.
  * Breakout chance: the chance he's a top-60 player per game for the rest of
    the season, from the logistic model in scripts/nba-breakouts (fit on
    2019-2025 waiver players, season holdout AUC 0.94). Its biggest inputs are
    role points over the last 3 games and playing center.

Writes /DATA/AppData/nfl-draft/html/csv/nba_breakouts.json for the
"Breakouts" view of /nfl/nba/.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, "/DATA/AppData/nfl-draft/scripts")
from refresh_nba_values import LAST, LEAGUE_ID, POS_QS, POSITIONS, SEASON, api, fp, name_of  # noqa: E402
from refresh_trade_values import atomic_write, fetch_json  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
STUDY = os.path.join(HERE, "..", "nba-breakouts", "work")
OUT = os.environ.get("NBA_BREAKOUTS_OUT", "/DATA/AppData/nfl-draft/html/csv/nba_breakouts.json")
TZ = ZoneInfo("America/Chicago")
ME = "bcows827"
K_LEAGUE = 120.0    # minutes of league-average play mixed into last season's rate
K_PRIOR = 150.0     # minutes of last season's rate mixed into this season's
# Same inputs as scripts/nba-breakouts/model.py.
F = ["role_fppg", "fp_per_min", "min3", "min_jump", "fp3", "fppg", "mpg", "usage_per_min", "vacated", "prior_fppg_f",
     "prior_missing", "age_f", "gp_share", "starterish3", "big", "traded_i", "undrafted_i", "reb_pg", "stocks_pg",
     "ast_pg", "tpm_pg", "week"]


def model_inputs(df):
    df = df.copy()
    df["big"] = (df.pos == "C").astype(int)
    df["prior_missing"] = df.prior_fppg.isna().astype(int)
    df["prior_fppg_f"] = df.prior_fppg.fillna(8)
    df["age_f"] = df.age.fillna(26)
    df["traded_i"] = df.traded.astype(int)
    df["undrafted_i"] = df.undrafted.astype(int)
    return df[F].fillna(0).values


def fit_model():
    cp = pd.read_parquet(os.path.join(STUDY, "checkpoints.parquet"))
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=4000, C=0.5)).fit(model_inputs(cp), cp.breakout.values)


def game_rows(rows, scoring):
    out = []
    for r in rows:
        s = r.get("stats") or {}
        if not r.get("game_id") or not r.get("team"):
            continue
        out.append({"player_id": r["player_id"], "game_id": r["game_id"], "date": r["date"], "team": r["team"],
                    "min": (s.get("sp") or 0) / 60, "fp": fp(s, scoring),
                    "fga": s.get("fga") or 0, "fta": s.get("fta") or 0, "to": s.get("to") or 0,
                    "tpm": s.get("tpm") or 0, "stl": s.get("stl") or 0, "blk": s.get("blk") or 0,
                    "reb": s.get("reb") or 0, "ast": s.get("ast") or 0})
    return out


def load_season(season, scoring, last_week, cache):
    rows = []
    for week in range(1, last_week + 1):
        try:
            data = api(f"/stats/nba/{season}/{week}?season_type=regular&{POS_QS}",
                       cache_as=f"nba_{season}_w{week:02d}.json" if cache(week) else None)
        except Exception:
            break
        if not data and season == LAST:
            break
        rows += game_rows(data, scoring)
    g = pd.DataFrame(rows).drop_duplicates(["player_id", "game_id"])
    g["date"] = pd.to_datetime(g["date"])
    g["played"] = g["min"] > 0
    return g.sort_values("date")


def main():
    today = datetime.now(TZ).date().isoformat()
    league = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}")
    scoring = {k: v for k, v in league["scoring_settings"].items() if v}
    users = {u["user_id"]: u for u in fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/users")}
    rosters = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/rosters")
    owner = {}
    for r in rosters:
        u = users.get(r["owner_id"], {})
        for pid in r.get("players") or []:
            owner[pid] = "me" if u.get("display_name") == ME else (u.get("metadata") or {}).get("team_name") or u.get("display_name") or "?"

    sched = api(f"/schedule/nba/regular/{SEASON}")
    week_end = defaultdict(str)
    for g in sched:
        week_end[g["week"]] = max(week_end[g["week"]], g["date"])
    weeks = sorted(week_end)
    cur = next((w for w in weeks if week_end[w] >= today), weeks[-1])
    # Weeks that ended a few days ago won't get stat fixes any more, so cache them.
    cutoff = (date.fromisoformat(today) - timedelta(days=3)).isoformat()
    settled = lambda w: week_end[w] < cutoff  # noqa: E731
    g = load_season(SEASON, scoring, cur, settled)
    prev = load_season(LAST, scoring, 30, lambda w: True)

    # Upcoming projected minutes and points: this week's and next week's rows from today on.
    info, upcoming = {}, defaultdict(list)
    for w in (cur, cur + 1):
        if w not in week_end:
            continue
        for r in api(f"/projections/nba/{SEASON}/{w}?season_type=regular&{POS_QS}"):
            info.setdefault(r["player_id"], r.get("player") or {})
            if r.get("date", "") >= today:
                s = r.get("stats") or {}
                upcoming[r["player_id"]].append((r["date"], (s.get("sp") or 0) / 60, fp(s, scoring)))
    for r in api(f"/stats/nba/{SEASON}/{cur}?season_type=regular&{POS_QS}"):
        info[r["player_id"]] = r.get("player") or info.get(r["player_id"], {})
    meta = json.load(open(os.path.join(STUDY, "players.json")))
    adp = {x["player_id"]: x["stats"]["adp_std"] for x in json.load(open(os.path.join(STUDY, f"proj_{SEASON}.json")))
           if x["stats"].get("adp_std") and x["stats"]["adp_std"] < 999}

    p = g[g.played]
    league_rate = p.fp.sum() / p["min"].sum()
    pp = prev[prev.played]
    prior = pp.groupby("player_id").agg(gp=("fp", "size"), fp=("fp", "sum"), min=("min", "sum"))
    prior["fppg"], prior["mpg"] = prior.fp / prior.gp, prior["min"] / prior.gp
    prior["rate"] = (prior.fp + K_LEAGUE * league_rate) / (prior["min"] + K_LEAGUE)

    t = p.groupby("player_id").agg(gp=("fp", "size"), fp=("fp", "sum"), min=("min", "sum"),
                                   team=("team", "last"), first_team=("team", "first"))
    t["fppg"], t["mpg"] = t.fp / t.gp, t["min"] / t.gp
    ranked = t[t.gp >= 2].fppg.rank(ascending=False)
    team_gp = g.groupby("team").game_id.nunique()
    last3 = p.groupby("player_id").tail(3).groupby("player_id")
    l3 = last3.agg(min3=("min", "mean"), fp3=("fp", "mean"))
    l3["starterish3"] = last3["min"].apply(lambda m: (m >= 28).mean())
    sums = p.assign(u=p.fga + 0.44 * p.fta + p.to, k=p.stl + p.blk).groupby("player_id")[["u", "tpm", "k", "reb", "ast"]].sum()

    # Minutes of each team's regulars (20+ mpg, 5+ games) who sat its last two games.
    regs_out, sat = defaultdict(float), defaultdict(set)
    for team, tg in g.groupby("team"):
        dates = sorted(tg.date.unique())[-2:]
        recent = set(tg[tg.date.isin(dates) & tg.played].player_id)
        for pid in t[(t.team == team) & (t.mpg >= 20) & (t.gp >= 5)].index:
            if pid not in recent:
                regs_out[team] += t.mpg[pid]
                sat[team].add(pid)
    # For the page: teammates Sleeper lists as out, and the minutes they played.
    out_mins = defaultdict(list)
    for pid, i in info.items():
        if (i.get("injury_status") or "").lower() in ("out", "ir", "sus") and pid in t.index and t.mpg[pid] >= 15:
            out_mins[t.team[pid]].append((name_of(i), round(t.mpg[pid])))

    start = pd.Timestamp(g.date.min())
    week_feat = max(2, cur)
    rows = []
    for pid, r in t.iterrows():
        if r.gp < 2:
            continue
        m = meta.get(pid, {})
        i = info.get(pid, {})
        pos = m.get("position") or i.get("position")
        if pos not in POSITIONS:
            continue
        birth = m.get("birth_date")
        pr = prior.loc[pid] if pid in prior.index else None
        prior_rate = pr.rate if pr is not None else league_rate
        rate = (r.fp + K_PRIOR * prior_rate) / (r["min"] + K_PRIOR)
        l = l3.loc[pid]
        nxt = sorted(upcoming.get(pid, []))
        proj_min = nxt[0][1] if nxt else None
        rows.append({
            "player_id": pid, "name": name_of(i) or name_of(m) or pid, "pos": pos,
            "elig": [x for x in (i.get("fantasy_positions") or m.get("fantasy_positions") or [pos]) if x in POSITIONS],
            "team": r.team, "injury": i.get("injury_status"), "owner": owner.get(pid),
            "adp": adp.get(pid, np.nan), "undrafted": pid not in adp, "rank_now": ranked.get(pid, np.nan),
            "gp": r.gp, "gp_share": r.gp / team_gp.get(r.team, r.gp), "fppg": r.fppg, "mpg": r.mpg,
            "fp_per_min": rate, "fpm_raw": r.fp / max(r["min"], 1), "prior_fpm": pr.rate if pr is not None else None,
            "min3": l.min3, "fp3": l.fp3, "min_jump": l.min3 - r.mpg, "starterish3": l.starterish3,
            "role_fppg": rate * l.min3, "proj_min": proj_min,
            "proj_role": rate * proj_min if proj_min else None,
            "proj_fp": nxt[0][2] if nxt else None, "games_left": len([x for x in nxt if x[0] <= week_end[cur]]),
            "usage_per_min": sums.u[pid] / max(r["min"], 1), "tpm_pg": sums.tpm[pid] / r.gp,
            "stocks_pg": sums.k[pid] / r.gp, "reb_pg": sums.reb[pid] / r.gp, "ast_pg": sums.ast[pid] / r.gp,
            "vacated": regs_out[r.team] - (r.mpg if pid in sat[r.team] else 0),
            "traded": r.team != r.first_team,
            "prior_fppg": pr.fppg if pr is not None else np.nan, "prior_mpg": pr.mpg if pr is not None else None,
            "age": (start - pd.Timestamp(birth)).days / 365.25 if birth else np.nan,
            "week": week_feat,
        })
    df = pd.DataFrame(rows)
    df["chance"] = fit_model().predict_proba(model_inputs(df))[:, 1]

    def r1(x, d=1):
        return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), d)

    players = []
    for _, x in df.sort_values("chance", ascending=False).iterrows():
        why = []
        if x.min_jump >= 4:
            why.append(f"Minutes up {x.min_jump:.0f} over his last 3")
        if x.proj_min and x.proj_min - x.mpg >= 4:
            why.append(f"Projected for {x.proj_min:.0f} min, up from {x.mpg:.0f}")
        if x.prior_mpg and x.mpg - x.prior_mpg >= 6:
            why.append(f"Playing {x.mpg - x.prior_mpg:.0f} more min than last season")
        if x.prior_fpm and x.fpm_raw - x.prior_fpm >= 0.15 and x.gp >= 3:
            why.append("More points per minute than last season")
        mates = [f"{n} ({mm})" for n, mm in out_mins.get(x.team, []) if n != x["name"]]
        if mates:
            why.append("Teammates out: " + ", ".join(mates[:3]))
        if x.traded:
            why.append("New team")
        players.append({
            "id": x.player_id, "name": x["name"], "pos": x.elig or [x.pos], "team": x.team, "injury": x.injury if isinstance(x.injury, str) else None,
            "owner": x.owner if isinstance(x.owner, str) else None, "rank": r1(x.rank_now, 0), "gp": int(x.gp),
            "fppg": r1(x.fppg), "fp3": r1(x.fp3), "fpm": r1(x.fp_per_min, 2), "fpm_raw": r1(x.fpm_raw, 2),
            "prior_fpm": r1(x.prior_fpm, 2), "mpg": r1(x.mpg), "min3": r1(x.min3), "proj_min": r1(x.proj_min),
            "prior_mpg": r1(x.prior_mpg), "role": r1(x.role_fppg), "proj_role": r1(x.proj_role),
            "proj_fp": r1(x.proj_fp), "games_left": int(x.games_left), "chance": round(float(x.chance), 4),
            "why": why,
        })
    atomic_write(OUT, json.dumps(allow_nan=False, obj={
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "date": today, "week": cur,
        "league_fpm": round(league_rate, 3), "top": 60, "players": players,
    }))
    print(f"{today}: {len(players)} players, {sum(1 for x in players if not x['owner'])} free agents")


if __name__ == "__main__":
    main()
