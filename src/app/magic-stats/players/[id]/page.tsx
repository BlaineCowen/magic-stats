import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RangeBar } from "@/components/fantasy/range-bar";
import {
  fmtPct,
  injuryLine,
  matchup,
  signals,
} from "@/components/fantasy/signals";
import {
  PointsChart,
  ShareChart,
  StatBars,
} from "@/components/fantasy/weekly-charts";
import { getPlayerPage, type PlayerPage } from "@/lib/nfl/fantasy";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
};

export const dynamic = "force-dynamic";

async function load(props: Props): Promise<PlayerPage | null> {
  const { id } = await props.params;
  const season = Number((await props.searchParams).season) || undefined;
  return getPlayerPage(id, season);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const p = await load(props);
  return p
    ? {
        title: p.name,
        description: `${p.name} (${p.position}, ${p.team ?? "FA"}): weekly fantasy points vs expected, usage, tracking stats and next-game projection.`,
      }
    : { title: "Player not found" };
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="font-display mt-0.5 text-2xl leading-tight font-bold text-slate-900 tabular-nums">
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-display text-xl font-semibold text-slate-900">
        {title}
      </h2>
      {note && <p className="mt-0.5 text-sm text-slate-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function PlayerPageView(props: Props) {
  const p = await load(props);
  if (!p) notFound();
  const color = p.team_color ?? "#1e5a3a";
  const w = p.weeks;
  const avg = (f: (x: (typeof w)[number]) => number | null) => {
    const v = w.map(f).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const ppg = avg((x) => x.ppr);
  const xppg = avg((x) => x.xfp);
  const snaps = avg((x) => x.snap_pct);
  const share = avg((x) => (p.position === "RB" ? x.car_share : x.tgt_share));
  const proj = p.projection;
  const receiver = p.position === "WR" || p.position === "TE";

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <Link
        href="/magic-stats/fantasy"
        className="text-turf-800 text-sm font-medium hover:underline"
      >
        ← Fantasy
      </Link>
      <header className="mt-3 flex items-center gap-4 sm:gap-5">
        {p.headshot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.headshot}
            alt=""
            className="size-16 shrink-0 rounded-full bg-slate-100 object-cover object-top ring-4 sm:size-24"
            style={{ ["--tw-ring-color" as string]: color }}
          />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl leading-tight font-bold tracking-tight text-slate-900 sm:text-5xl">
            {p.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            {p.position}, {p.team_name ?? p.team ?? "free agent"}
            {p.age != null && ` · age ${p.age}`} · {p.draft}
            {p.college && ` · ${p.college}`}
            {p.cap_hit != null && ` · $${p.cap_hit.toFixed(1)}M cap hit`}
          </p>
        </div>
      </header>

      {proj && injuryLine(proj) && (
        <div
          className={cn(
            "mt-5 rounded-lg border px-4 py-3 text-sm",
            proj.injury_status === "Questionable"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-red-200 bg-red-50 text-red-900",
          )}
        >
          <span className="font-semibold">{injuryLine(proj)}.</span>{" "}
          {proj.injury_note}
        </div>
      )}

      {proj && !proj.out_next && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              Week {proj.week} {matchup(proj)}
            </h2>
            {proj.implied_total != null && (
              <span className="text-sm text-slate-500">
                Team expected to score {proj.implied_total.toFixed(1)}
                {!proj.indoor &&
                  proj.temp_f != null &&
                  ` · ${Math.round(proj.temp_f)}°F, ${Math.round(proj.wind_mph ?? 0)} mph wind`}
                {proj.indoor && " · indoors"}
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(4,minmax(0,8rem))_minmax(0,1fr)] sm:items-center sm:gap-4">
            <Stat label="Projection" value={proj.proj.toFixed(1)} sub="PPR" />
            <Stat
              label="Floor"
              value={proj.floor.toFixed(1)}
              sub="1 in 10 below"
            />
            <Stat
              label="Ceiling"
              value={proj.ceiling.toFixed(1)}
              sub="1 in 10 above"
            />
            <Stat
              label="Breakout chance"
              value={
                proj.breakout_prob != null ? fmtPct(proj.breakout_prob) : "–"
              }
              sub={
                proj.breakout_prob != null
                  ? "next 4 games"
                  : "already a starter"
              }
            />
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <RangeBar
                floor={proj.floor}
                proj={proj.proj}
                ceiling={proj.ceiling}
                max={Math.max(30, proj.ceiling + 5)}
                color={color}
              />
              {proj.why.length > 0 && (
                <p className="mt-2 text-sm text-slate-600">
                  Biggest factors:{" "}
                  {proj.why
                    .map(
                      ([label, v]) =>
                        `${label} (${v >= 0 ? "+" : ""}${v.toFixed(1)})`,
                    )
                    .join(", ")}
                </p>
              )}
            </div>
          </div>
          {signals(proj).length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {signals(proj).map((s) => (
                <li
                  key={s.text}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    s.good
                      ? "bg-turf-50 text-turf-900"
                      : "bg-amber-50 text-amber-900",
                  )}
                >
                  {s.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {p.remaining.length > 0 && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              Rest of season
            </h2>
            <span className="text-sm text-slate-500">
              {p.remaining.reduce((a, g) => a + g.proj, 0).toFixed(1)} PPR over{" "}
              {p.remaining.filter((g) => !g.absent).length} games
              {proj?.ros_sos != null &&
                ` · ${proj.ros_sos >= 1 ? "easy" : proj.ros_sos <= -1 ? "hard" : "average"} schedule`}
            </span>
          </div>
          <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-9">
            {p.remaining.map((g) => (
              <li
                key={g.week}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-center",
                  g.absent ? "border-red-200 bg-red-50" : "border-slate-200",
                )}
                title={
                  g.absent
                    ? "Expected to miss this game"
                    : `Floor ${g.floor.toFixed(1)}, ceiling ${g.ceiling.toFixed(1)}`
                }
              >
                <div className="text-xs text-slate-500">
                  Wk {g.week} {g.home ? "vs" : "@"} {g.opp}
                </div>
                <div
                  className={cn(
                    "font-display text-lg font-bold tabular-nums",
                    g.absent ? "text-red-700" : "text-slate-900",
                  )}
                >
                  {g.absent ? "Out" : g.proj.toFixed(1)}
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {g.absent
                    ? "–"
                    : `${g.floor.toFixed(0)}–${g.ceiling.toFixed(0)}`}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-slate-900">
          {p.season} season
        </h2>
        {p.seasons.length > 1 && (
          <nav aria-label="Season" className="flex flex-wrap gap-1.5">
            {p.seasons.slice(0, 8).map((s) => (
              <Link
                key={s}
                href={`/magic-stats/players/${p.id}?season=${s}`}
                aria-current={s === p.season ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium",
                  s === p.season
                    ? "border-turf-950 bg-turf-950 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                )}
              >
                {s}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {w.length === 0 ? (
        <p className="mt-3 text-slate-500">
          No regular-season games this season.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="PPR per game"
              value={ppg?.toFixed(1) ?? "–"}
              sub={
                p.rank?.ppr
                  ? `${p.position}${p.rank.ppr} of ${p.rank.of}`
                  : undefined
              }
            />
            <Stat
              label="Expected per game"
              value={xppg?.toFixed(1) ?? "–"}
              sub={
                p.rank?.xfp ? `${p.position}${p.rank.xfp} by usage` : undefined
              }
            />
            <Stat label="Snap share" value={fmtPct(snaps)} />
            <Stat
              label={p.position === "RB" ? "Carry share" : "Target share"}
              value={fmtPct(share)}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel
              title="Points vs expected"
              note="Bars are PPR points; the black line is what his usage was worth that week."
            >
              <PointsChart weeks={w} color={color} />
            </Panel>
            <Panel
              title="Usage"
              note={
                <>
                  <span className="font-semibold text-slate-700">Snaps</span>,{" "}
                  <span className="font-semibold text-sky-700">
                    target share
                  </span>
                  {p.position === "RB" || p.position === "QB" ? (
                    <>
                      {" "}
                      and{" "}
                      <span className="font-semibold text-amber-700">
                        carry share
                      </span>
                    </>
                  ) : null}{" "}
                  by week
                </>
              }
            >
              <ShareChart
                weeks={w}
                series={[
                  { key: "snap_pct", label: "Snaps", color: "#334155" },
                  { key: "tgt_share", label: "Target share", color: "#0369a1" },
                  ...(p.position === "RB" || p.position === "QB"
                    ? [
                        {
                          key: "car_share" as const,
                          label: "Carry share",
                          color: "#b45309",
                        },
                      ]
                    : []),
                ]}
              />
            </Panel>
            {receiver && w.some((x) => x.separation != null) && (
              <Panel
                title="Separation"
                note="Yards from the nearest defender when the ball arrives (NFL Next Gen Stats). League average is about 3."
              >
                <StatBars
                  weeks={w}
                  value={(x) => x.separation}
                  label="Separation"
                  fmt={(v) => `${v.toFixed(1)} yd`}
                  color={color}
                />
              </Panel>
            )}
            {p.position === "RB" && w.some((x) => x.ryoe_att != null) && (
              <Panel
                title="Rush yards over expected"
                note="Per carry, from NFL Next Gen Stats. Above zero means he's beating the blocking."
              >
                <StatBars
                  weeks={w}
                  value={(x) => x.ryoe_att}
                  label="Rush yards over expected per carry"
                  fmt={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
                  color={color}
                />
              </Panel>
            )}
          </div>

          <Panel title="Game log">
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                    <th className="px-4 py-2 text-left font-medium">Week</th>
                    <th className="px-2 py-2 text-left font-medium">Opp</th>
                    <th className="px-2 py-2 font-medium">PPR</th>
                    <th className="px-2 py-2 font-medium">Expected</th>
                    <th className="px-2 py-2 font-medium">Snaps</th>
                    {p.position === "QB" && (
                      <th className="px-2 py-2 font-medium">Pass yds</th>
                    )}
                    <th className="px-2 py-2 font-medium">Car</th>
                    <th className="px-2 py-2 font-medium">Rush yds</th>
                    <th className="px-2 py-2 font-medium">Tgt</th>
                    <th className="px-2 py-2 font-medium">Rec</th>
                    <th className="px-2 py-2 font-medium">Rec yds</th>
                    <th className="px-4 py-2 font-medium">TD</th>
                  </tr>
                </thead>
                <tbody>
                  {w.map((g) => (
                    <tr
                      key={g.week}
                      className="border-b border-slate-100 text-right last:border-0"
                    >
                      <td className="px-4 py-1.5 text-left">{g.week}</td>
                      <td className="px-2 py-1.5 text-left">{g.opponent}</td>
                      <td className="px-2 py-1.5 font-semibold">
                        {g.ppr.toFixed(1)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1.5",
                          g.xfp == null
                            ? ""
                            : g.ppr - g.xfp >= 3
                              ? "text-turf-800"
                              : g.ppr - g.xfp <= -3
                                ? "text-red-700"
                                : "",
                        )}
                      >
                        {g.xfp?.toFixed(1) ?? "–"}
                      </td>
                      <td className="px-2 py-1.5">{fmtPct(g.snap_pct)}</td>
                      {p.position === "QB" && (
                        <td className="px-2 py-1.5">{g.pass_yards}</td>
                      )}
                      <td className="px-2 py-1.5">{g.carries}</td>
                      <td className="px-2 py-1.5">{g.rush_yards}</td>
                      <td className="px-2 py-1.5">{g.targets}</td>
                      <td className="px-2 py-1.5">{g.receptions}</td>
                      <td className="px-2 py-1.5">{g.rec_yards}</td>
                      <td className="px-4 py-1.5">{g.tds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </main>
  );
}
