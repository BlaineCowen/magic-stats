"""nfl4th's own precomputed numbers (nflverse release asset), for side-by-side comparison on the site.

Download first:
  curl -sL -o work/nfl4th/go.rds \
    https://github.com/nflverse/nfl4th/releases/download/nfl4th_infrastructure/pre_computed_go_boost.rds
"""

import json
import math
from pathlib import Path

import pyreadr

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "src" / "lib" / "fourth" / "models" / "nfl4th.json"

df = pyreadr.read_r(HERE / "work" / "nfl4th" / "go.rds")[None]
r3 = lambda v: None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), 4)  # noqa: E731
out: dict[str, dict[str, list]] = {}
for row in df.itertuples():
    out.setdefault(row.game_id, {})[str(int(row.play_id))] = [r3(row.go_wp), r3(row.fg_wp), r3(row.punt_wp)]
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print(len(df), "plays,", len(out), "games,", round(OUT.stat().st_size / 1e6, 2), "MB")
