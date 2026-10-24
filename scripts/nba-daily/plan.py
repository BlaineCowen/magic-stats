#!/usr/bin/env python3
"""Daily lock-in plan for Blaine's team in the LLC crabsketball league.

  scripts/fourth-down/.venv/bin/python scripts/nba-daily/plan.py [--date YYYY-MM-DD]

Lock-in rules: each starter's latest game counts unless you lock an earlier
score. Swapping a bench player (or a pickup) into a slot drops that slot's
score, and only the new player's games from then on count.

Each night this reads the matchup from Sleeper and works out, for the coming
day:
  * Which counted scores are already locked. Sleeper's API doesn't say, so a
    score that doesn't match the player's latest game must be a locked one.
    Locking the latest game looks the same as not locking, and Sleeper's
    servers sometimes disagree about counted scores, so the page lets Blaine
    say which game he locked (manual_locks.json, via refresh_server.py).
  * For every unlocked starter, the score worth locking before each remaining
    game (optimal stopping over his own game-to-game spread from last season,
    scaled to Sleeper's per-game projection, with a chance he sits).
  * Win probability, simulating both teams playing their locks well.
  * Lock-or-play calls for today, judged by win probability rather than
    average points, so a big lead plays safe and a deficit swings.
  * Bench swaps and free-agent pickups that raise the win probability.

Writes /DATA/AppData/nfl-draft/html/csv/nba_plan.json, which /nfl/nba/ shows
behind blaine-auth.
"""

import argparse
import json
import os
import statistics
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import numpy as np

sys.path.insert(0, "/DATA/AppData/nfl-draft/scripts")
from refresh_nba_values import (  # noqa: E402
    LAST, LEAGUE_ID, MIN_OWN_GAMES, MIN_OWN_MEAN, POS_QS, POSITIONS, SEASON,
    SLOT_ELIGIBLE, api, fp, name_of,
)
from refresh_trade_values import atomic_write, fetch_json  # noqa: E402

ME = "bcows827"
OUT = os.environ.get("NBA_PLAN_OUT", "/DATA/AppData/nfl-draft/html/csv/nba_plan.json")
VALUES = "/DATA/AppData/nfl-draft/html/csv/nba_values.json"
# Starters Blaine marked as locked on the page: {player_id: {"week", "games"}}.
MARKS = os.environ.get("NBA_MARKS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "manual_locks.json"))
TZ = ZoneInfo("America/Chicago")
N = 40000
GRID = np.arange(-10.0, 120.5, 0.5)
MIN_WIN_GAIN = 0.005      # a swap has to add half a point of win chance
MAX_SWAPS = 3
MIN_SWAP_GAIN = 1.0      # expected points a single swap has to add
MATCHUP_SAMPLES = 5
ESPN_ABBR = {"GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP", "UTAH": "UTA", "WSH": "WAS"}


def play_prob(status, first):
    """Chance he plays a game, from Sleeper's injury tag. `first` is his next
    game; later games get more benefit of the doubt."""
    s = (status or "").lower()
    if s in ("ir", "sus", "suspended", "na"):
        return 0.0
    if s == "out":
        return 0.0 if first else 0.5
    if s == "doubtful":
        return 0.2 if first else 0.6
    if s in ("questionable", "gtd", "dtd", "day-to-day"):
        return 0.6 if first else 0.85
    if s == "probable":
        return 0.9
    return 0.96


# ---------- game-to-game spread ----------

def load_shapes(scoring):
    """Last season's game scores divided by each player's average. Players with
    too few games borrow from players with a similar average."""
    games = defaultdict(list)
    for week in range(1, 31):
        try:
            rows = api(f"/stats/nba/{LAST}/{week}?season_type=regular&{POS_QS}",
                       cache_as=f"nba_{LAST}_w{week:02d}.json")
        except Exception:
            break
        for r in rows:
            s = r.get("stats") or {}
            if s.get("sp") or s.get("fga") or s.get("pts") or s.get("reb"):
                games[r["player_id"]].append(fp(s, scoring))
    own = {}
    for pid, g in games.items():
        m = statistics.fmean(g)
        if len(g) >= MIN_OWN_GAMES and m >= MIN_OWN_MEAN:
            own[pid] = (m, np.array(g) / m)
    by_mean = sorted(own.values(), key=lambda t: t[0])
    means = np.array([m for m, _ in by_mean])

    def shape(pid, mean):
        if pid in own:
            return own[pid][1]
        idx = np.argsort(np.abs(means - mean))[:12]
        return np.concatenate([by_mean[i][1] for i in idx])
    return shape


# ---------- one slot: optimal locks ----------

class Slot:
    """A starting slot: the player in it, the score it holds now, and his
    remaining games this week."""

    def __init__(self, slot, player, current, locked, games):
        self.slot, self.player = slot, player
        self.current = current          # None until he's played since joining the slot
        self.locked = locked
        self.games = games              # [{date, opp, mean, p, xs}]
        self._solve()

    def _solve(self):
        # F(c): expected final score at a decision point holding c, playing
        # optimally. Walk backwards from the end of the week.
        nxt, nxt_none = GRID.copy(), 0.0
        self.cont, self.cont_none, self.thresh = [], [], []
        for g in reversed(self.games):
            # Not locking: he plays (new score x) or sits (keep c).
            ev_play = np.interp(g["xs"], GRID, nxt).mean()
            cont = g["p"] * ev_play + (1 - g["p"]) * nxt
            cont_none = g["p"] * ev_play + (1 - g["p"]) * nxt_none
            lock_at = GRID[GRID >= cont]
            self.thresh.insert(0, float(lock_at[0]) if len(lock_at) else None)
            self.cont.insert(0, cont)
            self.cont_none.insert(0, cont_none)
            nxt, nxt_none = np.maximum(GRID, cont), cont_none
        self.ev = self.value_from(0)

    def value_from(self, i):
        """Expected final score with games[i:] left and the current score."""
        if self.locked or i >= len(self.games):
            return self.current or 0.0
        if self.current is None:
            return float(self.cont_none[i])
        return max(self.current, float(np.interp(self.current, GRID, self.cont[i])))

    def lock_now_better(self):
        return (not self.locked and self.current is not None and self.games
                and self.thresh[0] is not None and self.current >= self.thresh[0])

    def simulate(self, rng, force_first=None):
        rng = rng if isinstance(rng, np.random.Generator) else np.random.default_rng(rng)
        """Final scores across N weeks. force_first: 'lock' or 'play' overrides
        the call before the first remaining game."""
        if self.locked or not self.games:
            return np.full(N, float(self.current or 0.0))
        c = np.full(N, float(self.current or 0.0))
        has = np.full(N, self.current is not None)
        done = np.zeros(N, bool)
        for i, g in enumerate(self.games):
            if i == 0 and force_first:
                lock = np.full(N, force_first == "lock") & has
            else:
                t = self.thresh[i]
                lock = has & (c >= t) if t is not None else np.zeros(N, bool)
            done |= lock
            played = (~done) & (rng.random(N) < g["p"])
            x = g["xs"][rng.integers(0, len(g["xs"]), N)]
            c = np.where(played, x, c)
            has |= played
        return np.where(has, c, 0.0)


# ---------- data ----------

def espn_tips(dates):
    """Tip time and state (pre/in/post) for each (date, team). Sleeper's game
    status can lag the real game by a quarter or more, so ESPN's wins."""
    tips, states = {}, {}
    for d in dates:
        url = ("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates="
               + d.replace("-", ""))
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "magic-stats"}), timeout=30) as r:
                ev = json.load(r)["events"]
        except Exception as e:
            print("espn scoreboard failed", d, e)
            continue
        for e in ev:
            for c in e["competitions"][0]["competitors"]:
                ab = ESPN_ABBR.get(c["team"]["abbreviation"], c["team"]["abbreviation"])
                tips[(d, ab)] = e["date"]
                states[(d, ab)] = e["status"]["type"]["state"]
    return tips, states


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="plan date (default: today in Chicago)")
    args = ap.parse_args()
    today = args.date or datetime.now(TZ).date().isoformat()
    rng = np.random.default_rng(int(today.replace("-", "")))

    league = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}")
    scoring = {k: v for k, v in league["scoring_settings"].items() if v}
    users = {u["user_id"]: u for u in fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/users")}
    rosters = fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/rosters")
    sched = api(f"/schedule/nba/regular/{SEASON}")

    # The week holding today, or the next one if today is an off day between weeks.
    weeks = sorted({g["week"] for g in sched})
    week = next((w for w in weeks if max(g["date"] for g in sched if g["week"] == w) >= today), None)
    if week is None:
        atomic_write(OUT, json.dumps({"generated": now_iso(), "date": today, "season_over": True}))
        return
    wk_games = [g for g in sched if g["week"] == week]
    week_dates = sorted({g["date"] for g in wk_games})
    tips, states = espn_tips([d for d in week_dates if d >= today])
    now = now_iso()
    remaining = defaultdict(list)       # team -> [(date, opp)] still to play
    for g in sorted(wk_games, key=lambda g: g["date"]):
        if g["status"] != "pre_game" or g["date"] < today:
            continue
        # Sleeper's status can lag the tip; a game that has started can't be swapped into.
        tip = tips.get((g["date"], g["home"]["team"]))
        if tip and datetime.fromisoformat(tip.replace("Z", "+00:00")) <= datetime.now(timezone.utc):
            continue
        h, a = g["home"]["team"], g["away"]["team"]
        remaining[h].append((g["date"], "v " + a))
        remaining[a].append((g["date"], "@ " + h))
    espn_state = {g["game_id"]: states.get((g["date"], g["home"]["team"])) for g in wk_games}
    complete_ids = {g["game_id"] for g in wk_games
                    if g["status"] == "complete" or espn_state[g["game_id"]] == "post"}

    proj_rows = api(f"/projections/nba/{SEASON}/{week}?season_type=regular&{POS_QS}")
    stat_rows = api(f"/stats/nba/{SEASON}/{week}?season_type=regular&{POS_QS}")
    # Sleeper's servers can disagree for hours about counted scores, so ask a few times (see counted_score).
    samples = [fetch_json(f"https://api.sleeper.app/v1/league/{LEAGUE_ID}/matchups/{week}?n={k}")
               for k in range(MATCHUP_SAMPLES)]
    matchups = samples[0]
    values = {p["id"]: p for p in json.load(open(VALUES))["players"]}
    shape = load_shapes(scoring)

    info, proj = {}, defaultdict(dict)
    for r in proj_rows:
        info[r["player_id"]] = r["player"] | {"team": r.get("team") or r["player"].get("team")}
        s = r.get("stats") or {}
        proj[r["player_id"]][r["date"]] = (fp(s, scoring), (s.get("sp") or 0) > 0)
    played = defaultdict(list)          # pid -> [(date, opp, score)] games this week
    live = set()                        # players whose game is going on right now
    started_ids = {g["game_id"] for g in wk_games
                   if g["status"] != "pre_game" or espn_state[g["game_id"]] in ("in", "post")}
    for r in stat_rows:
        info.setdefault(r["player_id"], r["player"] | {"team": r.get("team")})
        s = r.get("stats") or {}
        if r.get("game_id") in started_ids and (s.get("sp") or s.get("fga") or s.get("pts") or s.get("reb")):
            played[r["player_id"]].append((r["date"], r.get("opponent"), round(fp(s, scoring), 1)))
            if r["game_id"] not in complete_ids:
                live.add(r["player_id"])
    for v in played.values():
        v.sort()

    # Locks Blaine marked on the page, {pid: {"pts", "week"}}. A lock lasts the
    # week and beats whatever Sleeper reports, since Sleeper's servers can
    # disagree with each other for hours about a counted score.
    try:
        with open(MARKS) as f:
            marks = json.load(f)
    except (OSError, ValueError):
        marks = {}
    saved = json.dumps(marks, sort_keys=True)
    for m in marks.values():
        m.setdefault("week", week)
    marks = {pid: m for pid, m in marks.items() if m["week"] == week}
    if json.dumps(marks, sort_keys=True) != saved:
        atomic_write(MARKS, json.dumps(marks))

    def player(pid):
        i = info.get(pid, {})
        v = values.get(pid, {})
        return {"id": pid, "name": name_of(i) or v.get("name") or pid,
                "team": i.get("team") or v.get("team"),
                "pos": [p for p in (i.get("fantasy_positions") or v.get("pos") or []) if p in POSITIONS],
                "injury": i.get("injury_status")}

    def games_for(pid):
        p = player(pid)
        pr = proj.get(pid, {})
        fallback = (statistics.fmean([m for m, ok in pr.values() if ok]) if any(ok for _, ok in pr.values())
                    else values.get(pid, {}).get("fppg", 0.0))
        out = []
        for k, (d, opp) in enumerate(remaining.get(p["team"], [])):
            mean, ok = pr.get(d, (fallback, True))
            if not ok:              # projected for zero minutes
                mean = fallback
            pp = play_prob(p["injury"], k == 0) * (1.0 if ok else 0.3)
            out.append({"date": d, "opp": opp, "mean": round(mean, 1), "p": pp,
                        "tip": tips.get((d, p["team"])),
                        "xs": np.maximum(shape(pid, max(mean, 1.0)) * mean, -5.0)})
        return out

    def slot_state(pid, counted):
        """What the slot holds now, and whether it's locked."""
        g = played.get(pid, [])
        if pid in marks:
            return marks[pid]["pts"], True
        if pid in live:
            # Sleeper's live number can run ahead of the box score, so only a
            # match with an earlier game means he's locked.
            if any(counted == s for _, _, s in g[:-1]) and counted != g[-1][2]:
                return counted, True
            return "live", False
        if not g:
            return (None if not counted else counted), False
        if counted == g[-1][2]:
            return counted, False
        if any(counted == s for _, _, s in g[:-1]):
            return counted, True
        if not counted:
            return None, False        # joined the slot since his last game
        return counted, True          # doesn't match anything: treat as locked

    roster_slots = [s for s in league["roster_positions"] if s in SLOT_ELIGIBLE]

    def counted_score(rid, k, pid):
        """Slot k's counted score across the samples. A stale server can show an
        older game (looks locked) but never a game it hasn't seen, so any sample
        showing his latest game wins; otherwise the most common answer."""
        seen = [x["starters_points"][k] for ms in samples for x in ms
                if x["roster_id"] == rid and x["starters"][k] == pid]
        g = played.get(pid, [])
        if g and pid not in live and g[-1][2] in seen:
            return g[-1][2]
        return max(set(seen), key=seen.count) if seen else None

    def team_view(rid):
        m = next(x for x in matchups if x["roster_id"] == rid)
        ro = next(x for x in rosters if x["roster_id"] == rid)
        u = users.get(ro["owner_id"], {})
        counted = [counted_score(rid, k, pid) for k, pid in enumerate(m["starters"])]
        slots = []
        for slot, pid, pts in zip(roster_slots, m["starters"], counted):
            if not pid or pid == "0":
                slots.append(Slot(slot, None, None, False, []))
                continue
            cur, locked = slot_state(pid, pts)
            games = games_for(pid)
            if cur == "live":
                # The game on now counts no matter what; model it as one more game.
                d, opp_, _ = played[pid][-1]
                mean = proj.get(pid, {}).get(d, (values.get(pid, {}).get("fppg", 0.0), True))[0]
                games = [{"date": d, "opp": opp_, "mean": round(mean, 1), "p": 1.0, "tip": None,
                          "xs": np.maximum(shape(pid, max(mean, 1.0)) * mean, -5.0)}] + games
                cur = None
            s = Slot(slot, player(pid), cur, locked, games)
            s.history = played.get(pid, [])
            s.live = not locked and pid in live
            s.live_pts = pts
            slots.append(s)
        reserve = set(ro.get("reserve") or [])
        bench = [b for b in m["players"] if b not in m["starters"] and b not in reserve]
        return {"rid": rid, "mid": m["matchup_id"], "owner": u.get("display_name"),
                "team": (u.get("metadata") or {}).get("team_name") or u.get("display_name"),
                "points": round(sum(s.current if isinstance(s.current, (int, float)) else (s.live_pts or 0)
                                    for s in slots if s.player), 1),
                "slots": slots, "bench": bench}

    me_rid = next(r["roster_id"] for r in rosters if users.get(r["owner_id"], {}).get("display_name") == ME)
    me = team_view(me_rid)
    opp_rid = next(x["roster_id"] for x in matchups if x["matchup_id"] == me["mid"] and x["roster_id"] != me_rid)
    opp = team_view(opp_rid)
    rostered = {p for r in rosters for p in (r.get("players") or [])}

    def fresh(pid, slot, rostered=True):
        # A player moved into a slot from the bench brings his latest game this
        # week with him: Sleeper counts that score until a newer game replaces it.
        # A free agent only scores from games after he's added, so he brings nothing.
        g = played.get(pid, []) if rostered else []
        s = Slot(slot, player(pid), g[-1][2] if g else None, False, games_for(pid))
        s.history = g
        return s

    def best_swaps(team, pool, allow):
        """Greedy: the bench (or pickup) move that adds the most expected
        points, until nothing adds at least MIN_SWAP_GAIN points. Returns moves."""
        moves, used = [], set()
        for _ in range(MAX_SWAPS):
            best = None
            for i, s in enumerate(team["slots"]):
                if s.locked or getattr(s, "live", False):
                    continue
                for pid in pool:
                    if pid in used:
                        continue
                    p = player(pid)
                    if not set(p["pos"]) & SLOT_ELIGIBLE[s.slot]:
                        continue
                    if pid in live or not allow(pid):
                        continue
                    new = fresh(pid, s.slot)
                    gain = new.ev - s.ev
                    if gain >= MIN_SWAP_GAIN and (best is None or gain > best[0]):
                        best = (gain, i, pid, new)
            if not best:
                break
            gain, i, pid, new = best
            old = team["slots"][i]
            moves.append({"slot": old.slot, "out": old.player, "out_score": old.current, "in_score": new.current,
                          "in": new.player, "gain_pts": round(gain, 1),
                          "in_next": game_out(new.games[0]) if new.games else None})
            team["slots"][i] = new
            used.add(pid)
            if old.player:
                pool = pool + [old.player["id"]]
                used.add(old.player["id"])   # swapping him back in would start him fresh: never better
        return moves

    def total(team, overrides=None):
        overrides = overrides or {}
        return sum(s.simulate(rng, overrides.get(i)) for i, s in enumerate(team["slots"]))

    # Opponent: assume they play their locks well and make their own good bench moves.
    opp_moves = best_swaps(opp, opp["bench"], lambda pid: True)
    opp_total = total(opp)

    def win(t):
        return float(np.mean(t > opp_total) + 0.5 * np.mean(t == opp_total))

    base_total = total(me)
    base = {"win": win(base_total), "mean": float(base_total.mean()),
            "p10": float(np.percentile(base_total, 10)), "p90": float(np.percentile(base_total, 90))}

    # Bench swaps, kept only if together they raise the win chance.
    before = list(me["slots"])
    applied = best_swaps(me, list(me["bench"]), lambda pid: True)
    if applied and win(total(me)) < base["win"] + MIN_WIN_GAIN:
        me["slots"], applied = before, []

    plan_total = total(me)
    plan = {"win": win(plan_total), "mean": float(plan_total.mean()),
            "p10": float(np.percentile(plan_total, 10)), "p90": float(np.percentile(plan_total, 90))}

    # Pickups: the best slot for each free agent with games left, against the lineup after swaps.
    fa_pool = sorted(
        (pid for pid in proj if pid not in rostered and pid not in live
         and player(pid)["team"] and remaining.get(player(pid)["team"])),
        key=lambda pid: -sum(m for m, ok in proj[pid].values() if ok))[:120]
    pickups = []
    for pid in fa_pool:
        best = None
        for i, s in enumerate(me["slots"]):
            if s.locked or getattr(s, "live", False) or not set(player(pid)["pos"]) & SLOT_ELIGIBLE[s.slot]:
                continue
            new = fresh(pid, s.slot, rostered=False)
            gain = new.ev - s.ev
            if best is None or gain > best[0]:
                best = (gain, i, new)
        if best and best[0] > 1.5:
            pickups.append((best[0], pid, best[1], best[2]))
    pickups.sort(key=lambda t: -t[0])

    # Room for a pickup, cheapest first: an open roster spot, then an injured
    # bench player who can go on IR, then a drop. It's a long season, so a drop
    # is only suggested when the pickup is worth more for the rest of it too.
    def season_value(pid):
        return values.get(pid, {}).get("value", -99)
    my_ro = next(r for r in rosters if r["roster_id"] == me_rid)
    on_ir = set(my_ro.get("reserve") or [])
    open_spots = len(league["roster_positions"]) - len([p for p in my_ro.get("players") or [] if p not in on_ir])
    ir_free = (league["settings"].get("reserve_slots") or 0) - len(on_ir)
    settings = league["settings"]
    ir_rules = {"out": "reserve_allow_out", "sus": "reserve_allow_sus", "dtd": "reserve_allow_dtd",
                "doubtful": "reserve_allow_doubtful", "na": "reserve_allow_na"}
    ir_ready = sorted((pid for pid in me["bench"]
                       if settings.get(ir_rules.get((player(pid)["injury"] or "").lower(), ""), 0)),
                      key=season_value)
    drop_pool = sorted(me["bench"], key=season_value)
    pickup_out = []
    for gain, pid, i, new in pickups[:20]:
        if len(pickup_out) == 5:
            break
        room = ({"open": True} if open_spots > 0
                else {"ir": player(ir_ready[0])} if ir_free > 0 and ir_ready
                else {"drop": player(drop_pool[0])} if drop_pool and season_value(drop_pool[0]) < season_value(pid)
                else None)
        if room is None:
            continue
        trial = list(me["slots"])
        trial[i] = new
        w = win(total({"slots": trial}))
        if w < plan["win"] + MIN_WIN_GAIN:
            continue
        pickup_out.append({"player": player(pid), "slot": me["slots"][i].slot,
                           "replaces": me["slots"][i].player, "gain_pts": round(gain, 1),
                           "win": round(w, 3), "games": [game_out(g) for g in new.games],
                           "drop": room.get("drop"), "ir": room.get("ir"), "open": bool(room.get("open"))})

    # Today's lock-or-play calls, judged by win chance.
    calls = []
    for i, s in enumerate(me["slots"]):
        if s.locked or s.current is None or not s.games or s.games[0]["date"] != today:
            continue
        rest = sum(x.simulate(rng) for j, x in enumerate(me["slots"]) if j != i)
        seed = int(rng.integers(1 << 31))
        w_lock = win(rest + s.simulate(seed, "lock"))
        w_play = win(rest + s.simulate(seed, "play"))
        # Within a point of win chance it's a wash: go with the higher average.
        lock = s.lock_now_better() if abs(w_lock - w_play) < 0.01 else w_lock > w_play
        calls.append({"slot": s.slot, "id": s.player["id"], "lock": bool(lock),
                      "win_lock": round(w_lock, 3), "win_play": round(w_play, 3),
                      "ev_says_lock": bool(s.lock_now_better())})
    call_by_slot = {c["slot"] + c["id"]: c for c in calls}

    def slot_out(s, mine):
        if not s.player:
            return {"slot": s.slot, "player": None}
        o = {"slot": s.slot, "player": s.player, "current": s.current, "locked": s.locked, "live": getattr(s, "live", False),
             "history": [{"date": d, "opp": op, "pts": p} for d, op, p in getattr(s, "history", [])],
             "games": [game_out(g) | {"lock_if": s.thresh[k + 1] if k + 1 < len(s.games) else None}
                       for k, g in enumerate(s.games)],
             "lock_now_at": s.thresh[0] if s.games else None,
             "ev": round(s.ev, 1)}
        if mine:
            o["advice"] = advice(s, today, call_by_slot.get(s.slot + s.player["id"]))
        o["marked"] = s.player["id"] in marks
        return o

    out = {
        "generated": now_iso(), "date": today, "week": week,
        "week_dates": week_dates,
        "league": {"name": league["name"]},
        "me": {"team": me["team"], "owner": me["owner"], "points": me["points"],
               "slots": [slot_out(s, True) for s in me["slots"]],
               "bench": [player(b) | {"last": played[b][-1][2] if played.get(b) else None, "live": b in live,
                                    "games": [game_out(g) for g in games_for(b)]} for b in me["bench"]]},
        "opp": {"team": opp["team"], "owner": opp["owner"], "points": opp["points"],
                "slots": [slot_out(s, False) for s in opp["slots"]],
                "expected_moves": opp_moves, "mean": float(opp_total.mean()),
                "p10": float(np.percentile(opp_total, 10)), "p90": float(np.percentile(opp_total, 90))},
        "base": rnd(base), "plan": rnd(plan),
        "moves": applied, "calls": calls, "pickups": pickup_out,
    }
    atomic_write(OUT, json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"{out['generated']} week {week} {today}: win {base['win']:.1%} -> {plan['win']:.1%}, "
          f"{len(applied)} moves, {len(calls)} calls, {len(pickup_out)} pickups")


def advice(s, today, call):
    g = s.games
    if s.locked:
        return {"kind": "locked", "text": f"Locked at {fmt(s.current)}."}
    if getattr(s, "live", False):
        txt = f"Playing now ({fmt(s.live_pts)} so far)."
        if len(g) > 1:
            txt += f" Lock it after the game if it ends at {fmt(s.thresh[1])} or more."
        return {"kind": "live", "text": txt}
    if not g:
        return {"kind": "final", "text": f"Done for the week: his {fmt(s.current)} counts. Only worth replacing with someone who already scored more this week." if s.current is not None
                else "No games left, so this slot stays at 0."}
    nxt = g[0]
    later = g[1:]
    if s.current is None:
        txt = f"His next game counts ({day(nxt['date'], today)})."
        if later:
            txt += f" Lock it if it's {fmt(s.thresh[1])} or more."
        return {"kind": "play", "text": txt}
    if nxt["date"] == today and call:
        if call["lock"]:
            txt = f"Lock {fmt(s.current)} before tonight's game."
            kind = "lock"
        else:
            n = len(g)
            txt = (f"Play tonight. {'His ' + str(n) + ' games left are' if n > 1 else 'Tonight is'} worth about "
                   f"{fmt(round(s.value_from(0)))} on average, more than his {fmt(s.current)}.")
            if later:
                txt += f" If tonight's score is {fmt(s.thresh[1])} or more, lock it."
            kind = "play"
        return {"kind": kind, "text": txt}
    when = day(nxt["date"], today)
    if s.lock_now_better():
        return {"kind": "lock_later", "text": f"Nothing today. Lock {fmt(s.current)} before {when}'s game."}
    txt = (f"Nothing today. Let {when}'s game count: {fmt(s.current)} is below the "
           f"{fmt(s.thresh[0])} worth keeping.")
    if later:
        txt += f" Lock {when}'s score if it's {fmt(s.thresh[1])} or more."
    return {"kind": "wait", "text": txt}


def game_out(g):
    return {"date": g["date"], "opp": g["opp"], "proj": g["mean"], "p_play": round(g["p"], 2), "tip": g["tip"]}


def day(d, today):
    if d == today:
        return "tonight"
    return datetime.fromisoformat(d).strftime("%A")


def fmt(x):
    return "–" if x is None else f"{x:.0f}" if float(x).is_integer() else f"{x:.1f}"


def rnd(d):
    return {k: round(v, 3) if k == "win" else round(v, 1) for k, v in d.items()}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


if __name__ == "__main__":
    main()
