#!/usr/bin/env python3
"""Replay a finished crabsketball week as a win-probability chart.

  scripts/fourth-down/.venv/bin/python scripts/nba-daily/replay.py [--week N]

Sleeper says who started and which score counted in each slot, but nothing
about when. ESPN's play-by-play has a timestamp on every play, so this
rebuilds each starter's fantasy score through every game (scaled to match
Sleeper's final), then every five minutes asks the same question the daily
plan does: given the scores so far and the games left, how often does Blaine
win if both teams lock well from here?

What's inferred:
  * A slot whose counted score came from an earlier game was locked; the lock
    shows up when his next game tips, which is when it starts to matter.
  * Lineup moves during the week aren't public, so each slot follows the
    player who finished the week in it. If his counted score matches none of
    his games (he was swapped in late), the slot snaps to Sleeper's number at
    the end and the event list says so.
  * Projections for games not yet played are Sleeper's per-game projections,
    with each player's game-to-game spread from last season, as in plan.py.

Writes html/csv/nba_replay.json ({"weeks": {N: ...}}), shown as the Replay
view of /nfl/nba/.
"""

import argparse
import json
import os
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plan import ESPN_ABBR, MARKS, ME, Slot, load_shapes  # noqa: E402
from refresh_nba_values import LEAGUE_ID, POS_QS, SEASON, api, fp, name_of  # noqa: E402
from refresh_trade_values import atomic_write, fetch_json  # noqa: E402

OUT = os.environ.get("NBA_REPLAY_OUT", "/DATA/AppData/nfl-draft/html/csv/nba_replay.json")
PLAYERS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "nba-breakouts", "work", "players.json")
TZ = ZoneInfo("America/Chicago")
STEP = timedelta(minutes=5)
N = 20000
P_PLAY = 0.96


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def espn_games(dates):
    """ESPN event id for each (date, home team)."""
    out = {}
    for d in dates:
        sb = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={d.replace('-', '')}")
        for e in sb.get("events", []):
            comp = e["competitions"][0]
            home = next(c for c in comp["competitors"] if c["homeAway"] == "home")["team"]["abbreviation"]
            out[(d, ESPN_ABBR.get(home, home))] = e["id"]
    return out


def norm(name):
    """Name key for matching ESPN to Sleeper when the ESPN id is missing."""
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return " ".join(w for w in name.replace(".", "").replace("'", "").split() if w not in ("jr", "sr", "ii", "iii", "iv"))


def box_timeline(event_id):
    """{espn athlete id: [(time, fantasy pts so far, share of the game played)]}
    plus the game's tip and end times."""
    d = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={event_id}")
    plays = [p for p in d.get("plays", []) if p.get("wallclock")]
    if not plays:
        return None
    cum = defaultdict(float)
    out = defaultdict(list)
    clock_line = []                  # (time, share of the game played), every play
    for p in plays:
        t = ts(p["wallclock"])
        per = p["period"]["number"]
        try:
            clock = p["clock"]["displayValue"]
            # "5:14" is minutes:seconds; under a minute ESPN shows just seconds ("8.3").
            m, sec = clock.split(":") if ":" in clock else ("0", clock)
            left = float(m) + float(sec) / 60
        except ValueError:
            left = 0.0
        elapsed = (per - 1) * 12 + 12 - left if per <= 4 else 48 + (per - 5) * 5 + 5 - left
        share = min(elapsed / 48, 1.0)
        clock_line.append((t, share))
        ids = [a["athlete"]["id"] for a in p.get("participants", [])]
        if not ids:
            continue
        kind, text = p["type"]["text"], p.get("text", "")
        delta = defaultdict(float)
        if kind.startswith("Free Throw"):
            delta[ids[0]] += 1 if p.get("scoringPlay") else -1   # +1 pt and 0 for ftm-fta, or -1
        elif p.get("shootingPlay"):
            if p.get("scoringPlay"):
                delta[ids[0]] += p.get("scoreValue") or 0
                if " assists)" in text and len(ids) > 1:
                    delta[ids[1]] += 1
            else:
                delta[ids[0]] -= 1
                if " blocks " in text and len(ids) > 1:
                    delta[ids[1]] += 1
        elif "Rebound" in kind:
            delta[ids[0]] += 1
        elif "Turnover" in kind or kind in ("Traveling", "Offensive Charge"):
            delta[ids[0]] -= 1
            if " steals)" in text and len(ids) > 1:
                delta[ids[1]] += 1
        for a, v in delta.items():
            cum[a] += v
            out[a].append((t, cum[a], share))
    names = {a["athlete"]["id"]: norm(a["athlete"]["displayName"])
             for team in d.get("boxscore", {}).get("players", []) for grp in team.get("statistics", [])
             for a in grp.get("athletes", [])}
    return {"tip": ts(plays[0]["wallclock"]), "end": ts(plays[-1]["wallclock"]), "players": out, "names": names, "clock": clock_line}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", type=int)
    args = ap.parse_args()
    today = datetime.now(TZ).date().isoformat()

    league = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}")
    scoring = {k: v for k, v in league["scoring_settings"].items() if v}
    users = {u["user_id"]: u for u in fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/users")}
    rosters = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/rosters")
    sched = api(f"/schedule/nba/regular/{SEASON}")
    week_dates = defaultdict(set)
    for g in sched:
        week_dates[g["week"]].add(g["date"])
    week = args.week or max(w for w, ds in week_dates.items() if max(ds) < today)
    dates = sorted(week_dates[week])

    me_rid = next(r["roster_id"] for r in rosters if users.get(r["owner_id"], {}).get("display_name") == ME)
    matchups = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/matchups/{week}")
    mine = next(m for m in matchups if m["roster_id"] == me_rid)
    theirs = next(m for m in matchups if m["matchup_id"] == mine["matchup_id"] and m["roster_id"] != me_rid)

    def team_name(rid):
        ro = next(r for r in rosters if r["roster_id"] == rid)
        u = users.get(ro["owner_id"], {})
        return (u.get("metadata") or {}).get("team_name") or u.get("display_name") or "?"

    meta = json.load(open(PLAYERS))
    try:
        with open(MARKS) as f:
            marks = json.load(f)
    except (OSError, ValueError):
        marks = {}
    espn_to_sleeper = {str(v["espn_id"]): k for k, v in meta.items() if v.get("espn_id")}
    stats = api(f"/stats/nba/{SEASON}/{week}?season_type=regular&{POS_QS}")
    proj_rows = api(f"/projections/nba/{SEASON}/{week}?season_type=regular&{POS_QS}")
    info, finals = {}, defaultdict(dict)       # pid -> {date: final fp}
    for r in stats:
        info[r["player_id"]] = r.get("player") or {}
        s = r.get("stats") or {}
        if s.get("sp") or s.get("fga") or s.get("pts") or s.get("reb"):
            finals[r["player_id"]][r["date"]] = fp(s, scoring)
    proj = defaultdict(dict)
    for r in proj_rows:
        info.setdefault(r["player_id"], r.get("player") or {})
        s = r.get("stats") or {}
        proj[r["player_id"]][r["date"]] = (fp(s, scoring), (s.get("sp") or 0) > 0)
    shape = load_shapes(scoring)

    team_games = defaultdict(list)            # team -> [(date, home team)]
    for g in sched:
        if g["week"] == week:
            for side in ("home", "away"):
                team_games[g[side]["team"]].append((g["date"], g["home"]["team"]))
    espn = espn_games(dates)
    boxes = {}

    def box(date, home):
        key = (date, home)
        if key not in boxes:
            eid = espn.get(key)
            boxes[key] = box_timeline(eid) if eid else None
        return boxes[key]

    def name(pid):
        return name_of(info.get(pid) or meta.get(pid, {})) or pid

    def build_slot(pid, counted, slot_name):
        """The player's games this week with in-game timelines, and when (if
        ever) the counted score got locked."""
        p_team = (info.get(pid) or {}).get("team") or meta.get(pid, {}).get("team")
        games = []
        for date, home in sorted(team_games.get(p_team, [])):
            b = box(date, home)
            final = finals.get(pid, {}).get(date)
            mean, ok = proj.get(pid, {}).get(date, (None, True))
            g = {"date": date, "tip": b["tip"] if b else None, "end": b["end"] if b else None,
                 "final": final, "mean": mean, "proj_ok": ok, "line": [], "clock": b["clock"] if b else []}
            if b and final is not None:
                espn_id = next((e for e, s in espn_to_sleeper.items() if s == pid), None)
                if espn_id not in b["players"]:
                    espn_id = next((e for e, n in b["names"].items() if n == norm(name(pid))), espn_id)
                raw = b["players"].get(espn_id, [])
                pbp_final = raw[-1][1] if raw else 0.0
                # Scale the play-by-play path to Sleeper's official final.
                g["line"] = [(t, c + (final - pbp_final) * sh, sh) for t, c, sh in raw]
                g["line"].append((b["end"], final, 1.0))
            games.append(g)
        played = [i for i, g in enumerate(games) if g["final"] is not None]
        means = [g["mean"] for g in games if g["mean"]]
        fallback = float(np.mean(means)) if means else 15.0
        for g in games:
            g["mean"] = g["mean"] if g["mean"] and g["proj_ok"] else fallback
            g["p"] = P_PLAY if g["proj_ok"] else 0.3
            g["xs"] = g["mean"] * shape(pid, g["mean"])
        matches = [i for i in played if abs(games[i]["final"] - counted) < 0.01]
        # Two games with the same score: Blaine's lock marks say which one he locked.
        mark = marks.get(pid)
        k = (matches[0] if mark and abs(mark["pts"] - counted) < 0.01 and mark.get("week", week) == week
             else matches[-1]) if matches else None
        lock_at, snap = None, None
        if k is None:
            snap = counted          # swapped in late; Sleeper's number wins at the end
        elif k != played[-1]:
            nxt = next((g["tip"] for g in games[k + 1:] if g["tip"]), None)
            lock_at = nxt
        return {"slot": slot_name, "pid": pid, "name": name(pid), "team": p_team, "counted": counted,
                "games": games, "lock_at": lock_at, "lock_game": k, "snap": snap}

    def counted_for(pid, pts):
        # Sleeper's public API often ignores lock-ins, so the locks marked on
        # the plan page win when they disagree.
        m = marks.get(pid)
        return float(m["pts"]) if m and m.get("week", week) == week else float(pts)

    def side(m):
        return [build_slot(pid, counted_for(pid, pts), s) for pid, pts, s in
                zip(m["starters"], m["starters_points"], league["roster_positions"])]

    me, opp = side(mine), side(theirs)
    all_games = [g for s in me + opp for g in s["games"] if g["tip"]]
    start = min(g["tip"] for g in all_games) - timedelta(minutes=30)
    end = max(g["end"] for g in all_games) + timedelta(minutes=10)

    def state(s, t):
        """(fixed value or None, current, live (x, share) or None, future games)"""
        if s["lock_at"] and t >= s["lock_at"]:
            return s["counted"], None, None, []
        cur, live, fut = None, None, []
        for g in s["games"]:
            if g["tip"] and g["end"] and g["end"] <= t:
                if g["final"] is not None:
                    cur = g["final"]
            elif g["tip"] and g["tip"] <= t:
                if g["final"] is not None:
                    pts = [c for tt, c, _ in g["line"] if tt <= t]
                    played = [sh for tt, sh in g["clock"] if tt <= t]
                    live = ((pts[-1] if pts else 0.0, played[-1] if played else 0.0), g)
            else:
                fut.append(g)
        if not fut and not live and s["snap"] is not None and t >= end - timedelta(minutes=10):
            return s["snap"], None, None, []
        return None, cur, live, fut

    def simulate(s, st, rng):
        fixed, cur, live, fut = st
        if fixed is not None:
            return np.full(N, fixed)
        c = np.full(N, cur if cur is not None else 0.0)
        has = np.full(N, cur is not None)
        if live:
            (x, sh), g = live
            draw = g["xs"][rng.integers(0, len(g["xs"]), N)]
            rest = 1 - sh
            c = x + g["mean"] * rest + (draw - g["mean"]) * np.sqrt(rest)
            has[:] = True
        if fut:
            sl = Slot(s["slot"], None, None, False, [{"p": g["p"], "xs": g["xs"]} for g in fut])
            done = np.zeros(N, bool)
            for i, g in enumerate(fut):
                th = sl.thresh[i]
                done |= has & (c >= th) if th is not None else np.zeros(N, bool)
                play = (~done) & (rng.random(N) < g["p"])
                x = g["xs"][rng.integers(0, len(g["xs"]), N)]
                c = np.where(play, x, c)
                has |= play
        return np.where(has, c, 0.0)

    slots = me + opp
    n_me = len(me)

    def evaluate(sts):
        rng = np.random.default_rng(7)      # same draws every step, so the line only moves when something happens
        tot = [simulate(s, st, rng) for s, st in zip(slots, sts)]
        a, b = sum(tot[:n_me]), sum(tot[n_me:])
        return float((a > b).mean() + 0.5 * (a == b).mean()), float(a.mean()), float(b.mean())

    # Every five minutes, plus right after every play that moves a starter's score.
    times = set()
    t = start
    while t <= end:
        times.add(t)
        t += STEP
    for sl in slots:
        for g in sl["games"]:
            if g["final"] is None or not g["tip"]:
                continue
            times.update(tt + timedelta(seconds=1) for tt, _, _ in g["line"])
            tt = g["tip"]
            while tt < g["end"]:        # the clock keeps running between his plays
                times.add(tt)
                tt += timedelta(minutes=1)
    series, last_sig, last = [], None, None
    for t in sorted(times):
        sts = [state(s, t) for s in slots]
        sig = json.dumps([(a, b, (round(l[0][0], 1), round(l[0][1], 2)) if l else None, len(f)) for a, b, l, f in sts])
        if sig != last_sig:
            last, last_sig = evaluate(sts), sig
        series.append({"t": t.isoformat(timespec="seconds"), "win": round(last[0], 4), "me": round(last[1], 1),
                       "opp": round(last[2], 1)})

    def swing(i, t, t0):
        """Win chance at t, minus the same with slot i held at where it stood at t0."""
        sts = [state(s, t) for s in slots]
        alt = list(sts)
        alt[i] = state(slots[i], t0)
        return evaluate(sts)[0] - evaluate(alt)[0], evaluate(sts)[0]

    def local(t):
        return t.astimezone(TZ).strftime("%a %-I:%M %p")

    events = []
    for i, s in enumerate(slots):
        who = "me" if i < n_me else "opp"
        for gi, g in enumerate(s["games"]):
            if not (g["tip"] and g["final"] is not None):
                continue
            if s["lock_at"] and g["tip"] >= s["lock_at"]:
                continue        # locked: this game didn't matter
            before = state(s, g["tip"] - STEP)
            # Playing on a score the plan would have locked.
            if before[1] is not None and before[0] is None:
                fut = before[3]
                th = Slot(s["slot"], None, None, False, [{"p": x["p"], "xs": x["xs"]} for x in fut]).thresh[0] if fut else None
                if th is not None and before[1] >= th:
                    d, w = swing(i, g["tip"] + STEP, g["tip"] - STEP)
                    events.append({"t": g["tip"].isoformat(timespec="minutes"), "when": local(g["tip"]), "side": who,
                                   "kind": "unlocked", "delta": round(d, 4), "win": round(w, 4),
                                   "text": f"{s['name']} plays instead of locking his {before[1]:.0f}"})
            d, w = swing(i, g["end"] + STEP, g["tip"] + STEP)
            last_game = gi == max(k for k, x in enumerate(s["games"]) if x["final"] is not None)
            events.append({"t": g["end"].isoformat(timespec="minutes"), "when": local(g["end"]), "side": who,
                           "kind": "game", "delta": round(d, 4), "win": round(w, 4),
                           "text": f"{s['name']} scores {g['final']:.0f}" + (" and it counts" if last_game and not s["lock_at"] and s["snap"] is None else "")})
        if s["lock_at"]:
            d, w = swing(i, s["lock_at"] + STEP, s["lock_at"] - STEP)
            events.append({"t": s["lock_at"].isoformat(timespec="minutes"), "when": local(s["lock_at"]), "side": who,
                           "kind": "lock", "delta": round(d, 4), "win": round(w, 4),
                           "text": f"{s['name']} locked at {s['counted']:.0f}"})
        if s["snap"] is not None:
            t_end = end - timedelta(minutes=10)
            d, w = swing(i, t_end, t_end - STEP)
            events.append({"t": t_end.isoformat(timespec="minutes"), "when": local(t_end), "side": who,
                           "kind": "swap", "delta": round(d, 4), "win": round(w, 4),
                           "text": f"Sleeper counts {s['counted']:.0f} for {s['name']} at {s['slot']} (a lineup change we can't see)"})
    events.sort(key=lambda e: e["t"])

    def slot_out(s):
        return {"slot": s["slot"], "name": s["name"], "team": s["team"], "counted": s["counted"],
                "locked": s["lock_at"] is not None, "marked": s["pid"] in marks, "swapped": s["snap"] is not None,
                "games": [{"date": g["date"], "pts": g["final"], "proj": round(g["mean"], 1), "counted": i == s["lock_game"]}
                          for i, g in enumerate(s["games"])]}

    # Game nights for the chart's x axis, so it can skip the dead hours.
    nights = {}
    for g in all_games:
        day = g["tip"].astimezone(TZ).date().isoformat()
        a, b = nights.get(day, (g["tip"], g["end"]))
        nights[day] = (min(a, g["tip"]), max(b, g["end"]))
    windows = [{"day": day, "label": datetime.fromisoformat(day).strftime("%a %b %-d"),
                "start": (a - timedelta(minutes=15)).isoformat(timespec="minutes"),
                "end": (b + timedelta(minutes=15)).isoformat(timespec="minutes")}
               for day, (a, b) in sorted(nights.items())]

    week_out = {
        "week": week, "dates": dates, "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "me": {"team": team_name(mine["roster_id"]), "points": sum(x["counted"] for x in me), "sleeper_points": mine["points"], "slots": [slot_out(s) for s in me]},
        "opp": {"team": team_name(theirs["roster_id"]), "points": sum(x["counted"] for x in opp), "sleeper_points": theirs["points"], "slots": [slot_out(s) for s in opp]},
        "series": series, "events": events, "windows": windows,
    }
    try:
        with open(OUT) as f:
            data = json.load(f)
    except (OSError, ValueError):
        data = {"weeks": {}}
    data["weeks"][str(week)] = week_out
    data["latest"] = max(int(w) for w in data["weeks"])
    atomic_write(OUT, json.dumps(data, allow_nan=False))
    lo, hi = min(series, key=lambda x: x["win"]), max(series, key=lambda x: x["win"])
    print(f"week {week}: {week_out['me']['points']} - {week_out['opp']['points']}, {len(series)} steps, "
          f"low {lo['win']:.1%} at {lo['t']}, high {hi['win']:.1%} at {hi['t']}")


if __name__ == "__main__":
    main()
