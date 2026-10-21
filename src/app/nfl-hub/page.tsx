import type { Metadata } from "next";
import {
  BarChart3,
  Calculator,
  ClipboardList,
  Lock,
  MessageSquareText,
  Radio,
  Repeat,
  Trophy,
  Volleyball,
  Waypoints,
} from "lucide-react";

/**
 * The NFL hub, served at projects.blainecowen.com/nfl/ (nfl-router proxies that exact path here).
 * Links are absolute site paths because the pages live in three places: this app, the static
 * Draft & Pick'em export under /nfl/, and its hand-written pages. Private ones sit behind
 * blaine-auth in nfl-router, so they only open for Blaine.
 */

export const metadata: Metadata = {
  title: "NFL",
  description: "NFL stats, 4th down decisions, playoff odds and pick'em",
};

type Item = {
  href: string;
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
};

const SECTIONS: {
  title: string;
  note?: string;
  private?: boolean;
  items: Item[];
}[] = [
  {
    title: "Stats and analysis",
    items: [
      {
        href: "/magic-stats",
        title: "Ask a question",
        blurb: "Plain-English questions answered from nflverse play-by-play.",
        icon: MessageSquareText,
      },
      {
        href: "/magic-stats/charts",
        title: "Charts",
        blurb:
          "Team tiers and quarterback EPA, filterable by season, week and situation.",
        icon: BarChart3,
      },
      {
        href: "/magic-stats/fourth-down",
        title: "4th down decisions",
        blurb:
          "Go, kick or punt, graded by win probability. Includes Shanahan's three Super Bowls.",
        icon: Calculator,
        tag: "New",
      },
    ],
  },
  {
    title: "This season",
    items: [
      {
        href: "/nfl/playoffs/",
        title: "Playoff odds",
        blurb: "Season simulation against Kalshi futures.",
        icon: Trophy,
      },
      {
        href: "/nfl/pickem/",
        title: "Pick'em assistant",
        blurb: "Confidence pool picks with live scores.",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "Draft tools",
    note: "Private. Sign in with blaine-auth.",
    private: true,
    items: [
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
        href: "/nfl/nba/",
        title: "Crabsketball draft board",
        blurb: "NBA draft values and grades.",
        icon: Volleyball,
      },
    ],
  },
];

export default function NflHub() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">NFL</h1>
        <p className="mt-1 text-sm text-gray-600">
          Stats, decision tools and fantasy, in one place.
        </p>
      </header>
      <div className="space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
                {s.title}
              </h2>
              {s.note && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Lock className="size-3" aria-hidden /> {s.note}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it) => (
                <a
                  key={it.href}
                  href={it.href}
                  className="group flex gap-3 rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <it.icon
                    className="mt-0.5 size-5 shrink-0 text-blue-600"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 group-hover:text-blue-700">
                        {it.title}
                      </span>
                      {it.tag && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 uppercase">
                          {it.tag}
                        </span>
                      )}
                      {s.private && (
                        <Lock
                          className="size-3.5 text-gray-400"
                          aria-label="private"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-600">{it.blurb}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
