"""Punt outcome table: for each line of scrimmage, the distribution of what happens next.

Outcomes are read from the next snap (so penalties, muffs, blocks and returns are all included):
  ("opp", y)  receiving team 1st & 10 at y (their yardline_100)
  ("own", y)  kicking team keeps it (muff / fumble recovery) at y (kicking team's yardline_100)
  ("td", 0)   return touchdown for the receiving team

Rows are smoothed over nearby lines of scrimmage with a Gaussian kernel (sd 3 yards) so every
yardline 1-99 has a distribution even where punts are rare. Writes work/punt_table.json.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

WORK = Path(__file__).resolve().parent / "work"
SEASONS = (2015, 2025)


def outcomes() -> pd.DataFrame:
    df = pd.read_parquet(WORK / "plays.parquet").sort_values(["game_id", "play_id"])
    nxt = df.groupby("game_id")[["posteam", "yardline_100", "qtr", "play_type"]].shift(-1).add_prefix("n_")
    df = pd.concat([df, nxt], axis=1)
    p = df[(df.play_type == "punt") & df.season.between(*SEASONS) & df.yardline_100.notna()].copy()
    td = p.touchdown.eq(1) & p.td_team.eq(p.defteam)
    p = p[td | (p.n_qtr == p.qtr) | ((p.n_qtr == p.qtr + 1) & ~p.qtr.isin([2, 4]))]
    td = p.touchdown.eq(1) & p.td_team.eq(p.defteam)
    p["kind"] = np.select([td, p.n_posteam.eq(p.defteam), p.n_posteam.eq(p.posteam)], ["td", "opp", "own"], "drop")
    p = p[(p.kind != "drop") & (td | p.n_yardline_100.notna()) & ~p.n_play_type.isin(["kickoff", "extra_point"]) | td]
    p["y"] = np.where(p.kind == "td", 0, p.n_yardline_100.fillna(0)).astype(int).clip(0, 99)
    return p[["yardline_100", "kind", "y"]]


def table(p: pd.DataFrame) -> dict:
    p = p.assign(yl=p.yardline_100.astype(int))
    counts = p.groupby(["yl", "kind", "y"]).size().rename("n").reset_index()
    out = {}
    for yl in range(1, 100):
        w = np.exp(-0.5 * ((counts.yl - yl) / 3.0) ** 2)
        # shift each neighbor's result by the difference in line of scrimmage so a punt from 5 yards
        # further back lands 5 yards further back (except touchbacks / TDs, which stay put)
        shift = yl - counts.yl
        y = counts.y.copy()
        opp = counts.kind == "opp"
        tb = opp & counts.y.isin([75, 80])  # touchbacks
        y[opp & ~tb] = (counts.y[opp & ~tb] + shift[opp & ~tb]).clip(1, 99)
        own = counts.kind == "own"
        y[own] = (counts.y[own] + shift[own]).clip(1, 99)
        c = pd.DataFrame({"kind": counts.kind, "y": y, "w": counts.n * w})
        c = c.groupby(["kind", "y"]).w.sum()
        c = c[c > 0] / c.sum()
        c = c[c > 1e-4]
        c = c / c.sum()
        out[yl] = [[k, int(yy), round(float(v), 5)] for (k, yy), v in c.items()]
    return out


if __name__ == "__main__":
    p = outcomes()
    print(p.kind.value_counts(normalize=True).round(4).to_dict(), len(p), "punts")
    t = table(p)
    json.dump(t, open(WORK / "punt_table.json", "w"))
    for yl in (35, 50, 70, 90):
        rows = t[yl]
        opp = [(y, w) for k, y, w in rows if k == "opp"]
        mean = sum(y * w for y, w in opp) / sum(w for _, w in opp)
        print(f"punt from own {100-yl}: opp avg start their own {100-mean:.1f}, "
              f"muff {sum(w for k,_,w in rows if k=='own'):.3f}, ret TD {sum(w for k,_,w in rows if k=='td'):.4f}")
