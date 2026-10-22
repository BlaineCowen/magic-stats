"""Game-time weather for every NFL game since 2016, plus forecasts for upcoming games.

nflverse's schedule leaves temp/wind blank for many games (most of 2022 and the
current season), so this pulls hourly weather for each stadium from Open-Meteo:
the archive for played games, the forecast API for the next two weeks. Domes
and closed roofs get indoor = 1 and no weather.

  ../fourth-down/.venv/bin/python weather.py          # refresh (archive cached per stadium-season)
Writes work/weather.parquet: game_id, indoor, temp_f, wind_mph, precip_mm.
"""

import json
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

import duckdb
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[1] / "data" / "nfl"
WORK = HERE / "work"
CACHE = WORK / "weather-cache"
FIRST = 2016

# Approximate stadium coordinates; weather doesn't need better than ~1 km.
STADIUMS = {
    "ATL00": (33.758, -84.401), "ATL97": (33.755, -84.401), "BAL00": (39.278, -76.623),
    "BOS00": (42.091, -71.264), "BUF00": (42.774, -78.787), "CAR00": (35.226, -80.853),
    "CHI98": (41.862, -87.617), "CIN00": (39.095, -84.516), "CLE00": (41.506, -81.700),
    "DAL00": (32.748, -97.093), "DEN00": (39.744, -105.020), "DET00": (42.340, -83.046),
    "FRA00": (50.069, 8.645), "GER00": (48.219, 11.625), "GNB00": (44.501, -88.062),
    "HOU00": (29.685, -95.411), "IND00": (39.760, -86.164), "JAX00": (30.324, -81.637),
    "KAN00": (39.049, -94.484), "LAX01": (33.953, -118.339), "LAX97": (33.864, -118.261),
    "LAX99": (34.014, -118.288), "LON00": (51.556, -0.280), "LON01": (51.456, -0.342),
    "LON02": (51.604, -0.066), "MAD01": (40.453, -3.688), "MEL00": (-37.820, 144.983),
    "MEX00": (19.303, -99.150), "MIA00": (25.958, -80.239), "MIN01": (44.974, -93.258),
    "MIN98": (44.976, -93.225), "MUN01": (48.219, 11.625), "NAS00": (36.166, -86.771),
    "NOR00": (29.951, -90.081), "NYC01": (40.813, -74.074), "OAK00": (37.751, -122.201),
    "PAR00": (48.924, 2.360), "PHI00": (39.901, -75.168), "PHO00": (33.528, -112.263),
    "PIT00": (40.447, -80.016), "RIO00": (-22.912, -43.230), "SAO00": (-23.545, -46.474),
    "SDG00": (32.783, -117.120), "SEA00": (47.595, -122.332), "SFO01": (37.403, -121.970),
    "STL00": (38.633, -90.188), "TAM00": (27.976, -82.503), "VEG00": (36.091, -115.184),
    "WAS00": (38.908, -76.864),
}
HOURLY = "temperature_2m,wind_speed_10m,precipitation"
UNITS = "temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York"


def fetch(url: str) -> dict:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def hourly_frame(j: dict) -> pd.DataFrame:
    h = j["hourly"]
    return pd.DataFrame(
        {
            "time": pd.to_datetime(h["time"]),
            "temp_f": h["temperature_2m"],
            "wind_mph": h["wind_speed_10m"],
            "precip_mm": h["precipitation"],
        }
    )


def archive(stadium: str, season: int, start: str, end: str) -> pd.DataFrame:
    """Hourly history for one stadium over one season's dates, cached on disk."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{stadium}-{season}.parquet"
    if f.exists():
        return pd.read_parquet(f)
    lat, lon = STADIUMS[stadium]
    j = fetch(
        f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
        f"&start_date={start}&end_date={end}&hourly={HOURLY}&{UNITS}"
    )
    df = hourly_frame(j)
    # Don't cache a season that's still going: later games aren't in it yet.
    if date.fromisoformat(end) < date.today() - timedelta(days=7):
        df.to_parquet(f)
    time.sleep(0.3)
    return df


def forecast(stadium: str) -> pd.DataFrame:
    lat, lon = STADIUMS[stadium]
    j = fetch(
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        f"&hourly={HOURLY}&{UNITS}&forecast_days=16&past_days=7"
    )
    return hourly_frame(j)


def main() -> None:
    games = duckdb.sql(
        f"""
        SELECT game_id, season, gameday, gametime, roof, stadium_id, home_team
        FROM read_parquet('{DATA}/games.parquet')
        WHERE season >= {FIRST}
        """
    ).df()
    # A stadium we don't know: use the home team's usual stadium.
    usual = games.groupby("home_team").stadium_id.agg(lambda s: s.mode().iat[0])
    games["stadium"] = [
        s if s in STADIUMS else usual.get(t) for s, t in zip(games.stadium_id, games.home_team)
    ]
    games["indoor"] = games.roof.isin(["dome", "closed"]).astype(int)
    hour = games.gametime.fillna("13:00").str.slice(0, 2).astype(int)
    games["kick"] = pd.to_datetime(games.gameday) + pd.to_timedelta(hour, unit="h")

    today = pd.Timestamp(date.today())
    out = []
    outdoor = games[(games.indoor == 0) & games.stadium.isin(STADIUMS.keys())]
    for (stadium, season), g in outdoor.groupby(["stadium", "season"]):
        played = g[g.kick < today - pd.Timedelta(days=5)]
        upcoming = g[g.kick >= today - pd.Timedelta(days=5)]
        frames = []
        if len(played):
            frames.append(
                archive(
                    stadium,
                    int(season),
                    played.kick.min().strftime("%Y-%m-%d"),
                    played.kick.max().strftime("%Y-%m-%d"),
                )
            )
        if len(upcoming[upcoming.kick < today + pd.Timedelta(days=15)]):
            frames.append(forecast(stadium))
        if not frames:
            continue
        wx = pd.concat(frames).drop_duplicates("time", keep="last").set_index("time").sort_index()
        for r in g.itertuples():
            # Average the three hours from kickoff.
            w = wx.loc[r.kick : r.kick + pd.Timedelta(hours=2)]
            if len(w):
                out.append(
                    {
                        "game_id": r.game_id,
                        "temp_f": float(w.temp_f.mean()),
                        "wind_mph": float(w.wind_mph.mean()),
                        "precip_mm": float(w.precip_mm.sum()),
                    }
                )
    wx = pd.DataFrame(out)
    res = games[["game_id", "indoor"]].merge(wx, on="game_id", how="left")
    WORK.mkdir(parents=True, exist_ok=True)
    res.to_parquet(WORK / "weather.parquet", index=False)
    print(
        f"{len(res)} games, {int(res.indoor.sum())} indoor, "
        f"{int(res.temp_f.notna().sum())} with weather"
    )


if __name__ == "__main__":
    main()
