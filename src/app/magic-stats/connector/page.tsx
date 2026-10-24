import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connector",
  description:
    "Use Magic Stats inside ChatGPT or Claude: NFL stats, routes, make the case, and fantasy projections.",
};

const FREE = [
  [
    "player",
    "A player's season, rank at his position, yards per route run, snap share and game log.",
  ],
  [
    "leaderboard",
    "This season's leaders in a usage stat: target share, routes, yards per route run, expected points and more.",
  ],
  [
    "make_the_case",
    "The stat splits where a player or team ranks first (or last).",
  ],
  [
    "describe_data and run_sql",
    "Every play since 1999, for questions the other tools don't cover. Your assistant writes the SQL.",
  ],
];

const PRO = [
  [
    "projections",
    "This week's PPR projection for every QB, RB, WR and TE, with floor, ceiling and breakout chance.",
  ],
  [
    "start_sit",
    "Who to start among a few players, and who has the higher floor or ceiling.",
  ],
  ["trade_check", "Rest-of-season points going out and coming in."],
];

const SOURCES = [
  [
    "nflverse",
    "Play-by-play (nflfastR), box scores, rosters, schedules, snap counts, Next Gen Stats, player participation and expected fantasy points (ffopportunity). CC-BY 4.0.",
    "https://github.com/nflverse",
  ],
  [
    "FTN Data",
    "Hand-charted play details since 2022 (play action, motion, blitzes, drops), shared through nflverse.",
    "https://ftndata.com",
  ],
  [
    "Magic Stats",
    "Projections, breakout chances and estimated routes come from our own model, built on the data above.",
    null,
  ],
] as const;

function ToolList({ items }: { items: string[][] }) {
  return (
    <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {items.map(([name, desc]) => (
        <div key={name} className="px-4 py-3 sm:flex sm:gap-4">
          <dt className="shrink-0 font-mono text-sm font-semibold text-slate-900 sm:w-52">
            {name}
          </dt>
          <dd className="mt-0.5 text-sm text-slate-600 sm:mt-0">{desc}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ConnectorPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-5 pb-16 sm:pt-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Magic Stats in your assistant
        </h1>
        <p className="mt-2 text-base text-slate-600 sm:text-lg">
          Connect Magic Stats to ChatGPT or Claude and ask NFL questions in the
          chat you already use. Answers come from real play-by-play data, so the
          numbers aren&apos;t made up.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">
          How to connect
        </h2>
        <p className="mb-3 text-slate-700">
          It&apos;s invite-only while we test it with friends. Ask Blaine for
          your connector link, then:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
          <li>
            <strong className="font-semibold">ChatGPT:</strong> turn on
            developer mode in Settings, then create a new app with your link and
            no authentication.
          </li>
          <li>
            <strong className="font-semibold">Claude:</strong> in Settings, add
            a custom connector with your link.
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-500">
          Your link works like a password. Don&apos;t share it.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">
          What it can do
        </h2>
        <ToolList items={FREE} />
        <h3 className="mt-6 mb-3 font-semibold text-slate-900">Pro</h3>
        <ToolList items={PRO} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-900">
          Data sources
        </h2>
        <ul className="space-y-3 text-sm text-slate-700">
          {SOURCES.map(([name, desc, href]) => (
            <li key={name}>
              {href ? (
                <a
                  href={href}
                  className="text-turf-800 font-semibold underline underline-offset-2"
                >
                  {name}
                </a>
              ) : (
                <span className="font-semibold text-slate-900">{name}</span>
              )}
              : {desc}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-500">
          Magic Stats isn&apos;t affiliated with the NFL or any team.
        </p>
      </section>
    </main>
  );
}
