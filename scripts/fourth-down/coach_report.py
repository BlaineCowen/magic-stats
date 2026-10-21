"""Aggregate work/coach-decisions.jsonl into the coaches tab's data (src/lib/fourth/data/coaches.json).

Cost = win probability the actual choice gave up versus the model's best choice, in points; summed over
a coach's decisions it's expected wins forfeited (100 points = 1 win), if the model is right.
A "mistake" gives up more than 1 point; anything within a point is a close call.
"""

import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "src" / "lib" / "fourth" / "data" / "coaches.json"
MISTAKE = -1.0
MIN_GAMES = 17

df = pd.read_json(HERE / "work" / "coach-decisions.jsonl", lines=True)
df["mistake"] = df.cost < MISTAKE
df["passive"] = df.mistake & (df.best == "go")  # kicked or punted when going was better
df["aggressive"] = df.mistake & (df.actual == "go")  # went when a kick was better
df["other"] = df.mistake & ~df.passive & ~df.aggressive  # e.g. punted when the FG was better
df["should_go"] = df.best.eq("go") & (df.gap >= 2.25)  # model strongly says go
games = df.groupby("coach").gameId.nunique()


def summary(g: pd.DataFrame) -> dict:
    sg = g[g.should_go]
    return {
        "games": int(g.gameId.nunique()),
        "decisions": int(len(g)),
        "mistakes": int(g.mistake.sum()),
        "lost": round(float(g.cost.sum()), 2),
        "lostPerGame": round(float(g.cost.sum() / max(1, g.gameId.nunique())), 3),
        "passiveLost": round(float(g.cost[g.passive].sum()), 2),
        "aggressiveLost": round(float(g.cost[g.aggressive].sum()), 2),
        "otherLost": round(float(g.cost[g.other].sum()), 2),
        "passive": int(g.passive.sum()),
        "aggressive": int(g.aggressive.sum()),
        "strongGoSpots": int(len(sg)),
        "wentInStrongGoSpots": int((sg.actual == "go").sum()),
        "nfl4thLost": round(float(g.n4Cost.dropna().sum()), 2),
        "nfl4thGraded": int(g.n4Cost.notna().sum()),
    }


coaches = []
for coach, g in df.groupby("coach"):
    if games[coach] < MIN_GAMES:
        continue
    s = summary(g)
    s["coach"] = coach
    s["teams"] = sorted(g.team.unique().tolist())
    s["seasons"] = [
        {"season": int(season), **summary(sg)} for season, sg in g.groupby("season")
    ]
    worst = g[g.mistake].sort_values("cost").head(12)
    worst = worst[[
        "gameId", "season", "week", "post", "team", "opp", "qtr", "time", "ydstogo", "yardline", "scoreDiff",
        "actual", "worked", "best", "gap", "cost", "conv", "breakeven", "n4Best", "n4Cost", "desc",
        "goWp", "fgWp", "puntWp",
    ]]
    # pandas turns missing values (e.g. "worked" for punts) into NaN, which isn't valid JSON
    s["worst"] = worst.astype(object).where(worst.notna(), None).to_dict(orient="records")
    coaches.append(s)

coaches.sort(key=lambda c: c["lostPerGame"], reverse=True)  # least negative = best
for i, c in enumerate(coaches, 1):
    c["rank"] = i
league = summary(df)
# per team-game, comparable with each coach's lostPerGame
team_games = df.groupby(["gameId", "team"]).ngroups
league["lostPerGame"] = round(float(df.cost.sum() / team_games), 3)
league["coaches"] = len(coaches)
OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump({
    "seasons": [int(df.season.min()), int(df.season.max())],
    "through": f"{int(df.season.max())} week {int(df[df.season == df.season.max()].week.max())}",
    "minGames": MIN_GAMES,
    "league": league,
    "coaches": coaches,
}, open(OUT, "w"), separators=(",", ":"), allow_nan=False)

ryans = next(c for c in coaches if c["coach"] == "DeMeco Ryans")
print(f"{len(df)} decisions, {len(coaches)} coaches with {MIN_GAMES}+ games")
print("league per game:", round(league["lostPerGame"], 3))
print({k: ryans[k] for k in ["rank", "games", "decisions", "mistakes", "lost", "lostPerGame", "passiveLost",
                             "aggressiveLost", "otherLost", "passive", "aggressive", "strongGoSpots",
                             "wentInStrongGoSpots", "nfl4thLost", "nfl4thGraded"]})
for s in ryans["seasons"]:
    print(s["season"], {k: s[k] for k in ["games", "decisions", "mistakes", "lost", "lostPerGame", "passiveLost", "aggressiveLost", "nfl4thLost"]})
print("\nleaderboard (WP points lost per game):")
for c in coaches:
    print(f"{c['rank']:2d} {c['coach']:22s} {','.join(c['teams']):12s} g={c['games']:3d} lost={c['lost']:7.1f} /g={c['lostPerGame']:6.2f} nfl4th={c['nfl4thLost']:7.1f}")
