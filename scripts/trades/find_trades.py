#!/usr/bin/env python3
"""Trade ideas for every team in H-Town Ballers.

  python3 scripts/trades/find_trades.py

Reads the trade desk's values (/DATA/AppData/nfl-draft/html/csv/values.json,
built by refresh_trade_values.py from ETR's rest-of-season values, re-based on
this league's starters) and the league's current rosters from Sleeper.
Writes data/nfl/trades.json for /magic-stats/trades.

Two sets of ideas, each with up to three per team:
  etr     Blaine's view: lineups and fairness judged by ETR's values.
  market  What everyone else sees: lineups and fairness judged by the
          FantasyCalc trade market, ranked to favor the most even trades.
A trade makes a list when both teams' best lineups get better by that list's
values and the two sides are close in value. Ideas are ranked by the smaller
of the two teams' gains, minus a penalty for any value gap.

Team strength is the value of the best lineup (QB, 2 RB, 2 WR, TE, FLEX,
SUPER_FLEX) plus a little for the next three bench players, who cover byes
and injuries.
"""

import itertools
import json
import os
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LEAGUE_ID = "1389362330239795200"
VALUES = Path("/DATA/AppData/nfl-draft/html/csv/values.json")
OUT = Path(__file__).resolve().parents[2] / "data" / "nfl" / "trades.json"

POSITIONS = ("QB", "RB", "WR", "TE")
FLEX = ("RB", "WR", "TE")
# Bench players count this much: they start during byes and injuries.
BENCH_WEIGHT = 0.2
BENCH_DEPTH = 3
# Players below this value are roster filler and never worth a trade slot.
MIN_PLAYER = 25
# Each side has to gain at least this much lineup value.
MIN_GAIN = 15
# Per list: the allowed gap between what each side gives, as a share of the
# bigger side, and how hard a value gap counts against an idea (per point,
# against lineup points gained).
VIEWS = {
    "etr": {"max_gap": 0.2, "unfair": 0.1},
    "market": {"max_gap": 0.1, "unfair": 1.0},
}
PER_TEAM = 3


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "magic-stats-trades/1"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def lineup(ids, val, pos):
    """Best lineup and the team's strength. Filling the fixed slots, then FLEX
    from what's left, then SUPER_FLEX from what's left is optimal here because
    each later slot accepts everything the earlier one does."""
    pool = sorted((i for i in ids if pos.get(i) in POSITIONS), key=lambda i: -val.get(i, 0))
    starters = {}
    used = set()

    def take(slot, ok):
        hit = next((i for i in pool if i not in used and ok(pos[i])), None)
        if hit:
            used.add(hit)
            starters[slot] = hit

    for slot, p in (("QB", "QB"), ("RB1", "RB"), ("RB2", "RB"), ("WR1", "WR"), ("WR2", "WR"), ("TE", "TE")):
        take(slot, lambda x, p=p: x == p)
    take("FLEX", lambda x: x in FLEX)
    take("SUPER_FLEX", lambda x: True)
    bench = [i for i in pool if i not in used][:BENCH_DEPTH]
    strength = sum(val.get(i, 0) for i in starters.values()) + BENCH_WEIGHT * sum(val.get(i, 0) for i in bench)
    return starters, strength


def gap(a, b):
    big = max(a, b)
    return abs(a - b) / big if big else 0.0


def needs_and_surplus(teams, val, pos):
    """Needs: the team's two weakest positions, if its starters there are in
    the league's bottom three. Surplus: a bench player at a position who'd be
    among the league's three best backups, unless that's also a need."""
    weak_rank, deep = {}, {}
    for p in POSITIONS:
        start = {k: sum(val.get(i, 0) for i in t["starters"].values() if pos[i] == p) for k, t in teams.items()}
        bench = {k: max([val.get(i, 0) for i in t["ids"] if pos[i] == p and i not in t["starters"].values()] or [0])
                 for k, t in teams.items()}
        for n, k in enumerate(sorted(start, key=start.get)):
            weak_rank[k, p] = n
        deep[p] = {k for k in sorted(bench, key=bench.get, reverse=True)[:3] if bench[k] >= MIN_PLAYER * 2}
    out = {}
    for k in teams:
        worst = sorted(POSITIONS, key=lambda p: weak_rank[k, p])[:2]
        need = [p for p in worst if weak_rank[k, p] < 3]
        out[k] = {"need": need, "surplus": [p for p in POSITIONS if k in deep[p] and p not in need]}
    return out


def main():
    data = json.loads(VALUES.read_text())
    players = {p["sid"]: p for p in data["players"]}
    val = {s: p["ours"] or 0 for s, p in players.items()}
    # The market's view on our scale; fall back to ours where FantasyCalc has nothing.
    mkt = {s: p["consensus"] if p["consensus"] is not None else val[s] for s, p in players.items()}

    rosters = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/rosters")
    users = {u["user_id"]: u for u in fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/users")}
    league = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}")

    # Players the trade desk doesn't value (kickers, defenses, deep bench) need
    # a position too, so pull it from Sleeper only for those.
    pos = {s: p["pos"] for s, p in players.items()}
    unknown = {s for r in rosters for s in (r.get("players") or []) if s not in pos}
    if unknown:
        allp = fetch_json("https://api.sleeper.app/v1/players/nfl")
        for s in unknown:
            pos[s] = (allp.get(s) or {}).get("position")

    teams = {}
    for r in rosters:
        u = users.get(r.get("owner_id")) or {}
        ids = [s for s in (r.get("players") or []) if pos.get(s) in POSITIONS]
        teams[r["roster_id"]] = {
            "rosterId": r["roster_id"],
            "owner": u.get("display_name") or f"Team {r['roster_id']}",
            "teamName": ((u.get("metadata") or {}).get("team_name") or "").strip() or None,
            "record": f"{r['settings'].get('wins', 0)}-{r['settings'].get('losses', 0)}",
            "ids": ids,
        }
    def why(before, after, gets, gives):
        """Plain words, no numbers: where the incoming players start and
        whether the outgoing ones were starting."""
        slot_of = {i: s for s, i in after.items()}
        parts = []
        for i in gets:
            s = slot_of.get(i)
            name = players[i]["name"]
            parts.append(f"{name} starts at {label(s)}" if s else f"{name} adds depth")
        bench = [players[i]["name"] for i in gives if i not in before]
        if bench:
            parts.append(f"{join(bench)} {'was' if len(bench) == 1 else 'were'} on the bench")
        return ". ".join(parts) + "."

    trades = []
    for view, v, cfg in (("etr", val, VIEWS["etr"]), ("market", mkt, VIEWS["market"])):
        for t in teams.values():
            t["starters"], t["strength"] = lineup(t["ids"], v, pos)
        needs = needs_and_surplus(teams, v, pos)

        def candidates(t, v=v):
            return sorted((i for i in t["ids"] if v.get(i, 0) >= MIN_PLAYER), key=lambda i: -v[i])[:12]

        ideas = []
        for (ka, ta), (kb, tb) in itertools.combinations(teams.items(), 2):
            ca, cb = candidates(ta), candidates(tb)
            for na, nb in ((1, 1), (2, 1), (1, 2), (2, 2)):
                for give in itertools.combinations(ca, na):
                    gv = sum(v[i] for i in give)
                    for get in itertools.combinations(cb, nb):
                        rv = sum(v[i] for i in get)
                        if gap(gv, rv) > cfg["max_gap"]:
                            continue
                        a_st, a_str = lineup([i for i in ta["ids"] if i not in give] + list(get), v, pos)
                        b_st, b_str = lineup([i for i in tb["ids"] if i not in get] + list(give), v, pos)
                        ga, gb = a_str - ta["strength"], b_str - tb["strength"]
                        if ga < MIN_GAIN or gb < MIN_GAIN:
                            continue
                        ideas.append({
                            "a": ka, "b": kb, "aGives": list(give), "bGives": list(get),
                            "aGain": ga, "bGain": gb, "aStarters": a_st, "bStarters": b_st,
                            # Both sides should gain about the same, the values should
                            # match (how much depends on the view), and simpler trades
                            # break ties.
                            "score": min(ga, gb) - 0.05 * abs(ga - gb) - cfg["unfair"] * abs(gv - rv)
                                     - 3 * (na + nb - 2),
                        })
        ideas.sort(key=lambda x: -x["score"])
        print(f"{view}: {len(ideas)} trades help both sides")

        # Up to PER_TEAM ideas per team, each with a different partner and no
        # player offered twice in that team's list.
        picked, chosen = {k: [] for k in teams}, []
        for idea in ideas:
            for me, other, mine in (("a", "b", "aGives"), ("b", "a", "bGives")):
                k = idea[me]
                lst = picked[k]
                if len(lst) >= PER_TEAM:
                    continue
                if any(chosen[j][other if chosen[j][me] == k else me] == idea[other] for j in lst):
                    continue
                offered = {i for j in lst for i in (chosen[j]["aGives"] if chosen[j]["a"] == k else chosen[j]["bGives"])}
                if offered & set(idea[mine]):
                    continue
                if idea not in chosen:
                    chosen.append(idea)
                lst.append(chosen.index(idea))

        base = len(trades)
        for idea in chosen:
            ta, tb = teams[idea["a"]], teams[idea["b"]]
            ours = [sum(val[i] for i in idea["aGives"]), sum(val[i] for i in idea["bGives"])]
            market = [sum(mkt[i] for i in idea["aGives"]), sum(mkt[i] for i in idea["bGives"])]
            trades.append({
                "id": len(trades),
                "view": view,
                "sides": [
                    {"rosterId": idea["a"], "gives": idea["aGives"], "gets": idea["bGives"],
                     "why": why(set(ta["starters"].values()), idea["aStarters"], idea["bGives"], idea["aGives"])},
                    {"rosterId": idea["b"], "gives": idea["bGives"], "gets": idea["aGives"],
                     "why": why(set(tb["starters"].values()), idea["bStarters"], idea["aGives"], idea["bGives"])},
                ],
                "numbers": {
                    "gain": [round(idea["aGain"], 1), round(idea["bGain"], 1)],
                    "ours": [round(x, 1) for x in ours],
                    "market": [round(x, 1) for x in market],
                },
            })
        for k, t in teams.items():
            t.setdefault("views", {})[view] = {**needs[k], "trades": [base + j for j in picked[k]]}
            t.setdefault("strengths", {})[view] = round(t["strength"], 1)

    used = {i for t in trades for s in t["sides"] for i in s["gives"]}
    out = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "valuesGenerated": data.get("generated"),
        "etrFileDate": data.get("etrFileDate"),
        "league": {"id": LEAGUE_ID, "name": league.get("name"), "week": league.get("settings", {}).get("leg"),
                   "tradeDeadline": league.get("settings", {}).get("trade_deadline")},
        "teams": [{
            "rosterId": k, "owner": t["owner"], "teamName": t["teamName"], "record": t["record"],
            "views": t["views"], "numbers": {"strength": t["strengths"]},
        } for k, t in sorted(teams.items())],
        "trades": trades,
        "players": {i: {
            "name": players[i]["name"], "pos": players[i]["pos"], "team": players[i]["team"],
            "injury": players[i].get("injury"),
            "numbers": {"ours": players[i]["ours"], "market": players[i]["consensus"],
                        "etrRank": players[i].get("etrRank")},
        } for i in sorted(used)},
    }
    fd, tmp = tempfile.mkstemp(dir=OUT.parent, suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    os.chmod(tmp, 0o644)
    os.replace(tmp, OUT)
    print(f"{len(trades)} trades written")


SLOT_LABEL = {"QB": "QB", "RB1": "RB", "RB2": "RB", "WR1": "WR", "WR2": "WR", "TE": "TE",
              "FLEX": "flex", "SUPER_FLEX": "superflex"}


def label(slot):
    return SLOT_LABEL.get(slot, slot)


def join(names):
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


if __name__ == "__main__":
    main()
