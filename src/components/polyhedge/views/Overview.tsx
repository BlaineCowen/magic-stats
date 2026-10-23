"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import { Section } from "@/components/polyhedge/ui/Section";
import { SummaryCard, SummaryGrid } from "@/components/polyhedge/SummaryCard";
import { Table, TBody, Th, THead, Tr, Td, EmptyRow } from "@/components/polyhedge/ui/Table";
import { ago, clsForSign, dollars, fmt } from "@/lib/polyhedge/format";
import type { Tab } from "@/components/polyhedge/TabNav";

// GET /api/overview (overview.py in the poly-hedge repo)
interface SystemRow {
  name: string;
  what: string;
  state: "ok" | "warn" | "off";
  last: number | null;
  detail: string;
}
interface Overview {
  now: number;
  systems: SystemRow[];
  money: {
    pnl: {
      realized: number;
      unrealized: number;
      by_strategy: { strategy: string; realized: number }[];
      balances: Record<string, { available_dollars: number; locked_dollars: number }>;
      last_sync: string;
    } | null;
    maker_all: number | null;
    maker_cap: number | null;
    maker_room: number | null;
    maker_account: { cash: number; positions_value: number; unclaimed: number; n_positions: number } | null;
  };
  tonight: {
    maker_games: {
      key: string;
      name: string;
      running: boolean;
      pnl: number | null;
      fills: number;
      net: number;
      stopped: boolean;
      kmid: number | null;
    }[];
    futures_trades: {
      t: string;
      team: string;
      market: string;
      side: number;
      px: number;
      fair: number;
      edge: number;
      touch: number | null;
      pnl_hold: number | null;
      pnl_sell: number | null;
    }[];
    elections: { series: string; date: string }[];
  };
}

const STATE_LABEL = { ok: "running", warn: "check", off: "off" } as const;
const STATE_CLASS = { ok: "ph-pos", warn: "ph-warn-strong", off: "ph-muted-2" } as const;
// Systems whose detail lives on another tab
const OPENS: Record<string, Tab> = { "Maker bot": "maker" };

const cents = (v: number | null | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}¢`);

export function OverviewView({ onOpen }: { onOpen: (t: Tab) => void }) {
  const q = useQuery<Overview>({
    queryKey: qk.overview,
    queryFn: () => api.get<Overview>("/api/overview"),
    refetchInterval: 30_000,
  });
  if (q.isError) {
    return <div className="ph-ov-note ph-neg">Could not load the overview: {(q.error).message}</div>;
  }
  const d = q.data;
  if (!d) return <div className="ph-ov-note">Loading…</div>;

  const warn = d.systems.filter((s) => s.state === "warn");
  const m = d.money;
  const bal = m.pnl?.balances ?? {};
  const kalshi = bal.kalshi;
  const poly = m.maker_account;
  const games = [...d.tonight.maker_games].sort((a, b) => Number(b.running) - Number(a.running)).slice(0, 10);

  return (
    <>
      <div className="ph-ov-note">
        {warn.length === 0 ? (
          <span className="ph-pos">Everything that should be running is running.</span>
        ) : (
          <span className="ph-warn-strong">
            {warn.length} need{warn.length === 1 ? "s" : ""} a look: {warn.map((s) => s.name).join(", ")}
          </span>
        )}{" "}
        · updated {new Date(q.dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </div>

      <Section title="Money" collapsible={false}>
        <SummaryGrid>
          <SummaryCard
            label="Kalshi cash"
            value={dollars(kalshi?.available_dollars)}
            sub={kalshi?.locked_dollars ? `${dollars(kalshi.locked_dollars)} in orders` : undefined}
          />
          <SummaryCard
            label="Polymarket"
            value={dollars(poly ? poly.cash + poly.positions_value + poly.unclaimed : null)}
            sub={
              poly
                ? `${dollars(poly.cash)} cash · ${dollars(poly.positions_value)} in ${poly.n_positions} positions` +
                  (poly.unclaimed ? ` · ${dollars(poly.unclaimed)} to claim` : "")
                : undefined
            }
          />
          <SummaryCard
            label="Realized P&L (settled)"
            value={fmt(m.pnl?.realized)}
            valueClass={clsForSign(m.pnl?.realized)}
            sub={m.pnl?.by_strategy.map((s) => `${s.strategy} ${fmt(s.realized)}`).join(" · ")}
          />
          <SummaryCard
            label="Maker bot, all time"
            value={fmt(m.maker_all)}
            valueClass={clsForSign(m.maker_all)}
            sub={m.maker_room != null ? `stops itself after ${dollars(m.maker_room)} more loss (cap ${dollars(m.maker_cap)})` : undefined}
          />
        </SummaryGrid>
      </Section>

      <Section title="Systems" collapsible={false}>
        <div className="ph-ov-grid ph-ov-pad">
          {d.systems.map((s) => (
            <div key={s.name} className={`ph-ov-sys ${s.state}`}>
              <div className="ph-ov-sys-head">
                <span className="ph-ov-sys-name">{s.name}</span>
                <span className={`ph-ov-sys-state ${STATE_CLASS[s.state]}`}>
                  {STATE_LABEL[s.state]}
                  {s.last != null && s.state !== "off" ? ` · ${ago(d.now - s.last)} ago` : ""}
                </span>
              </div>
              <div className="ph-ov-sys-what">{s.what}</div>
              <div className="ph-ov-sys-detail">{s.detail}</div>
              {OPENS[s.name] && (
                <button type="button" className="ph-ov-link" onClick={() => onOpen(OPENS[s.name]!)}>
                  open →
                </button>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Maker bot games" right={<button type="button" className="ph-ov-link" onClick={() => onOpen("maker")}>details →</button>}>
        <Table>
          <THead>
            <Tr>
              <Th>Game</Th>
              <Th>Status</Th>
              <Th style={{ textAlign: "right" }}>Fills</Th>
              <Th style={{ textAlign: "right" }}>Holding</Th>
              <Th style={{ textAlign: "right" }}>P&L</Th>
            </Tr>
          </THead>
          <TBody>
            {games.length === 0 && <EmptyRow colSpan={5}>No maker games in the last day and a half.</EmptyRow>}
            {games.map((g) => (
              <Tr key={g.key}>
                <Td>{g.name}</Td>
                <Td className={g.stopped ? "ph-neg" : g.running ? "ph-pos" : "ph-muted-2"}>
                  {g.stopped ? "stopped" : g.running ? "live" : "done"}
                </Td>
                <Td style={{ textAlign: "right" }}>{g.fills}</Td>
                <Td style={{ textAlign: "right" }}>{g.net ? `${g.net > 0 ? "+" : ""}${g.net.toFixed(0)} sh` : "—"}</Td>
                <Td style={{ textAlign: "right" }} className={clsForSign(g.pnl)}>{fmt(g.pnl)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section title="Playoff futures — paper trades">
        <Table>
          <THead>
            <Tr>
              <Th>When</Th>
              <Th>Market</Th>
              <Th style={{ textAlign: "right" }}>Price</Th>
              <Th style={{ textAlign: "right" }}>Model</Th>
              <Th style={{ textAlign: "right" }}>Held</Th>
              <Th style={{ textAlign: "right" }}>Sold next day</Th>
            </Tr>
          </THead>
          <TBody>
            {d.tonight.futures_trades.length === 0 && (
              <EmptyRow colSpan={6}>No paper trades yet. One fires when a game hits 90% and a futures price is 3¢+ off.</EmptyRow>
            )}
            {d.tonight.futures_trades.map((t) => (
              <Tr key={`${t.t}-${t.team}-${t.market}-${t.side}`}>
                <Td>{new Date(t.t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</Td>
                <Td>
                  {t.side === 1 ? "Buy" : "Sell"} {t.team} {t.market}
                </Td>
                <Td style={{ textAlign: "right" }}>{(t.px * 100).toFixed(0)}¢</Td>
                <Td style={{ textAlign: "right" }}>{(t.fair * 100).toFixed(1)}¢</Td>
                <Td style={{ textAlign: "right" }} className={clsForSign(t.pnl_hold)}>{cents(t.pnl_hold)}</Td>
                <Td style={{ textAlign: "right" }} className={clsForSign(t.pnl_sell)}>{cents(t.pnl_sell)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>

      {d.tonight.elections.length > 0 && (
        <Section title="Election nights being watched">
          <div className="ph-ov-pad ph-text-2">
            {d.tonight.elections.map((e) => `${e.series.replace(/^KX/, "")} (${e.date})`).join(" · ")}
          </div>
        </Section>
      )}
    </>
  );
}
