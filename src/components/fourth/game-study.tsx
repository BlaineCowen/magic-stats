"use client";

import { useEffect, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import type {
  FourthDownPlay,
  GameAnalysis,
  TeamInfo,
} from "@/lib/fourth/games";
import { cn } from "@/lib/utils";
import { yardText } from "./decision-card";
import { DecisionTable, SureTag } from "./decision-table";
import { MiniField } from "./field";
import { chance, CHOICE, Expand } from "./ui";

type Verdict = "right" | "close" | "wrong" | "none";
const VERDICT_COLOR: Record<Verdict, string> = {
  right: "#059669",
  close: "#9ca3af",
  wrong: "#dc2626",
  none: "#cbd5e1",
};

/** Within a point of the best choice is a coin flip, not a mistake. */
export function verdictOf(p: FourthDownPlay): Verdict {
  if (!p.decision) return "none";
  if (p.decision.best === p.actual) return "right";
  return p.cost > -1 ? "close" : "wrong";
}

const H = 150;
const W = 720;
const PAD = { l: 34, r: 10, t: 10, b: 24 };

/** One team's chance to win across the game, in its color, with each of its 4th downs marked. */
function WpTimeline({ g, team }: { g: GameAnalysis; team: TeamInfo }) {
  const isHome = g.teams.home.abbr === team.abbr;
  const maxEl = Math.max(3600, ...g.timeline.map((p) => p.elapsed));
  const x = (el: number) => PAD.l + (el / maxEl) * (W - PAD.l - PAD.r);
  const y = (wp: number) => PAD.t + (1 - wp) * (H - PAD.t - PAD.b);
  const wpOf = (homeWp: number) => (isHome ? homeWp : 1 - homeWp);
  const path = g.timeline
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${x(p.elapsed).toFixed(1)},${y(wpOf(p.homeWp)).toFixed(1)}`,
    )
    .join("");
  const wpAt = (el: number) =>
    g.timeline.reduce(
      (best, t) =>
        Math.abs(t.elapsed - el) < Math.abs(best.elapsed - el) ? t : best,
      g.timeline[0]!,
    ).homeWp;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`${team.nick} chance to win during the game`}
    >
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(v)}
            y2={y(v)}
            stroke={v === 0.5 ? "#d1d5db" : "#f3f4f6"}
          />
          <text
            x={PAD.l - 6}
            y={y(v) + 3}
            fontSize={10}
            textAnchor="end"
            fill="#6b7280"
          >
            {v * 100}%
          </text>
        </g>
      ))}
      {[0, 900, 1800, 2700].map((s, i) => (
        <text
          key={s}
          x={(x(s) + x(s + 900)) / 2}
          y={H - 8}
          fontSize={10}
          textAnchor="middle"
          fill="#6b7280"
        >
          Q{i + 1}
        </text>
      ))}
      {maxEl > 3600 && (
        <text
          x={(x(3600) + x(maxEl)) / 2}
          y={H - 8}
          fontSize={10}
          textAnchor="middle"
          fill="#6b7280"
        >
          OT
        </text>
      )}
      <path d={path} fill="none" stroke={team.color} strokeWidth={2.25} />
      {g.plays
        .filter((p) => p.posteam === team.abbr)
        .map((p) => (
          <circle
            key={p.playId}
            cx={x(p.elapsed)}
            cy={y(wpOf(wpAt(p.elapsed)))}
            r={5.5}
            fill={VERDICT_COLOR[verdictOf(p)]}
            stroke="#fff"
            strokeWidth={2}
          >
            <title>{`${p.qtr > 4 ? "OT" : `Q${p.qtr}`} ${p.time}: ${CHOICE[p.actual]}`}</title>
          </circle>
        ))}
    </svg>
  );
}

/** "4th & 3 at the KC 15" */
export function situationText(p: FourthDownPlay): string {
  const s = p.decision?.situation;
  if (!s) return "";
  const togo = s.ydstogo >= s.yardline ? "goal" : s.ydstogo;
  return `4th & ${togo} at ${yardText(s.yardline, p.posteam, p.defteam)}`;
}

// "02:12" -> "2:12"
const clock = (p: FourthDownPlay) => {
  const t = p.time.replace(/^0(?=\d:)/, "");
  return p.qtr > 4 ? `OT, ${t}` : `Q${p.qtr}, ${t}`;
};

/** What they did, as a phrase: "Kicked a 58-yard field goal, missed". */
function didText(p: FourthDownPlay): string {
  if (p.actual === "go")
    return `Went for it${p.worked == null ? "" : p.worked ? " and made it" : " and came up short"}`;
  if (p.actual === "fg") {
    const yd = p.decision?.options.find((o) => o.key === "fg")?.detail.distance;
    return `Kicked a ${yd ? `${yd}-yard ` : ""}field goal${p.worked == null ? "" : p.worked ? ", good" : ", missed"}`;
  }
  return "Punted";
}

const DOING: Record<string, string> = {
  go: "gone for it",
  fg: "kicked the field goal",
  punt: "punted",
};

/** The model's view in one sentence: right call, coin flip, or what they should have done. */
function Verdict({ p }: { p: FourthDownPlay }) {
  const v = verdictOf(p);
  const d = p.decision!;
  const best = d.options.find((o) => o.key === d.best)!;
  const chosen = d.options.find((o) => o.key === p.actual);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {v === "right" && (
        <span className="text-emerald-700">
          <b className="font-display text-lg">Right call.</b> {chance(best.wp)}{" "}
          to win.
        </span>
      )}
      {v === "close" && (
        <span className="text-slate-700">
          <b className="font-display text-lg">Coin flip.</b> Either choice was
          about {chance(best.wp)} to win.
        </span>
      )}
      {v === "wrong" && (
        <span className="text-red-700">
          <b className="font-display text-lg">Should have {DOING[d.best]}:</b>{" "}
          {chance(best.wp)} to win vs {chance(chosen?.wp)}.
        </span>
      )}
      {d.confidence && v !== "close" && <SureTag c={d.confidence} />}
    </div>
  );
}

function Score({ p, g }: { p: FourthDownPlay; g: GameAnalysis }) {
  const nick = (abbr: string) =>
    g.teams.home.abbr === abbr ? g.teams.home.nick : g.teams.away.nick;
  return (
    <span>
      {nick(p.posteam)} {p.posteamScore}, {nick(p.defteam)} {p.defteamScore}
    </span>
  );
}

/** One 4th down: the field on the left, the story on the right, every number one click away. */
function PlayCard({ p, g }: { p: FourthDownPlay; g: GameAnalysis }) {
  const v = verdictOf(p);
  const Icon = v === "right" ? Check : v === "wrong" ? X : Minus;
  const off = g.teams.home.abbr === p.posteam ? g.teams.home : g.teams.away;
  const def = g.teams.home.abbr === p.posteam ? g.teams.away : g.teams.home;
  const s = p.decision?.situation;
  return (
    <div className="grid gap-x-6 gap-y-3 border-b border-slate-100 py-5 last:border-0 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold text-slate-900">{clock(p)}</span>
          <Score p={p} g={g} />
        </div>
        {s ? (
          <MiniField
            yardline={s.yardline}
            ydstogo={s.ydstogo}
            offense={off}
            defense={def}
          />
        ) : (
          <div className="rounded-md bg-slate-100 p-4 text-center text-sm text-slate-600">
            Overtime
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <Icon
            className="mt-1 size-5 shrink-0"
            style={{ color: VERDICT_COLOR[v] }}
            aria-label={v}
          />
          <div className="min-w-0">
            <div className="font-display text-xl leading-snug font-semibold text-slate-900">
              {s ? situationText(p) : "Overtime 4th down"}
            </div>
            <div className="text-slate-700">{didText(p)}.</div>
          </div>
        </div>
        {p.decision ? (
          <div className="mt-2 pl-7">
            <Verdict p={p} />
            <Expand label="All the numbers" className="mt-1">
              <DecisionTable
                d={p.decision}
                team={p.posteam}
                opp={p.defteam}
                actual={p.actual}
                compact
                showHeading={false}
              />
              <p className="mt-3 text-xs text-slate-500 italic">{p.desc}</p>
            </Expand>
          </div>
        ) : (
          <p className="mt-2 pl-7 text-sm text-slate-600">
            Overtime calls are graded on their own.
          </p>
        )}
      </div>
    </div>
  );
}

/** One decision with the full table, for the calls a story is about. */
export function FeaturedCall({
  p,
  heading,
}: {
  p: FourthDownPlay;
  heading?: string;
}) {
  const v = verdictOf(p);
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      {heading && (
        <div className="font-display mb-2 text-base font-semibold text-slate-700">
          {heading}
        </div>
      )}
      <DecisionTable
        d={p.decision!}
        team={p.posteam}
        opp={p.defteam}
        actual={p.actual}
        compact
      />
      <div className="mt-3 border-t border-slate-200 pt-2 text-slate-900">
        <span className="font-medium">{didText(p)}.</span>{" "}
        <span
          className={cn(
            "font-display text-lg font-semibold",
            v === "wrong"
              ? "text-red-700"
              : v === "right"
                ? "text-emerald-700"
                : "text-slate-700",
          )}
        >
          {v === "right"
            ? "Right call."
            : v === "close"
              ? "A coin flip either way."
              : `Wrong call, cost ${Math.max(1, Math.round(-p.cost))}% in chance to win.`}
        </span>
      </div>
    </div>
  );
}

/** Both teams side by side, in their colors, with the final score. */
function Scoreboard({ g }: { g: GameAnalysis }) {
  const date = g.date
    ? new Date(`${g.date}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const side = (
    t: TeamInfo,
    score: number,
    won: boolean,
    align: "left" | "right",
  ) => (
    <div
      className={cn(
        "flex items-center gap-3",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/charts/logo/${t.abbr}`}
        alt=""
        className="size-8 shrink-0 object-contain sm:size-12"
      />
      <div className="min-w-0">
        <div className="hidden truncate text-sm text-slate-600 sm:block">
          {t.name.replace(` ${t.nick}`, "")}
        </div>
        <div className="font-display truncate text-xl leading-tight font-bold text-slate-900 sm:text-3xl">
          {t.nick}
        </div>
      </div>
      <div
        className={cn(
          "font-display ml-auto text-3xl leading-none tabular-nums sm:text-5xl",
          align === "right" && "mr-auto ml-0",
          won ? "font-bold text-slate-900" : "text-slate-400",
        )}
      >
        {score}
      </div>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex h-1.5">
        <div className="flex-1" style={{ background: g.teams.away.color }} />
        <div className="flex-1" style={{ background: g.teams.home.color }} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
        {side(g.teams.away, g.awayScore, g.awayScore > g.homeScore, "left")}
        <div className="text-center text-xs whitespace-nowrap text-slate-500">
          <div className="font-display text-sm font-semibold text-slate-700">
            Final
          </div>
          {date && <div className="hidden sm:block">{date}</div>}
          <div>{g.week > 18 ? "Playoffs" : `Week ${g.week}`}</div>
        </div>
        {side(g.teams.home, g.homeScore, g.homeScore > g.awayScore, "right")}
      </div>
    </div>
  );
}

function Summary({ g, team }: { g: GameAnalysis; team: TeamInfo }) {
  const theirs = g.plays.filter((p) => p.posteam === team.abbr && p.decision);
  const n = (v: Verdict) => theirs.filter((p) => verdictOf(p) === v).length;
  const lost = -theirs
    .filter((p) => verdictOf(p) === "wrong")
    .reduce((a, p) => a + p.cost, 0);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-700">
      <span className="font-display text-base font-semibold text-slate-900">
        {team.nick}:
      </span>
      <span className="flex items-center gap-1.5">
        <Check className="size-4 text-emerald-600" aria-hidden /> {n("right")}{" "}
        right
      </span>
      <span className="flex items-center gap-1.5">
        <X className="size-4 text-red-600" aria-hidden /> {n("wrong")} wrong
        {n("wrong") > 0 && (
          <span className="text-slate-500">
            (cost {Math.max(1, Math.round(lost))}% in chance to win)
          </span>
        )}
      </span>
      {n("close") > 0 && (
        <span className="flex items-center gap-1.5">
          <Minus className="size-4 text-slate-400" aria-hidden /> {n("close")}{" "}
          coin {n("close") === 1 ? "flip" : "flips"}
        </span>
      )}
    </div>
  );
}

export function GameStudy({
  gameId,
  focus,
  title,
  verdict,
  featured = [],
  children,
}: {
  gameId: string;
  /** team whose decisions the story is about */
  focus: string;
  title?: string;
  /** one plain-English sentence */
  verdict?: React.ReactNode;
  /** play ids to show as featured calls, each with an optional heading */
  featured?: { playId: number; heading?: string }[];
  /** the longer write-up, behind "The full story" */
  children?: React.ReactNode;
}) {
  const [g, setG] = useState<GameAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<string>(focus);

  useEffect(() => {
    setG(null);
    setView(focus);
    fetch(`/api/fourth-down?game=${gameId}`)
      .then((r) => r.json())
      .then((j: GameAnalysis & { error?: string }) =>
        j.error ? setError(j.error) : setG(j),
      )
      .catch((e: Error) => setError(e.message));
  }, [gameId, focus]);

  if (error)
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  if (!g)
    return <div className="h-64 animate-pulse rounded-lg bg-slate-200/70" />;

  const teams = [g.teams.away, g.teams.home];
  const shown = view === "both" ? teams : teams.filter((t) => t.abbr === view);
  const plays = g.plays.filter((p) => shown.some((t) => t.abbr === p.posteam));

  return (
    <section className="space-y-4">
      {title && (
        <h3 className="font-display text-2xl font-semibold text-slate-900">
          {title}
        </h3>
      )}
      <Scoreboard g={g} />
      {verdict && (
        <p className="font-display max-w-3xl text-2xl leading-snug font-semibold text-slate-900">
          {verdict}
        </p>
      )}

      {featured.length > 0 && (
        <div className="space-y-3">
          {featured.map((f) => {
            const p = g.plays.find((x) => x.playId === f.playId);
            return p?.decision ? (
              <FeaturedCall key={f.playId} p={p} heading={f.heading} />
            ) : null;
          })}
        </div>
      )}

      {children && (
        <Expand label="The full story">
          <div className="max-w-[70ch] space-y-2 text-sm leading-relaxed text-slate-700">
            {children}
          </div>
        </Expand>
      )}

      <Expand
        label="Every 4th down in this game"
        defaultOpen={featured.length === 0}
      >
        <div className="rounded-lg border border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-4">
            <div
              className="flex overflow-hidden rounded-md border border-slate-300 text-sm"
              role="group"
              aria-label="Whose 4th downs"
            >
              {[
                ...teams.map((t) => ({ k: t.abbr, label: t.nick })),
                { k: "both", label: "Both" },
              ].map((o) => (
                <button
                  key={o.k}
                  type="button"
                  aria-pressed={view === o.k}
                  onClick={() => setView(o.k)}
                  className={cn(
                    "focus-visible:outline-turf-700 px-3 py-1.5 focus-visible:outline-2 focus-visible:-outline-offset-2",
                    view === o.k
                      ? "bg-turf-950 font-semibold text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              {shown.map((t) => (
                <Summary key={t.abbr} g={g} team={t} />
              ))}
            </div>
          </div>
          {shown.length === 1 && (
            <div className="border-b border-slate-100 py-4">
              <div className="mb-1 text-xs text-slate-600">
                {shown[0]!.nick}&apos; chance to win through the game. Dots are
                their 4th downs.
              </div>
              <WpTimeline g={g} team={shown[0]!} />
            </div>
          )}
          {plays.map((p) => (
            <PlayCard key={p.playId} p={p} g={g} />
          ))}
        </div>
      </Expand>
    </section>
  );
}
