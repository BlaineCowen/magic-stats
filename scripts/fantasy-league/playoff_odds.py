"""Playoff and title odds for the H-Town Ballers Sleeper league.

Monte Carlo over the rest of the regular season and the playoff bracket.
Team weekly scores = Sleeper-projected optimal lineup (league scoring) plus
noise sized from this season's projection misses.

Seeding (league rule): top 4 by record (points-for breaks ties), seeds 5-6
are the two remaining teams with the most points for. Seeds 1-2 get byes.
Bracket is fixed: 1 v winner(4/5), 2 v winner(3/6), then the final.
"""
import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

LEAGUE = "1389362330239795200"
OUT = Path("/DATA/AppData/nfl-draft/html/csv/htown_playoff_odds.json")
SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "DEF"]
FLEX = {"RB", "WR", "TE"}
SF = {"QB", "RB", "WR", "TE"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
        return json.load(r)


def projections(season, week):
    """{player_id: (league pts, position, team)} for one week."""
    url = (f"https://api.sleeper.app/projections/nfl/{season}/{week}?season_type=regular"
           + "".join(f"&position[]={p}" for p in ["QB", "RB", "WR", "TE", "DEF"]))
    out = {}
    for row in get(url):
        st = row.get("stats") or {}
        pl = row.get("player") or {}
        # League is half PPR with -2 INT; Sleeper's half-PPR total uses -1.
        pts = (st.get("pts_half_ppr") or 0) - (st.get("pass_int") or 0)
        pos = (pl.get("fantasy_positions") or [pl.get("position")])[0]
        out[row["player_id"]] = (pts, pos, row.get("team") or pl.get("team"))
    return out


def best_lineup(players, proj):
    pool = sorted(((proj[p][0], proj[p][1], p) for p in players if p in proj and proj[p][0] > 0), reverse=True)
    used, total = set(), 0.0
    for slot in SLOTS:
        ok = FLEX if slot == "FLEX" else SF if slot == "SUPER_FLEX" else {slot}
        for pts, pos, pid in pool:
            if pid not in used and pos in ok:
                used.add(pid)
                total += pts
                break
    return total


def espn_pending(week, season):
    """Team codes whose game this week hasn't started."""
    d = get(f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week={week}&seasontype=2&dates={season}")
    fix = {"WSH": "WAS", "LAR": "LAR"}
    out = set()
    for e in d["events"]:
        if e["status"]["type"]["state"] == "pre":
            for c in e["competitions"][0]["competitors"]:
                a = c["team"]["abbreviation"]
                out.add(fix.get(a, a))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sims", type=int, default=50000)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    league = get(f"https://api.sleeper.app/v1/league/{LEAGUE}")
    state = get("https://api.sleeper.app/v1/state/nfl")
    season = league["season"]
    s = league["settings"]
    po_start = s["playoff_week_start"]
    last_reg = po_start - 1
    cur = state["week"] if state["season_type"] == "regular" else po_start
    users = {u["user_id"]: u["display_name"] for u in get(f"https://api.sleeper.app/v1/league/{LEAGUE}/users")}
    rosters = get(f"https://api.sleeper.app/v1/league/{LEAGUE}/rosters")
    rids = sorted(r["roster_id"] for r in rosters)
    idx = {rid: i for i, rid in enumerate(rids)}
    T = len(rids)
    players = {r["roster_id"]: set(r.get("players") or []) for r in rosters}
    owner = {r["roster_id"]: users.get(r["owner_id"], f"Team {r['roster_id']}") for r in rosters}

    # Completed weeks straight from matchups (Sleeper's roster W/L lags a live week).
    wins = np.zeros(T)
    pf = np.zeros(T)
    resid = []
    weeks = {}
    for w in range(1, last_reg + 1):
        weeks[w] = get(f"https://api.sleeper.app/v1/league/{LEAGUE}/matchups/{w}")
    for w in range(1, cur):
        m = weeks[w]
        proj = projections(season, w)
        by = {}
        for t in m:
            by.setdefault(t["matchup_id"], []).append(t)
            pf[idx[t["roster_id"]]] += t["points"]
            resid.append(t["points"] - sum(proj.get(p, (0,))[0] for p in t["starters"] if p != "0"))
        for a, b in by.values():
            if a["points"] == b["points"]:
                wins[idx[a["roster_id"]]] += .5; wins[idx[b["roster_id"]]] += .5
            else:
                wins[idx[(a if a["points"] > b["points"] else b)["roster_id"]]] += 1
    resid = np.array(resid)
    bias, sd = float(resid.mean()), float(resid.std(ddof=1))

    # Mean and SD of each team's remaining weekly scores.
    rng = np.random.default_rng(7)
    N = args.sims
    mean, spread = {}, {}
    pending = espn_pending(cur, season) if state["season_type"] == "regular" else set()
    for w in range(cur, po_start + 3):
        proj = projections(season, w)
        if w == cur and pending:
            # Live week: banked starter points + projections for starters yet to play.
            live = {t["roster_id"]: t for t in weeks[w]}
            mu, sg = np.zeros(T), np.zeros(T)
            for rid in rids:
                t = live[rid]
                for p, pts in zip(t["starters"], t["starters_points"]):
                    if p in proj and proj[p][2] in pending:
                        mu[idx[rid]] += proj[p][0] + bias / 9
                        sg[idx[rid]] += proj[p][0]
                    else:
                        mu[idx[rid]] += pts
            # Noise scales with the share of the lineup still to play.
            full = np.array([best_lineup(players[r], proj) for r in rids])
            spread[w] = sd * np.sqrt(np.clip(sg / np.maximum(full, 1), 0, 1))
            mean[w] = mu
        else:
            mean[w] = np.array([best_lineup(players[r], proj) for r in rids]) + bias
            spread[w] = np.full(T, sd)

    # Persistent team effect: projections miss the same way week to week.
    team_fx = rng.normal(0, sd * 0.35, (N, T))

    def score(w):
        return mean[w] + team_fx + rng.normal(0, 1, (N, T)) * spread[w]

    W = np.tile(wins, (N, 1))
    P = np.tile(pf, (N, 1))
    for w in range(cur, last_reg + 1):
        sc = score(w)
        P += sc
        by = {}
        for t in weeks[w]:
            by.setdefault(t["matchup_id"], []).append(idx[t["roster_id"]])
        for a, b in by.values():
            W[:, a] += (sc[:, a] > sc[:, b])
            W[:, b] += (sc[:, b] > sc[:, a])

    # Seeding: record (PF tiebreak) for 1-4, then PF for 5-6.
    key = W * 1e5 + P
    order = np.argsort(-key, axis=1)
    top4 = order[:, :4]
    rest = order[:, 4:]
    rest_pf = np.take_along_axis(P, rest, 1)
    wild = np.take_along_axis(rest, np.argsort(-rest_pf, axis=1)[:, :2], 1)
    seeds = np.concatenate([top4, wild], axis=1)  # (N, 6) team index per seed

    rows = np.arange(N)
    def game(w, a, b):
        sc = score(w)
        return np.where(sc[rows, a] >= sc[rows, b], a, b)
    s1, s2, s3, s4, s5, s6 = seeds.T
    q1 = game(po_start, s4, s5)
    q2 = game(po_start, s3, s6)
    f1 = game(po_start + 1, s1, q1)
    f2 = game(po_start + 1, s2, q2)
    champ = game(po_start + 2, f1, f2)

    def share(arr):
        return np.bincount(arr.ravel(), minlength=T) / N

    seed_p = np.stack([np.bincount(seeds[:, k], minlength=T) / N for k in range(6)], axis=1)
    out_teams = []
    for rid in rids:
        i = idx[rid]
        out_teams.append({
            "roster_id": rid,
            "team": owner[rid],
            "wins": float(wins[i]), "losses": float((cur - 1) - wins[i]),
            "pf": round(float(pf[i]), 2),
            "proj_wins": round(float(W[:, i].mean()), 2),
            "proj_pf": round(float(P[:, i].mean()), 1),
            "weekly_proj": round(float(np.mean([mean[w][i] for w in range(cur + 1, last_reg + 1)] or [0])), 1),
            "playoffs": float((seeds == i).any(axis=1).mean()),
            "by_record": float((top4 == i).any(axis=1).mean()),
            "by_points": float((wild == i).any(axis=1).mean()),
            "bye": float(((s1 == i) | (s2 == i)).mean()),
            "seeds": [round(float(x), 4) for x in seed_p[i]],
            "final": float(((f1 == i) | (f2 == i)).mean()),
            "champ": float((champ == i).mean()),
        })
    out_teams.sort(key=lambda t: (-t["champ"], -t["playoffs"]))
    res = {
        "league": league["name"], "season": season, "week": cur,
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sims": N, "noise_sd": round(sd, 1), "proj_bias": round(bias, 1),
        "pending_teams": sorted(pending),
        "teams": out_teams,
    }
    args.out.write_text(json.dumps(res, indent=1, allow_nan=False))
    print(f"week {cur}, sd {sd:.1f}, bias {bias:+.1f}, pending {sorted(pending)}", file=sys.stderr)
    for t in out_teams:
        print(f"{t['team'][:22]:22} {t['wins']:.0f}-{t['losses']:.0f} {t['pf']:7.1f}  wk~{t['weekly_proj']:5.1f}  W {t['proj_wins']:4.1f}  PO {t['playoffs']:6.1%} (rec {t['by_record']:5.1%} pts {t['by_points']:5.1%})  bye {t['bye']:5.1%}  final {t['final']:5.1%}  champ {t['champ']:5.1%}")


if __name__ == "__main__":
    main()
