"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchMakerSummary,
  type MakerGame,
  type MakerMode,
  type MakerSummary,
} from "@/lib/polyhedge/maker";
import { qk } from "@/lib/polyhedge/queryKeys";
import { Section } from "@/components/polyhedge/ui/Section";
import { SummaryCard, SummaryGrid } from "@/components/polyhedge/SummaryCard";
import {
  Table,
  TBody,
  Th,
  THead,
  Tr,
  Td,
  EmptyRow,
} from "@/components/polyhedge/ui/Table";
import { PnLBadge } from "@/components/polyhedge/PnLBadge";
import { ago } from "@/lib/polyhedge/format";

const C = {
  pnl: "#48bb78",
  price: "#90cdf4",
  grid: "#2d3748",
  axis: "#718096",
};

function clock(t: number | null | undefined): string {
  if (!t) return "—";
  return new Date(t * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function day(t: number | null | undefined): string {
  if (!t) return "—";
  return new Date(t * 1000).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function cents(p: number | null | undefined): string {
  return p == null ? "—" : `${(p * 100).toFixed(1).replace(/\.0$/, "")}¢`;
}

function sh(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(1).replace(/\.0$/, "");
}

export function MakerView() {
  const [mode, setMode] = useState<MakerMode>("live");
  const q = useQuery<MakerSummary>({
    queryKey: qk.maker(mode),
    queryFn: () => fetchMakerSummary(mode),
    refetchInterval: 15_000,
  });
  const d = q.data;
  const bot = d?.bot ?? {};
  const botLive = String(bot.MAKER_LIVE ?? "") === "1";
  const syncedAgo = d?.synced_at ? d.now - d.synced_at : null;
  const shown = (d?.games ?? []).filter((g) => g.running || (g.recent && g.fills > 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <div className="ph-segmented">
          {(["live", "paper"] as const).map((m) => (
            <button key={m} type="button" data-active={mode === m} onClick={() => setMode(m)}>
              {m === "live" ? "Real money" : "Paper"}
            </button>
          ))}
        </div>
        <span className="ph-muted-2" style={{ fontSize: 11 }}>
          Bot on VPS:{" "}
          <span className={bot.active === "active" ? "ph-pos" : "ph-neg"}>
            {String(bot.active ?? "unknown")}
          </span>{" "}
          · mode{" "}
          <span className={botLive ? "ph-warn" : "ph-text"}>{botLive ? "REAL MONEY" : "paper"}</span>{" "}
          · {bot.MAKER_SIZE ?? "—"} sh quotes · net cap {bot.MAKER_NET_CAP ?? "—"} · loss caps $
          {bot.MAKER_GAME_LOSS_CAP ?? "—"}/game ${bot.MAKER_TOTAL_LOSS_CAP ?? "—"}/run · data{" "}
          <span className={syncedAgo != null && syncedAgo > 120 ? "ph-neg" : undefined}>
            {syncedAgo == null ? "—" : `${ago(syncedAgo)} old`}
          </span>
        </span>
      </div>

      <SummaryGrid>
        <SummaryCard
          label="P&L, last 36 h"
          value={<PnLBadge value={d?.totals.recent_pnl ?? null} bold />}
          sub="final if settled, else marked to Kalshi"
        />
        <SummaryCard label="Fills, last 36 h" value={d?.totals.recent_fills ?? "—"} />
        <SummaryCard label="Games running" value={d?.totals.running ?? "—"} />
        <SummaryCard
          label={`All ${mode === "live" ? "real-money" : "paper"} games`}
          value={<PnLBadge value={d?.totals.all_pnl ?? null} bold />}
          sub={d ? `${d.totals.all_games} games traded` : undefined}
        />
      </SummaryGrid>

      {q.isError && (
        <div className="ph-neg" style={{ fontSize: 12 }}>
          Could not load maker data: {String(q.error)}
        </div>
      )}

      {shown.length === 0 && !q.isLoading && (
        <div className="ph-muted-2" style={{ fontSize: 12 }}>
          No {mode === "live" ? "real-money" : "paper"} games in the last 36 hours.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          gap: 12,
        }}
      >
        {shown.map((g) => (
          <GameCard key={g.key} g={g} series={d?.series[g.key] ?? []} />
        ))}
      </div>

      <Section title={`Recent fills · last ${Math.min(50, d?.fills.length ?? 0)} of ${d?.totals.recent_fills ?? 0}`}>
        <Table>
          <THead>
            <Tr>
              <Th>Time</Th>
              <Th>Game</Th>
              <Th>Trade</Th>
              <Th>Shares</Th>
              <Th>Price</Th>
              <Th>Kalshi fair</Th>
              <Th>Edge</Th>
            </Tr>
          </THead>
          <TBody>
            {(d?.fills.length ?? 0) === 0 && <EmptyRow colSpan={7}>No fills</EmptyRow>}
            {d?.fills.slice(0, 50).map((f, i) => (
              <Tr key={`${f.t}-${i}`}>
                <Td className="ph-muted-2">{clock(f.t)}</Td>
                <Td className="ph-muted-2">{f.game.split("-").slice(1).join("-")}</Td>
                <Td>
                  <span className={f.side === "BUY" ? "ph-accent" : "ph-purple-soft"}>
                    {f.side === "BUY" ? "Buy" : "Sell"}
                  </span>{" "}
                  {f.team}
                </Td>
                <Td>{sh(f.qty)}</Td>
                <Td>{cents(f.price)}</Td>
                <Td className="ph-muted-2">{cents(f.fair)}</Td>
                <Td>
                  <span className={f.edge_c == null ? "" : f.edge_c >= 0 ? "ph-pos" : "ph-neg"}>
                    {f.edge_c == null ? "—" : `${f.edge_c >= 0 ? "+" : ""}${f.edge_c.toFixed(1)}¢`}
                  </span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section title={`All ${mode === "live" ? "real-money" : "paper"} games`} defaultCollapsed>
        <Table>
          <THead>
            <Tr>
              <Th>Date</Th>
              <Th>Game</Th>
              <Th>Fills</Th>
              <Th>Shares</Th>
              <Th>Winner</Th>
              <Th>P&L</Th>
            </Tr>
          </THead>
          <TBody>
            {d?.games
              .filter((g) => g.fills > 0)
              .map((g) => (
                <Tr key={g.key}>
                  <Td className="ph-muted-2">{day(g.first_t)}</Td>
                  <Td>
                    {g.team_a} vs {g.team_b}{" "}
                    <span className="ph-badge">{g.league.toUpperCase()}</span>
                  </Td>
                  <Td>{g.fills}</Td>
                  <Td>{Math.round(g.shares).toLocaleString()}</Td>
                  <Td className="ph-muted-2">{g.winner ?? (g.running ? "in play" : "—")}</Td>
                  <Td>
                    <PnLBadge value={g.pnl} />
                    {g.settled == null && g.pnl != null && (
                      <span className="ph-muted" style={{ fontSize: 9 }}> marked</span>
                    )}
                  </Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </Section>

      <Section title={`Errors & restarts · ${d?.problems.length ?? 0}`} defaultCollapsed>
        <Table>
          <THead>
            <Tr>
              <Th>Time</Th>
              <Th>Game</Th>
              <Th>Event</Th>
              <Th>Detail</Th>
            </Tr>
          </THead>
          <TBody>
            {(d?.problems.length ?? 0) === 0 && <EmptyRow colSpan={4}>Nothing logged</EmptyRow>}
            {d?.problems.map((p, i) => (
              <Tr key={`${p.t}-${i}`}>
                <Td className="ph-muted-2">{clock(p.t)}</Td>
                <Td className="ph-muted-2">{p.game.split("-").slice(1).join("-")}</Td>
                <Td className={p.ev.endsWith("error") ? "ph-warn" : undefined}>{p.ev}</Td>
                <Td className="ph-muted-2" style={{ fontSize: 10 }}>
                  {p.detail}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>
    </div>
  );
}

function GameCard({
  g,
  series,
}: {
  g: MakerGame;
  series: [number, number | null, number | null, number | null][];
}) {
  const data = series.map(([t, pnl, kmid]) => ({
    t,
    pnl,
    price: kmid == null ? null : Math.round(kmid * 1000) / 10,
  }));
  const holdA = g.inv_a ?? 0;
  const holdB = g.inv_b ?? 0;
  return (
    <div className="ph-card" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          {g.team_a} <span className="ph-muted-2">vs</span> {g.team_b}{" "}
          <span className="ph-badge">{g.league.toUpperCase()}</span>{" "}
          {g.running ? (
            <span className="ph-pos" style={{ fontSize: 10 }}>● running</span>
          ) : (
            <span className="ph-muted-2" style={{ fontSize: 10 }}>{g.winner ? `${g.winner} won` : "ended"}</span>
          )}
          {g.stopped && <span className="ph-neg" style={{ fontSize: 10 }}> · stopped (cap)</span>}
        </div>
        <div style={{ fontSize: 18 }}>
          <PnLBadge value={g.pnl} bold />
        </div>
      </div>

      <div
        className="ph-muted-2"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6, fontSize: 11 }}
      >
        <Stat label={`Kalshi ${g.team_a}`} value={cents(g.kmid)} />
        <Stat
          label="Polymarket bid / ask"
          value={g.poly ? `${cents(g.poly[0])} / ${cents(g.poly[1])}` : "—"}
        />
        <Stat label="Fills" value={`${g.fills} · ${Math.round(g.shares).toLocaleString()} sh`} />
        <Stat
          label="Holding"
          value={`${sh(holdA)} ${g.team_a.split(" ")[0]} · ${sh(holdB)} ${g.team_b.split(" ")[0]}`}
        />
        <Stat label="Last 60 s marks" value={<PnLBadge value={g.pnl_60s} />} />
        <Stat label="Updated" value={clock(g.last_t)} />
      </div>

      {data.length > 1 && (
        <div style={{ width: "100%", height: 170 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="2 4" />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) =>
                  new Date(t * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                }
                stroke={C.axis}
                fontSize={10}
                tickCount={5}
              />
              <YAxis yAxisId="pnl" stroke={C.pnl} fontSize={10} tickFormatter={(v) => `$${v}`} />
              <YAxis
                yAxisId="price"
                orientation="right"
                domain={[0, 100]}
                stroke={C.price}
                fontSize={10}
                tickFormatter={(v) => `${v}¢`}
              />
              <Tooltip
                contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748", fontSize: 11 }}
                labelFormatter={(t) => clock(Number(t))}
                formatter={(v, name) =>
                  name === "pnl" ? [`$${Number(v).toFixed(2)}`, "P&L"] : [`${v}¢`, `Kalshi ${g.team_a}`]
                }
              />
              <Line yAxisId="pnl" dataKey="pnl" stroke={C.pnl} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line
                yAxisId="price"
                dataKey="price"
                stroke={C.price}
                dot={false}
                strokeWidth={1}
                strokeDasharray="3 3"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="ph-muted" style={{ fontSize: 9 }}>
        Green: P&L marked to Kalshi (left axis). Dashed blue: Kalshi price of {g.team_a} (right axis).
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div className="ph-text" style={{ fontSize: 12 }}>
        {value}
      </div>
    </div>
  );
}
