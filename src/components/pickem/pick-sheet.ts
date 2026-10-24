import type { Side } from "@/lib/pickem/optimizer";
import type { PickemGame } from "@/lib/pickem/scoreboard";

/**
 * Draws the week's picks as a printable pick sheet (PNG), the format office pools pass
 * around: games by day, the picked team highlighted, confidence on the right, byes below.
 */

const CITY: Record<string, string> = {
  ARI: "Arizona", ATL: "Atlanta", BAL: "Baltimore", BUF: "Buffalo", CAR: "Carolina", CHI: "Chicago",
  CIN: "Cincinnati", CLE: "Cleveland", DAL: "Dallas", DEN: "Denver", DET: "Detroit", GB: "Green Bay",
  HOU: "Houston", IND: "Indianapolis", JAX: "Jacksonville", KC: "Kansas City", LV: "Las Vegas",
  LAC: "LA Chargers", LAR: "LA Rams", MIA: "Miami", MIN: "Minnesota", NE: "New England",
  NO: "New Orleans", NYG: "NY Giants", NYJ: "NY Jets", PHI: "Philadelphia", PIT: "Pittsburgh",
  SF: "San Francisco", SEA: "Seattle", TB: "Tampa Bay", TEN: "Tennessee", WSH: "Washington",
};
const city = (abbr: string, fallback: string) => CITY[abbr] ?? fallback;

// AP style: short months get a period, March through July are spelled out.
const MONTH = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

/** "Thursday, Oct. 22" in Eastern time, where the NFL schedule lives. */
export function dayLabel(kickoff: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "numeric", day: "numeric" })
      .formatToParts(new Date(kickoff))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday}, ${MONTH[Number(parts.month) - 1]} ${parts.day}`;
}

export type SheetInput = {
  season: number;
  week: number;
  name: string;
  games: PickemGame[];
  picks: Record<string, Side>;
  /** The number to print for each game (already in the pool's scoring). */
  shown: Record<string, number>;
  /** The number that means most confident, e.g. 14 (or 1). */
  top: number;
};

export function byes(games: PickemGame[]): string[] {
  const playing = new Set(games.flatMap((g) => [g.home.abbr, g.away.abbr]));
  return Object.keys(CITY).filter((a) => !playing.has(a)).map((a) => CITY[a]!);
}

const C = {
  ink: "#16213e",
  muted: "#7a8091",
  rule: "#e3e6ec",
  band: "#e8ebf4",
  pick: "#ebf3c4",
  paper: "#ffffff",
};
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export function drawPickSheet(input: SheetInput): HTMLCanvasElement {
  const games = [...input.games].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const days: { label: string; games: PickemGame[] }[] = [];
  for (const g of games) {
    const label = dayLabel(g.kickoff);
    if (days.at(-1)?.label === label) days.at(-1)!.games.push(g);
    else days.push({ label, games: [g] });
  }
  const off = byes(input.games);

  const W = 1100, PAD = 70, ROW = 60, BAND = 42;
  const H = 230 + days.length * (BAND + 14) + games.length * ROW + (off.length ? 90 : 40);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "middle";

  const text = (s: string, x: number, y: number, size: number, weight = 400, color = C.ink, align: CanvasTextAlign = "left", italic = false) => {
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const box = (x: number, y: number, w: number, h: number, color: string, r = 6) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };

  text(`WEEK ${input.week} PICK SHEET — ${input.season}`, W / 2, 80, 38, 800, C.ink, "center");
  text(input.name || "Your name", PAD + 8, 140, 22, 700, input.name ? C.ink : C.muted);
  text(`${input.top} = highest confidence`, W - PAD - 8, 140, 18, 400, C.ink, "right");

  const left = PAD, right = W - PAD;
  const numX = right - 14;
  const awayX = left + 8, awayW = 390;
  const atX = awayX + awayW + 12;
  const homeX = atX + 34, homeW = 390;
  let y = 175;
  for (const day of days) {
    box(left, y, right - left, BAND, C.band, 8);
    text(day.label, left + 18, y + BAND / 2, 19, 700);
    y += BAND + 4;
    for (const g of day.games) {
      const pick = input.picks[g.id];
      const mid = y + ROW / 2;
      if (pick === "away") box(awayX, y + 4, awayW, ROW - 8, C.pick);
      if (pick === "home") box(homeX, y + 4, homeW, ROW - 8, C.pick);
      text(city(g.away.abbr, g.away.name), awayX + 14, mid, 23, pick === "away" ? 700 : 400);
      text("at", atX + 8, mid, 17, 400, C.muted, "center");
      text(city(g.home.abbr, g.home.name), homeX + 14, mid, 23, pick === "home" ? 700 : 400);
      const n = input.shown[g.id];
      if (pick && n) text(String(n), numX, mid, 27, 700, C.ink, "right");
      ctx.fillStyle = C.rule;
      ctx.fillRect(left + 4, y + ROW, right - left - 8, 1.5);
      y += ROW;
    }
    y += 10;
  }
  if (off.length) text(`Byes: ${off.join(", ")}`, left + 4, y + 40, 16, 400, C.muted, "left", true);
  return canvas;
}

export function sheetBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png"));
}
