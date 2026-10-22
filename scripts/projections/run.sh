#!/usr/bin/env bash
# Daily: weather (archive + forecast), features, then fit and score the
# upcoming week. Runs after refresh-nfl-data.mjs. Writes
# data/nfl/projections.parquet and projections-meta.json.
set -euo pipefail
cd "$(dirname "$0")"
PY=../fourth-down/.venv/bin/python
echo "== $(date -Is) projections"
nice -n 10 "$PY" weather.py
nice -n 10 "$PY" injuries.py
nice -n 10 "$PY" build.py
nice -n 10 "$PY" train.py predict 2>&1 | grep -v Warning
