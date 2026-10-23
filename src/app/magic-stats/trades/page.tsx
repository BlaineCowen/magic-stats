import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowLeftRight } from "lucide-react";
import {
  loadTrades,
  type Trade,
  type TradeData,
  type TradeTeam,
} from "@/lib/nfl/trades";
import { viewerFrom } from "@/lib/query-limits";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Trade ideas",
  description:
    "Trades that make both lineups better, for every team in H-Town Ballers.",
};

// Rosters change daily, and Blaine sees more than everyone else, so never cache this page.
export const dynamic = "force-dynamic";

const fmt = (n: number | null | undefined) =>
  n == null ? "–" : Math.round(n).toLocaleString("en-US");
const signed = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n)}`;

function teamLabel(t: TradeTeam) {
  return t.teamName ?? t.owner;
}

function PlayerList({
  ids,
  data,
  owner,
}: {
  ids: string[];
  data: TradeData;
  owner: boolean;
}) {
  return (
    <ul className="space-y-1">
      {ids.map((id) => {
        const p = data.players[id];
        if (!p) return null;
        return (
          <li key={id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-slate-900">{p.name}</span>
            <span className="text-sm text-slate-500">
              {p.pos} · {p.team}
            </span>
            {p.injury && (
              <span className="rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-800">
                {p.injury}
              </span>
            )}
            {owner && p.numbers && (
              <span className="text-xs text-slate-500 tabular-nums">
                {fmt(p.numbers.ours)} ours · {fmt(p.numbers.market)} market
                {p.numbers.etrRank != null && ` · ETR #${p.numbers.etrRank}`}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TradeCard({
  trade,
  me,
  data,
  owner,
}: {
  trade: Trade;
  me: number;
  data: TradeData;
  owner: boolean;
}) {
  const mine = trade.sides.findIndex((s) => s.rosterId === me);
  const side = trade.sides[mine]!;
  const other = trade.sides[1 - mine]!;
  const partner = data.teams.find((t) => t.rosterId === other.rosterId);
  const n = trade.numbers;
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">
        With{" "}
        <a
          href={`#team-${other.rosterId}`}
          className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
        >
          {partner ? teamLabel(partner) : "another team"}
        </a>
        {partner?.teamName && ` (${partner.owner})`}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
        <div>
          <div className="mb-1 text-xs font-semibold text-red-700">Give</div>
          <PlayerList ids={side.gives} data={data} owner={owner} />
        </div>
        <ArrowLeftRight
          className="hidden size-5 self-center text-slate-300 sm:block"
          aria-hidden
        />
        <div>
          <div className="text-turf-700 mb-1 text-xs font-semibold">Get</div>
          <PlayerList ids={side.gets} data={data} owner={owner} />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{side.why}</p>
      <p className="mt-1 text-sm text-slate-500">For them: {other.why}</p>
      {owner && n && (
        <dl className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs tabular-nums sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Lineup gain</dt>
            <dd className="font-semibold text-slate-900">
              {signed(n.gain[mine]!)} you · {signed(n.gain[1 - mine]!)} them
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Our values</dt>
            <dd className="font-semibold text-slate-900">
              {fmt(n.ours[mine])} for {fmt(n.ours[1 - mine])}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Market</dt>
            <dd className="font-semibold text-slate-900">
              {fmt(n.market[mine])} for {fmt(n.market[1 - mine])}
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}

function Tags({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "need" | "surplus";
}) {
  if (!items.length) return null;
  return (
    <span className="text-sm text-slate-600">
      {label}{" "}
      {items.map((p) => (
        <span
          key={p}
          className={cn(
            "ml-1 rounded px-1.5 py-0.5 text-xs font-semibold",
            tone === "need"
              ? "bg-red-50 text-red-700"
              : "bg-turf-50 text-turf-800",
          )}
        >
          {p}
        </span>
      ))}
    </span>
  );
}

export default async function TradesPage() {
  const viewer = viewerFrom(await headers());
  const owner = viewer.tier === "owner";
  const data = await loadTrades(owner);

  return (
    <main className="mx-auto max-w-4xl px-4 pt-5 pb-16 sm:pt-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Trade ideas
        </h1>
        <p className="mt-1.5 max-w-2xl text-base text-slate-600 sm:mt-2 sm:text-lg">
          Trades for every team in {data?.league.name ?? "H-Town Ballers"} where
          both starting lineups get better, and neither side is giving away much
          more than it gets.
        </p>
      </header>

      {!data ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-slate-600">
          No trade ideas yet. They&apos;re rebuilt every morning.
        </p>
      ) : (
        <>
          <nav aria-label="Teams" className="mb-8 flex flex-wrap gap-2">
            {data.teams.map((t) => (
              <a
                key={t.rosterId}
                href={`#team-${t.rosterId}`}
                className="hover:border-turf-700 focus-visible:outline-turf-700 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 focus-visible:outline-2"
              >
                {teamLabel(t)}
              </a>
            ))}
          </nav>

          <div className="space-y-10">
            {data.teams.map((t) => (
              <section
                key={t.rosterId}
                id={`team-${t.rosterId}`}
                aria-labelledby={`team-${t.rosterId}-name`}
                className="scroll-mt-20"
              >
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2
                    id={`team-${t.rosterId}-name`}
                    className="font-display text-2xl font-bold text-slate-900"
                  >
                    {teamLabel(t)}
                  </h2>
                  <span className="text-sm text-slate-500">
                    {t.teamName ? `${t.owner} · ` : ""}
                    {t.record}
                    {owner &&
                      t.numbers &&
                      ` · lineup ${fmt(t.numbers.strength)}`}
                  </span>
                </div>
                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
                  <Tags label="Needs" items={t.need} tone="need" />
                  <Tags label="Deep at" items={t.surplus} tone="surplus" />
                </div>
                {t.trades.length ? (
                  <ul className="space-y-3">
                    {t.trades.map((i) => {
                      const tr = data.trades[i];
                      return tr ? (
                        <TradeCard
                          key={i}
                          trade={tr}
                          me={t.rosterId}
                          data={data}
                          owner={owner}
                        />
                      ) : null;
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">
                    Nothing today that helps both sides.
                  </p>
                )}
              </section>
            ))}
          </div>

          <p className="mt-10 max-w-3xl text-sm text-slate-500">
            Player values are Establish the Run&apos;s rest-of-season trade
            values for 2-QB half PPR, adjusted to how many players this league
            starts at each position. A trade makes the list when it improves
            both teams&apos; best lineups (with a little credit for bench depth)
            and looks fair by those values and by the FantasyCalc trade market.
            Updated{" "}
            {new Date(data.generated).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            {data.league.tradeDeadline != null &&
              `. Trade deadline: week ${data.league.tradeDeadline}`}
            .
          </p>
        </>
      )}
    </main>
  );
}
