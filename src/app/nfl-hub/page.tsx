import type { Metadata, Viewport } from "next";
import {
  Activity,
  ArrowLeftRight,
  Scale,
  SlidersHorizontal,
  BarChart3,
  Calculator,
  ChevronRight,
  ClipboardList,
  Lock,
  MessageSquareText,
  Radio,
  Repeat,
  Route,
  Trophy,
  Volleyball,
  Waypoints,
} from "lucide-react";
import { NFL_VIEWPORT, NflShell } from "@/components/nfl-shell";
import { ScoreboardStrip } from "@/components/scoreboard-strip";

/**
 * The sports hub, served at projects.blainecowen.com/nfl/ (nfl-router proxies that exact path here).
 * Links are absolute site paths because the pages live in three places: this app, the static
 * Draft & Pick'em export under /nfl/, and its hand-written pages. Private ones sit behind
 * blaine-auth in nfl-router, so they only open for Blaine.
 */

// Rendered per request so browsers and Cloudflare always revalidate /nfl/. Before 2026-10-22 that URL
// was the draft board, and browsers kept serving their old copy of it.
export const dynamic = "force-dynamic";

export const viewport: Viewport = NFL_VIEWPORT;

export const metadata: Metadata = {
  title: "Blaine's Sports Tools",
  description:
    "NFL, NBA and MLB stats you can ask about in plain English, plus 4th down calls, playoff odds and fantasy draft tools.",
  icons: {
    icon: { url: "/magic-stats/icon.svg", type: "image/svg+xml" },
    apple: "/magic-stats/apple-icon",
  },
};

type Item = {
  href: string;
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TOOLS: (Item & { example: string })[] = [
  {
    href: "/magic-stats",
    title: "Magic Stats",
    blurb:
      "Ask NFL, NBA or MLB stats questions in plain English. Box scores, advanced stats and Statcast.",
    example: "“Who leads the league in rushing yards?”",
    icon: MessageSquareText,
  },
  {
    href: "/magic-stats/charts",
    title: "NFL charts",
    blurb:
      "Team tiers, quarterback efficiency and fantasy luck, by season, week and situation.",
    example: "Offense vs defense, all 32 teams",
    icon: BarChart3,
  },
  {
    href: "/magic-stats/fourth-down",
    title: "NFL 4th down calls",
    blurb:
      "Go, kick or punt, graded by chance to win. Coaches ranked by the wins they gave away.",
    example: "Live calls during every game",
    icon: Calculator,
  },
];

const SEASON: Item[] = [
  {
    href: "/magic-stats/fourth-down?tab=live",
    title: "Live 4th down calls",
    blurb: "Graded the moment a team faces 4th down.",
    icon: Activity,
  },
  {
    href: "/nfl/playoffs/",
    title: "Playoff odds",
    blurb: "Season simulation against Kalshi futures.",
    icon: Trophy,
  },
  {
    href: "/magic-stats/pickem",
    title: "Pick'em assistant",
    blurb: "Confidence pool picks with live scores.",
    icon: ClipboardList,
  },
  {
    href: "/magic-stats/trades",
    title: "Trade ideas",
    blurb: "Fair trades for every team in H-Town Ballers.",
    icon: ArrowLeftRight,
  },
  {
    href: "/magic-stats/trade-calc",
    title: "Trade calculator",
    blurb: "Grade any trade with values for your league's settings.",
    icon: Scale,
  },
];

const RESEARCH: Item[] = [
  {
    href: "/nfl/bend/",
    title: "Bending the edge",
    blurb: "How much speed rookie edge rushers keep turning the corner, and why the Combine misses it.",
    icon: Route,
  },
];

const PRIVATE: Item[] = [
  {
    href: "/nfl/draft/",
    title: "Draft board",
    blurb: "Sleeper draft tracker with pick recommendations.",
    icon: Waypoints,
  },
  {
    href: "/livedraft",
    title: "Live draft",
    blurb: "Best available and BlaineScore during the draft.",
    icon: Radio,
  },
  {
    href: "/nfl/value/",
    title: "Trade desk",
    blurb: "Rest-of-season trade values.",
    icon: Repeat,
  },
  {
    href: "/nfl/value/league-odds/",
    title: "League odds",
    blurb: "Playoff and title chances for every H-Town Ballers team.",
    icon: Trophy,
  },
  {
    href: "/nfl/value/superflex/",
    title: "Superflex study",
    blurb: "Scoring settings that put starting QBs back on waivers.",
    icon: SlidersHorizontal,
  },
  {
    href: "/nfl/nba/",
    title: "Crabsketball",
    blurb: "Daily lock-in plan, breakouts, week replay and season odds.",
    icon: Volleyball,
  },
];

export default function NflHub() {
  return (
    <NflShell>
      {/* the hero continues the header's turf, with faint yard lines */}
      <section className="bg-turf-950 relative overflow-hidden text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 80px)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-8 sm:pt-14">
          <h1 className="font-display max-w-3xl text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
            Own your friends with based statistics.
          </h1>
          <p className="text-turf-100/85 mt-4 max-w-xl text-lg">
            You are like Brad Pitt in Moneyball. You&apos;re cool as hell.
          </p>
          <div className="mt-8">
            <ScoreboardStrip />
          </div>
        </div>
        <div aria-hidden className="bg-line h-1" />
      </section>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        <section aria-labelledby="tools">
          <h2 id="tools" className="font-display mb-4 text-2xl font-bold">
            Tools
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {TOOLS.map((t) => (
              <a
                key={t.href}
                href={t.href}
                className="group focus-visible:outline-turf-700 flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2"
              >
                <span className="bg-turf-950 text-line grid size-10 place-items-center rounded-lg">
                  <t.icon className="size-5" aria-hidden />
                </span>
                <span className="font-display mt-4 flex items-center gap-1 text-2xl font-bold text-slate-900">
                  {t.title}
                  <ChevronRight
                    className="text-turf-700 size-5 transition group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 flex-1 text-slate-600">{t.blurb}</span>
                <span className="text-turf-700 mt-4 border-t border-slate-100 pt-3 text-sm font-medium">
                  {t.example}
                </span>
              </a>
            ))}
          </div>
        </section>

        <section aria-labelledby="season">
          <h2 id="season" className="font-display mb-4 text-2xl font-bold">
            NFL this season
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SEASON.map((it) => (
              <a
                key={it.href}
                href={it.href}
                className="group hover:border-turf-700 focus-visible:outline-turf-700 flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition focus-visible:outline-2"
              >
                <it.icon
                  className="text-turf-700 mt-0.5 size-5 shrink-0"
                  aria-hidden
                />
                <span>
                  <span className="block font-semibold text-slate-900">
                    {it.title}
                  </span>
                  <span className="block text-sm text-slate-600">
                    {it.blurb}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section aria-labelledby="research">
          <h2 id="research" className="font-display mb-4 text-2xl font-bold">
            Research
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RESEARCH.map((it) => (
              <a
                key={it.href}
                href={it.href}
                className="group hover:border-turf-700 focus-visible:outline-turf-700 flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition focus-visible:outline-2"
              >
                <it.icon
                  className="text-turf-700 mt-0.5 size-5 shrink-0"
                  aria-hidden
                />
                <span>
                  <span className="block font-semibold text-slate-900">
                    {it.title}
                  </span>
                  <span className="block text-sm text-slate-600">
                    {it.blurb}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section aria-labelledby="private">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
            <h2 id="private" className="font-display text-2xl font-bold">
              Draft tools
            </h2>
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <Lock className="size-3.5" aria-hidden /> Private. Sign in with
              blaine-auth.
            </span>
          </div>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {PRIVATE.map((it) => (
              <li key={it.href}>
                <a
                  href={it.href}
                  className="group focus-visible:outline-turf-700 flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  <it.icon
                    className="size-5 shrink-0 text-slate-400"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900">
                      {it.title}
                    </span>
                    <span className="ml-2 text-sm text-slate-500 max-sm:ml-0 max-sm:block">
                      {it.blurb}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </NflShell>
  );
}
