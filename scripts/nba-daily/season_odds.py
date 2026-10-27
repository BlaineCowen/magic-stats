#!/usr/bin/env python3
"""Playoff and title odds for the LLC crabsketball league.

  scripts/fourth-down/.venv/bin/python scripts/nba-daily/season_odds.py [--sims N]

Monte Carlo over the rest of the regular season (weeks 1-21) and the playoff
bracket (weeks 22-24). League rules, checked against the 2023-2025 brackets:
top 6 by record make it (points for breaks ties), seeds 1-2 get byes, round 1
is 3 v 6 and 4 v 5, then the bracket reseeds so the 1 seed plays the lowest
seed left.

A team's week: its best 8 starters from the current roster, each worth what
plan.Slot expects from locking well over his games that week, with last
season's game-to-game spread. Week 1 calibrates the level to what managers
actually score.

Give-ups: in 2023-2025, teams far out of 6th late in the season often stopped
managing (e.g. 0.97 -> 0.58 of the league average after week 15). Each week
from week 8 a team that's 2+ games out of 6th may quit; a quit team stays quit
and scores QUIT_FACTOR of its normal level. The output carries odds with and
without give-ups.

Writes /DATA/AppData/nfl-draft/html/csv/nba_league_odds.json, shown as the
"Odds" view on /nfl/nba/.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
from scipy.optimize import linear_sum_assignment

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, "/DATA/AppData/nfl-draft/scripts")
import plan  # noqa: E402
from refresh_nba_values import LEAGUE_ID, POS_QS, POSITIONS, SEASON, SLOT_ELIGIBLE, api, fp  # noqa: E402
from refresh_trade_values import atomic_write, fetch_json  # noqa: E402

OUT = os.environ.get("NBA_ODDS_OUT", "/DATA/AppData/nfl-draft/html/csv/nba_league_odds.json")
SLOTS = ["PG", "SG", "G", "SF", "PF", "F", "C", "UTIL"]
LAST_REG, PO_START = 21, 22
WEEK_SD = 0.24          # team-week score SD / mean, 2023-2025 after team and week effects
TEAM_SD = 0.07          # lasting miss on a team's level (roster moves, manager skill)
QUIT_FROM = 8           # nobody gives up before this week
QUIT_FACTOR = 0.72      # quit teams' late-season scoring vs their earlier pace, 2023-2025
QUIT_HAZARD = [         # (games out of 6th, weekly chance of quitting); eliminated = 0.35
    (3, 0.12), (2, 0.05),
]
QUIT_ELIM = 0.35
GAVE_UP_GAP = 0.10      # a season this far below the league's lineup rate counts as giving up
SKILL_SHRINK = 1.5      # pull a manager's lineup rate toward average, in seasons
LINEUP_LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lineup_log.json")


def pts_of(st, k):
    return st.get(k, 0) + st.get(k + "_decimal", 0) / 100


def lineup_history(league):
    """Each manager's points as a share of Sleeper's best possible lineup
    ("max points"), for every past season of this league."""
    out, lid = {}, league.get("previous_league_id")
    while lid and lid != "0":
        lg = fetch_json(f"https://api.sleeper.app/v1/league/{lid}")
        names = {u["user_id"]: u["display_name"] for u in fetch_json(f"https://api.sleeper.app/v1/league/{lid}/users")}
        rows = []
        for r in fetch_json(f"https://api.sleeper.app/v1/league/{lid}/rosters"):
            st = r["settings"]
            if pts_of(st, "ppts") > 0:
                rows.append((r["owner_id"], st["wins"], pts_of(st, "fpts"), pts_of(st, "ppts")))
        avg = float(np.mean([f / m for _, _, f, m in rows]))
        # The average among managers who kept trying, so a newcomer's 1.0 means typical.
        avg = float(np.mean([f / m for _, _, f, m in rows if f / m >= avg - GAVE_UP_GAP]))
        for uid, w, f, m in rows:
            out.setdefault(uid, {"name": names.get(uid, uid), "seasons": {}})["seasons"][lg["season"]] = {
                "eff": round(f / m, 4), "rel": round(f / m / avg, 4), "wins": w, "pts": round(f), "max": round(m),
                "gave_up": f / m < avg - GAVE_UP_GAP, "league": round(avg, 4)}
        lid = lg.get("previous_league_id")
    return out


def games_by_week(sched, cur, today):
    """{week: {team: [game date, ...]}} for games not yet started."""
    out = {}
    for g in sched:
        w = g["week"]
        if w < cur or (w == cur and (g["status"] != "pre_game" or g["date"] < today)):
            continue
        for side in ("home", "away"):
            out.setdefault(w, {}).setdefault(g[side]["team"], []).append(g["date"])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sims", type=int, default=20000)
    args = ap.parse_args()
    plan.N = 4000           # Slot.simulate draws, only used for each slot's spread
    rng = np.random.default_rng(11)
    today = datetime.now(plan.TZ).date().isoformat()

    league = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}")
    scoring = {k: v for k, v in league["scoring_settings"].items() if v}
    s = league["settings"]
    assert (s["playoff_teams"], s["playoff_week_start"]) == (6, PO_START), "league settings changed"
    state = fetch_json("https://api.sleeper.app/v1/state/nba")
    cur = state["week"] if state["season_type"] == "regular" else PO_START
    users = {u["user_id"]: u["display_name"] for u in fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/users")}
    rosters = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/rosters")
    rids = sorted(r["roster_id"] for r in rosters)
    idx = {rid: i for i, rid in enumerate(rids)}
    T = len(rids)
    owner = {r["roster_id"]: users.get(r["owner_id"], f"Team {r['roster_id']}") for r in rosters}

    # Lineup skill: past seasons' share of max points vs the league, skipping
    # seasons the manager gave up, pulled toward average.
    hist = lineup_history(league)
    skill, lineups = {}, []
    for r in rosters:
        h = hist.get(r["owner_id"], {"seasons": {}})
        tried = [x["rel"] for x in h["seasons"].values() if not x["gave_up"]]
        n = len(tried)
        skill[r["roster_id"]] = 1 + (np.mean(tried) - 1) * n / (n + SKILL_SHRINK) if n else 1.0
        st = r["settings"]
        lineups.append({"roster_id": r["roster_id"], "team": owner[r["roster_id"]],
                        "seasons": dict(sorted(h["seasons"].items())),
                        "now": {"pts": round(pts_of(st, "fpts")), "max": round(pts_of(st, "ppts")),
                                "eff": round(pts_of(st, "fpts") / pts_of(st, "ppts"), 4) if pts_of(st, "ppts") else None},
                        "skill": round(float(skill[r["roster_id"]]), 4)})
    active = {r["roster_id"]: [p for p in (r.get("players") or []) if p not in set(r.get("reserve") or [])]
              for r in rosters}
    sched = api(f"/schedule/nba/regular/{SEASON}")
    left = games_by_week(sched, cur, today)
    weeks = {w: fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/matchups/{w}")
             for w in range(1, LAST_REG + 1)}

    values = {p["id"]: p for p in json.load(open(plan.VALUES))["players"]}
    shape = plan.load_shapes(scoring)
    proj_rows = api(f"/projections/nba/{SEASON}/{cur}?season_type=regular&{POS_QS}")
    info, proj_mean = {}, {}
    for r in proj_rows:
        info[r["player_id"]] = r["player"] | {"team": r.get("team") or r["player"].get("team")}
        st = r.get("stats") or {}
        if (st.get("sp") or 0) > 0:
            proj_mean.setdefault(r["player_id"], []).append(fp(st, scoring))

    def pinfo(pid):
        i, v = info.get(pid, {}), values.get(pid, {})
        mean = v.get("fppg") or (np.mean(proj_mean[pid]) if pid in proj_mean else 0.0)
        pos = [p for p in (i.get("fantasy_positions") or v.get("pos") or []) if p in POSITIONS]
        avail = min(0.96, (v.get("egp") or 70) / 82)
        return {"team": i.get("team") or v.get("team"), "pos": pos, "mean": float(mean),
                "avail": avail, "injury": i.get("injury_status")}
    P = {pid: pinfo(pid) for ps in active.values() for pid in ps}

    slot_cache = {}

    def slot_stats(pid, dates, wk, current=None):
        """(mean, var) of a slot holding pid for the week's remaining games."""
        p = P[pid]
        n = len(dates)
        key = (pid, n, wk <= cur + 1, wk < cur, current)
        if key in slot_cache:
            return slot_cache[key]
        if p["mean"] <= 0 or (n == 0 and current is None):
            res = (float(current or 0.0), 0.0)
        else:
            games = []
            for k in range(n):
                pp = plan.play_prob(p["injury"], k == 0) if wk <= cur + 1 else p["avail"]
                games.append({"mean": p["mean"], "p": pp,
                              "xs": np.maximum(shape(pid, max(p["mean"], 1.0)) * p["mean"], -5.0)})
            sl = plan.Slot("", pid, current, False, games)
            x = sl.simulate(rng)
            res = (float(x.mean()), float(x.var()))
        slot_cache[key] = res
        return res

    def best_lineup(players, wk, teamgames=None):
        """Mean and variance of a team's week from its best 8 starters."""
        teamgames = left.get(wk, {}) if teamgames is None else teamgames
        stats = {pid: slot_stats(pid, teamgames.get(P[pid]["team"], []), wk) for pid in players}
        cands = [pid for pid in players if P[pid]["pos"]]
        if not cands:
            return 0.0, 0.0
        cost = np.full((len(SLOTS), len(cands)), 1e6)
        for i, sl in enumerate(SLOTS):
            for j, pid in enumerate(cands):
                if set(P[pid]["pos"]) & SLOT_ELIGIBLE[sl]:
                    cost[i, j] = -stats[pid][0]
        ri, ci = linear_sum_assignment(cost)
        picks = [cands[j] for i, j in zip(ri, ci) if cost[i, j] < 1e5]
        return sum(stats[p][0] for p in picks), sum(stats[p][1] for p in picks)

    # Played weeks: Sleeper's official standings. The matchups endpoint can show
    # each starter's latest game instead of his locked one, so its points disagree.
    rs = {r["roster_id"]: r["settings"] for r in rosters}
    wins = np.array([rs[r]["wins"] + 0.5 * rs[r].get("ties", 0) for r in rids], float)
    pf = np.array([rs[r]["fpts"] + rs[r].get("fpts_decimal", 0) / 100 for r in rids])
    played = int(round((wins.sum() * 2) / T))

    # Level calibration: the model's full weeks so far vs what teams scored.
    if played:
        full = {}
        for g in sched:
            if g["week"] <= played:
                for side in ("home", "away"):
                    full.setdefault(g["week"], {}).setdefault(g[side]["team"], []).append(g["date"])
        model = np.zeros(T)
        for w in range(1, played + 1):
            model += [best_lineup(active[r], w, full[w])[0] for r in rids]
        model *= [skill[r] for r in rids]
        calib = float(pf.sum() / model.sum())
        print("so far actual vs model:", ", ".join(f"{owner[r][:8]} {a:.0f}/{m * calib:.0f}" for r, a, m in zip(rids, pf, model)),
              f"r={np.corrcoef(pf, model)[0, 1]:.2f}", file=sys.stderr)
    else:
        calib = 1.0
    slot_cache.clear()

    # Mean and SD of each team's remaining weeks.
    mean, sd = {}, {}
    for w in range(cur, PO_START + 3):
        mu, var = np.zeros(T), np.zeros(T)
        if w == cur and cur <= LAST_REG:
            # Live week: each starter's counted score so far, plus his games left.
            live = {t["roster_id"]: t for t in weeks[w]}
            teamgames = left.get(w, {})
            for r in rids:
                t = live[r]
                for pid, pts in zip(t["starters"], t["starters_points"]):
                    if pid == "0":
                        continue
                    P.setdefault(pid, pinfo(pid))
                    m, v = slot_stats(pid, teamgames.get(P[pid]["team"], []), w, current=pts or None)
                    mu[idx[r]] += m
                    var[idx[r]] += v
        else:
            for r in rids:
                mu[idx[r]], var[idx[r]] = best_lineup(active[r], w)
        mu *= calib * np.array([skill[r] for r in rids])
        # Lock-in spread from the slot sims, topped up to the league's history.
        sd[w] = np.sqrt(np.maximum(var * calib ** 2, (WEEK_SD * mu) ** 2))
        mean[w] = mu
        print(f"week {w}: mean {mu.mean():.0f}, sd {sd[w].mean():.0f}", file=sys.stderr)

    N = args.sims
    team_fx = rng.normal(0, TEAM_SD, (N, T))
    z_reg = rng.normal(0, 1, (LAST_REG + 1, N, T))
    z_po = rng.normal(0, 1, (3, N, T))
    u_quit = rng.random((LAST_REG + 1, N, T))
    rows = np.arange(N)

    def season(decay):
        W = np.tile(wins, (N, 1))
        PF = np.tile(pf, (N, 1))
        quit = np.zeros((N, T), bool)
        quit_wk = np.full((N, T), 99)
        vs_quit = np.zeros((N, T))      # games against a team that has quit
        for w in range(played + 1, LAST_REG + 1):
            if decay and w >= QUIT_FROM:
                sixth = -np.sort(-W, axis=1)[:, 5:6]
                gb = sixth - W
                h = np.where(gb > LAST_REG - w + 1, QUIT_ELIM, 0.0)
                for g, p in QUIT_HAZARD:
                    h = np.where((h == 0) & (gb >= g), p, h)
                new = ~quit & (u_quit[w] < h)
                quit_wk[new] = w
                quit |= new
            if w < cur:
                # Finished, but not yet in Sleeper's standings.
                sc = np.tile([next(t["points"] for t in weeks[w] if t["roster_id"] == r) for r in rids], (N, 1)).astype(float)
            else:
                sc = (mean[w] * (1 + team_fx) + z_reg[w] * sd[w]) * np.where(quit, QUIT_FACTOR, 1.0)
            if w == cur:
                sc = np.maximum(sc, 0)
            PF += sc
            by = {}
            for t in weeks[w]:
                by.setdefault(t["matchup_id"], []).append(idx[t["roster_id"]])
            for a, b in by.values():
                W[:, a] += (sc[:, a] > sc[:, b])
                W[:, b] += (sc[:, b] > sc[:, a])
                vs_quit[:, a] += quit[:, b]
                vs_quit[:, b] += quit[:, a]

        order = np.argsort(-(W * 1e5 + PF), axis=1)
        seeds = order[:, :6]

        def game(k, a, b):
            w = PO_START + k
            sc = (mean[w] * (1 + team_fx) + z_po[k] * sd[w]) * np.where(quit, QUIT_FACTOR, 1.0)
            return np.where(sc[rows, a] >= sc[rows, b], a, b)
        s1, s2, s3, s4, s5, s6 = seeds.T
        # Round 1, then reseed: the 1 seed gets the lowest seed left.
        w36, w45 = game(0, s3, s6), game(0, s4, s5)
        rank = np.empty((N, T), int)
        np.put_along_axis(rank, seeds, np.arange(6), 1)
        r36, r45 = rank[rows, w36], rank[rows, w45]
        low = np.where(r36 > r45, w36, w45)
        high = np.where(r36 > r45, w45, w36)
        f1, f2 = game(1, s1, low), game(1, s2, high)
        champ = game(2, f1, f2)

        out = []
        for r in rids:
            i = idx[r]
            out.append({
                "roster_id": r,
                "proj_wins": round(float(W[:, i].mean()), 2),
                "proj_pf": round(float(PF[:, i].mean()), 1),
                "playoffs": float((seeds == i).any(axis=1).mean()),
                "bye": float(((s1 == i) | (s2 == i)).mean()),
                "seeds": [round(float((seeds[:, k] == i).mean()), 4) for k in range(6)],
                "final": float(((f1 == i) | (f2 == i)).mean()),
                "champ": float((champ == i).mean()),
                "quit": float(quit[:, i].mean()),
                "quit_by14": float((quit_wk[:, i] <= 14).mean()),
                "vs_quit": round(float(vs_quit[:, i].mean()), 2),
            })
        n_quit = quit.sum(axis=1)
        return out, {"avg_quitters": round(float(n_quit.mean()), 2),
                     "quitters_dist": [round(float((n_quit == k).mean()), 3) for k in range(5)]}

    with_q, qstats = season(True)
    without, _ = season(False)
    weekly = {r: round(float(np.mean([mean[w][idx[r]] for w in range(cur + 1, LAST_REG + 1)] or [0])), 1) for r in rids}

    teams = []
    for a, b in zip(with_q, without):
        r = a["roster_id"]
        i = idx[r]
        teams.append({"roster_id": r, "team": owner[r],
                      "wins": float(wins[i]), "losses": float(rs[r]["losses"] + 0.5 * rs[r].get("ties", 0)),
                      "pf": round(float(pf[i]), 1), "weekly_proj": weekly[r],
                      "decay": {k: v for k, v in a.items() if k != "roster_id"},
                      "no_decay": {k: v for k, v in b.items() if k not in ("roster_id", "quit", "quit_by14", "vs_quit")}})
    teams.sort(key=lambda t: (-t["decay"]["champ"], -t["decay"]["playoffs"]))
    # Sleeper only keeps season totals of max points, so log them each run to
    # get week-by-week lineup rates from here on.
    try:
        log = json.load(open(LINEUP_LOG))
    except (OSError, ValueError):
        log = {}
    if played:
        log[str(played)] = {str(r["roster_id"]): [pts_of(r["settings"], "fpts"), pts_of(r["settings"], "ppts")] for r in rosters}
        atomic_write(LINEUP_LOG, json.dumps(log))
    for L in lineups:
        k, prev, wk = str(L["roster_id"]), [0.0, 0.0], {}
        for n in sorted(log, key=int):
            f, m = log[n].get(k, prev)
            if m > prev[1] and int(n) <= played:
                wk[n] = round((f - prev[0]) / (m - prev[1]), 4)
            prev = [f, m]
        L["weeks"] = wk

    res = {
        "league": league["name"], "season": SEASON, "week": cur,
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sims": N, "calib": round(calib, 3), "week_sd": WEEK_SD, "team_sd": TEAM_SD,
        "quit": {"from_week": QUIT_FROM, "factor": QUIT_FACTOR, "elim": QUIT_ELIM,
                 "hazard": [{"games_back": g, "p": p} for g, p in QUIT_HAZARD], **qstats},
        "teams": teams,
        "lineups": sorted(lineups, key=lambda L: -L["skill"]),
        "gave_up_gap": GAVE_UP_GAP,
    }
    atomic_write(OUT, json.dumps(res, indent=1, allow_nan=False))
    print(f"week {cur}, calib {calib:.3f}, quitters {qstats}", file=sys.stderr)
    for t in teams:
        d, n = t["decay"], t["no_decay"]
        print(f"{t['team'][:18]:18} {t['wins']:.0f}-{t['losses']:.0f} wk~{t['weekly_proj']:5.1f}  W {d['proj_wins']:4.1f}/{n['proj_wins']:4.1f}"
              f"  PO {d['playoffs']:6.1%}/{n['playoffs']:6.1%}  bye {d['bye']:5.1%}  champ {d['champ']:5.1%}/{n['champ']:5.1%}"
              f"  quit {d['quit']:5.1%}  vsQ {d['vs_quit']:.2f}", file=sys.stderr)


if __name__ == "__main__":
    main()
