"""Current NFL injuries from ESPN, with expected return dates.

nflverse's weekly injury report only says Out/Doubtful/Questionable for the next
game. ESPN's injury feed adds how long: injured reserve, suspensions, and an
expected return date for most longer absences (e.g. a hamstring on IR,
back around Nov 25). build.py uses it to keep players out of the games before
they return and to hand their targets and carries to teammates.

  ../fourth-down/.venv/bin/python injuries.py
Writes work/espn_injuries.parquet: espn_id, name, status, return_date,
injury, note, reported.
"""

import json
import urllib.request
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE / "work" / "espn_injuries.parquet"
URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries"


def main() -> None:
    with urllib.request.urlopen(URL, timeout=60) as r:
        data = json.load(r)
    rows = []
    for team in data.get("injuries", []):
        for i in team.get("injuries", []):
            a = i.get("athlete") or {}
            det = i.get("details") or {}
            espn_id = None
            for link in a.get("links", []):
                href = link.get("href", "")
                if "/player/_/id/" in href:
                    espn_id = href.split("/player/_/id/")[1].split("/")[0]
                    break
            if not espn_id:
                continue
            rows.append(
                {
                    "espn_id": espn_id,
                    "name": a.get("displayName"),
                    "status": i.get("status"),
                    "return_date": det.get("returnDate"),
                    "injury": det.get("type"),
                    "note": i.get("shortComment"),
                    "reported": i.get("date"),
                }
            )
    df = pd.DataFrame(rows)
    df["return_date"] = pd.to_datetime(df.return_date, errors="coerce").dt.date
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT, index=False)
    print(df.status.value_counts().to_string())
    print(f"{len(df)} injuries, {int(df.return_date.notna().sum())} with a return date")


if __name__ == "__main__":
    main()
