"""Download Sleeper NBA game logs (2017-2025) and preseason projections/ADP (2019-2026)
into work/. Past seasons never change, so anything already on disk is skipped."""
import json
import os
import time
import urllib.request

WORK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work")
POS = "&".join(f"position%5B%5D={p}" for p in ["PG", "SG", "SF", "PF", "C"])


def get(url):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "magic-stats"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 3:
                raise
            print("retry", url, e)
            time.sleep(2**attempt)


def save(name, url):
    path = os.path.join(WORK, name)
    if os.path.exists(path):
        return json.load(open(path))
    data = get(url)
    json.dump(data, open(path, "w"))
    return data


for season in range(2019, 2027):
    save(f"proj_{season}.json", f"https://api.sleeper.com/projections/nba/{season}?season_type=regular&{POS}")
for season in range(2017, 2026):
    save(f"season_{season}.json", f"https://api.sleeper.com/stats/nba/{season}?season_type=regular&{POS}")
    empty = 0
    for week in range(1, 40):
        d = save(f"games_{season}_w{week:02d}.json", f"https://api.sleeper.com/stats/nba/{season}/{week}?season_type=regular&{POS}")
        if not any(x["stats"].get("sp") for x in d):
            empty += 1
            if empty >= 2:
                break
    print(season, "weeks", week)
