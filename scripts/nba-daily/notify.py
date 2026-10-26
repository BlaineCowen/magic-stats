"""Telegram reminders (via Hermes) for crabsketball lineup moves the daily plan says are still to do.

Reads nba_plan.json after plan.py writes it. Each pending move, free look or lock call has a
deadline (the tip it has to beat); a reminder goes out about 90 minutes before and a last call
about 20 minutes before. Once the move is made, the plan stops listing it and the reminders stop.

    notify.py [--dry-run]
"""
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PLAN = Path("/DATA/AppData/nfl-draft/html/csv/nba_plan.json")
STATE = Path(__file__).with_name("notify_state.json")
HERMES = "/home/blaine/.local/bin/hermes"
PAGE = "https://projects.blainecowen.com/nfl/nba/"
TZ = ZoneInfo("America/Chicago")
EARLY, LATE = 90 * 60, 20 * 60     # seconds before the deadline
STALE = 40 * 60                    # ignore a plan older than this


def ts(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() if iso else None


def when(iso):
    t = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(TZ)
    today = datetime.now(TZ).date()
    clock = t.strftime("%-I:%M %p").replace(":00 ", " ")
    return clock if t.date() == today else f"{t.strftime('%a')} {clock}"


def last(name):
    return name.split(" ")[-1] if name else "the empty spot"


def pts(x):
    return f"{x:g}"


def items(plan):
    """(key, deadline iso, text) for everything still to do."""
    out = []
    for m in plan.get("moves", []):
        nxt = m.get("in_next") or {}
        if not nxt.get("tip"):
            continue
        old = m["out"]["name"] if m.get("out") else None
        out.append((f"move|{m['slot']}|{m['in']['id']}|{(m.get('out') or {}).get('id')}", nxt["tip"],
                    f"Swap {m['in']['name']} in for {old or 'the empty spot'} at {m['slot']} before {when(nxt['tip'])} "
                    f"({nxt['opp']}). Worth about {pts(m['gain_pts'])} pts."))
    for lk in plan.get("looks", []):
        g = lk["in_game"]
        back = lk.get("back_by")
        tail = (f"otherwise put {last(lk['out']['name'])} back before {when(back['tip'])}." if back and back.get("tip")
                else f"otherwise put {last(lk['out']['name'])} back after the game.")
        out.append((f"look|{lk['slot']}|{lk['in']['id']}|{lk['out']['id']}", g["tip"],
                    f"Free look: start {lk['in']['name']} at {lk['slot']} for {when(g['tip'])} ({g['opp']}) instead of "
                    f"{last(lk['out']['name'])}. Keep him if he scores {pts(lk['keep_if'])}+, {tail}"))
    slots = {s["slot"] + (s.get("player") or {}).get("id", ""): s for s in plan["me"]["slots"]}
    for c in plan.get("calls", []):
        s = slots.get(c["slot"] + c["id"])
        if not c["lock"] or not s or not s.get("games"):
            continue
        g = s["games"][0]
        out.append((f"lock|{c['id']}|{g['date']}", g["tip"],
                    f"Lock {s['player']['name']} at {pts(s['current'])} ({c['slot']}) before {when(g['tip'])}. "
                    f"Win chance {round(c['win_lock'] * 100)}% locked vs {round(c['win_play'] * 100)}% playing."))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    plan = json.loads(PLAN.read_text())
    now = datetime.now(timezone.utc).timestamp()
    if plan.get("season_over") or now - ts(plan["generated"]) > STALE:
        print("plan missing or stale; nothing sent")
        return
    try:
        state = json.loads(STATE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        state = {}

    due, late = [], False
    for key, tip, text in items(plan):
        k = f"{key}|{tip}"
        left = ts(tip) - now
        sent = state.get(k, [])
        if left <= 0 or left > EARLY:
            continue
        if left <= LATE and "late" not in sent:
            due.append(text)
            late = True
            state[k] = ["early", "late"]
        elif "early" not in sent:
            due.append(text)
            state[k] = ["early"]

    if not due:
        print("nothing due")
    else:
        head = "Last call, crabsketball:" if late else "Crabsketball moves to make:"
        msg = "\n\n".join([head] + [f"• {t}" for t in due] + [PAGE])
        print(msg)
        if not args.dry_run:
            r = subprocess.run([HERMES, "send", "-q", "-t", "telegram", msg], capture_output=True, text=True)
            if r.returncode:
                print("hermes send failed:", r.stderr.strip()[-300:], file=sys.stderr)
                return  # don't record it, so the next run tries again
    if not args.dry_run:
        # Forget deadlines more than a day old.
        state = {k: v for k, v in state.items() if ts(k.rsplit("|", 1)[1]) > now - 86400}
        STATE.write_text(json.dumps(state, indent=1))


if __name__ == "__main__":
    main()
