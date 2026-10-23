"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchMakerGame,
  fetchMakerSummary,
  fetchMakerUpcoming,
  type MakerUpcoming,
  type MakerUpcomingGame,
  type MakerFill,
  type MakerGame,
  type MakerGameDetail,
  type MakerMode,
  type MakerSummary,
} from "@/lib/polyhedge/maker";
import { qk } from "@/lib/polyhedge/queryKeys";
import { Section } from "@/components/polyhedge/ui/Section";
import {
  Table,
  TBody,
  Th,
  THead,
  Tr,
  Td,
  EmptyRow,
} from "@/components/polyhedge/ui/Table";
import { ago, fmt } from "@/lib/polyhedge/format";

const C = {
  pos: "#48bb78",
  neg: "#fc8181",
  price: "#90cdf4",
  buy: "#48bb78",
  sell: "#f6ad55",
  pos2: "#d6bcfa",
  grid: "#232b3b",
  axis: "#718096",
};
const AXIS = {
  stroke: C.axis,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

// ─── formatting ──────────────────────────────────────────────────────────
const clock = (t?: number | null) =>
  t
    ? new Date(t * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
const clockS = (t?: number | null) =>
  t
    ? new Date(t * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
const day = (t?: number | null) =>
  t
    ? new Date(t * 1000).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })
    : "—";
const cents = (p?: number | null) =>
  p == null ? "—" : `${(p * 100).toFixed(1).replace(/\.0$/, "")}¢`;
const sh = (v?: number | null) =>
  v == null ? "—" : v.toFixed(1).replace(/\.0$/, "");
const short = (name: string) => (name.length > 12 ? name.split(" ")[0] : name);
const pnlColor = (v?: number | null) =>
  v == null || v === 0 ? "#e2e8f0" : v > 0 ? C.pos : C.neg;

function matchup(g: { team_a: string; team_b: string }) {
  return `${short(g.team_a)} – ${short(g.team_b)}`;
}

// ─── view ────────────────────────────────────────────────────────────────
export function MakerView() {
  const [mode, setMode] = useState<MakerMode>("live");
  const [picked, setPicked] = useState<string | null>(null);
  const q = useQuery<MakerSummary>({
    queryKey: qk.maker(mode),
    queryFn: () => fetchMakerSummary(mode),
    refetchInterval: 15_000,
  });
  const d = q.data;

  // newest first; games the bot loaded but never traded are left out
  const traded = useMemo(
    () =>
      (d?.games ?? [])
        .filter((g) => g.fills > 0 || g.running)
        .sort(
          (a, b) =>
            Number(b.running) - Number(a.running) ||
            (b.game_t ?? 0) - (a.game_t ?? 0),
        ),
    [d],
  );
  useEffect(() => {
    if (!traded.length) return;
    if (!picked || !traded.some((g) => g.key === picked))
      setPicked(traded[0]!.key);
  }, [traded, picked]);
  const sel = traded.find((g) => g.key === picked) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Header
        d={d}
        mode={mode}
        setMode={(m) => {
          setMode(m);
          setPicked(null);
        }}
      />
      {q.isError && (
        <div className="ph-neg" style={{ fontSize: 13 }}>
          Could not load maker data: {String(q.error)}
        </div>
      )}
      <Kpis d={d} traded={traded} />
      {sel && <GameDetail g={sel} mode={mode} />}
      <div className="mk-panel">
        <div className="mk-panel-title">
          <span>Games · {traded.length}</span>
          <span className="mk-sub" style={{ fontWeight: 400 }}>
            click a row to open it above
          </span>
        </div>
        {traded.length === 0 ? (
          <div className="mk-sub">
            {q.isLoading
              ? "Loading…"
              : `No ${mode === "live" ? "real-money" : "paper"} games yet.`}
          </div>
        ) : (
          <GameTable games={traded} picked={picked} onPick={setPicked} />
        )}
      </div>
      {traded.length > 0 && <Trends traded={traded} />}
      <Upcoming />
      <Account d={d} />
      <Section
        title={`Errors & restarts · last 36 h · ${d?.problems.length ?? 0}`}
        defaultCollapsed
      >
        <Table className="mk-table">
          <THead>
            <Tr>
              <Th>Time</Th>
              <Th>Game</Th>
              <Th>Event</Th>
              <Th>Detail</Th>
            </Tr>
          </THead>
          <TBody>
            {(d?.problems.length ?? 0) === 0 && (
              <EmptyRow colSpan={4}>Nothing logged</EmptyRow>
            )}
            {d?.problems.map((p, i) => (
              <Tr key={`${p.t}-${i}`}>
                <Td className="ph-muted-2">{clockS(p.t)}</Td>
                <Td className="ph-muted-2">
                  {p.game.split("-").slice(1).join("-")}
                </Td>
                <Td className={p.ev.endsWith("error") ? "ph-warn" : undefined}>
                  {p.ev}
                </Td>
                <Td className="ph-muted-2" style={{ fontSize: 12 }}>
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

// ─── header ──────────────────────────────────────────────────────────────
function Header({
  d,
  mode,
  setMode,
}: {
  d?: MakerSummary;
  mode: MakerMode;
  setMode: (m: MakerMode) => void;
}) {
  const bot = d?.bot ?? {};
  const active = bot.active === "active";
  const live = String(bot.MAKER_LIVE ?? "") === "1";
  const age = d?.synced_at ? d.now - d.synced_at : null;
  return (
    <div className="mk-head">
      <div>
        <div className="mk-title">
          Maker bot
          <span className={`mk-pill ${active ? "mk-pill-ok" : "mk-pill-bad"}`}>
            <span className={`mk-dot ${active ? "mk-dot-pulse" : ""}`} />
            {active ? "running" : String(bot.active ?? "unknown")}
          </span>
          <span className={`mk-pill ${live ? "mk-pill-live" : ""}`}>
            {live ? "real money" : "paper"}
          </span>
        </div>
        <div className="mk-sub" style={{ marginTop: 4 }}>
          {bot.MAKER_SIZE ?? "—"}-share quotes · net cap{" "}
          {bot.MAKER_NET_CAP ?? "—"} · loss caps $
          {bot.MAKER_GAME_LOSS_CAP ?? "—"}/game, $
          {bot.MAKER_TOTAL_LOSS_CAP ?? "—"}/run · data{" "}
          <span className={age != null && age > 120 ? "ph-neg" : undefined}>
            {age == null ? "—" : `${ago(age)} old`}
          </span>
        </div>
      </div>
      <div className="ph-segmented">
        {(["live", "paper"] as const).map((m) => (
          <button
            key={m}
            type="button"
            data-active={mode === m}
            onClick={() => setMode(m)}
          >
            {m === "live" ? "Real money" : "Paper"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── KPIs ────────────────────────────────────────────────────────────────
function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
}) {
  return (
    <div className="mk-kpi">
      <div className="mk-kpi-label">{label}</div>
      <div className="mk-kpi-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="mk-kpi-sub">{sub}</div>}
    </div>
  );
}

function Kpis({ d, traded }: { d?: MakerSummary; traded: MakerGame[] }) {
  const done = traded.filter((g) => g.fills > 0);
  const total = done.reduce((s, g) => s + (g.pnl ?? 0), 0);
  const wins = done.filter((g) => (g.pnl ?? 0) > 0).length;
  const fills = done.reduce((s, g) => s + g.fills, 0);
  const shares = done.reduce((s, g) => s + g.shares, 0);
  const edgeW = done.filter((g) => g.avg_edge_c != null);
  const edgeShares = edgeW.reduce((s, g) => s + g.shares, 0);
  const edge = edgeShares
    ? edgeW.reduce((s, g) => s + (g.avg_edge_c ?? 0) * g.shares, 0) / edgeShares
    : null;
  const m60 = done.reduce((s, g) => s + (g.pnl_60s ?? 0), 0);
  return (
    <div className="mk-kpis">
      <Kpi
        label="Total P&L"
        value={fmt(total)}
        color={pnlColor(total)}
        sub={`${done.length} games · ${wins} up, ${done.length - wins} down`}
      />
      <Kpi
        label="Last 36 hours"
        value={fmt(d?.totals.recent_pnl ?? null)}
        color={pnlColor(d?.totals.recent_pnl)}
        sub={`${d?.totals.recent_fills ?? 0} fills`}
      />
      <Kpi
        label="Fill quality"
        value={fmt(m60)}
        color={pnlColor(m60)}
        sub="what the fills were worth 60 s later; the rest of P&L is holding luck"
      />
      <Kpi
        label="Avg edge vs Kalshi"
        value={
          edge == null ? "—" : `${edge >= 0 ? "+" : ""}${edge.toFixed(2)}¢`
        }
        color={pnlColor(edge)}
        sub="per share, at the moment of the fill"
      />
      <Kpi
        label="Fills"
        value={fills.toLocaleString()}
        sub={`${Math.round(shares).toLocaleString()} shares traded`}
      />
    </div>
  );
}

// ─── every game, one row each ────────────────────────────────────────────
function GameTable({
  games,
  picked,
  onPick,
}: {
  games: MakerGame[];
  picked: string | null;
  onPick: (k: string) => void;
}) {
  return (
    <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
      <Table className="mk-table">
        <THead>
          <Tr>
            <Th>Date</Th>
            <Th>Game</Th>
            <Th style={{ textAlign: "right" }}>P&L</Th>
            <Th style={{ textAlign: "right" }}>Fill quality</Th>
            <Th>Result</Th>
            <Th style={{ textAlign: "right" }}>Fills</Th>
            <Th style={{ textAlign: "right" }}>Avg edge</Th>
          </Tr>
        </THead>
        <TBody>
          {games.map((g) => (
            <Tr
              key={g.key}
              onClick={() => onPick(g.key)}
              className={g.key === picked ? "mk-row-picked" : undefined}
              style={{ cursor: "pointer" }}
            >
              <Td className="ph-muted-2">{day(g.game_t)}</Td>
              <Td>
                {g.team_a} <span className="ph-muted-2">vs</span> {g.team_b}
              </Td>
              <Td style={{ textAlign: "right", color: pnlColor(g.pnl), fontWeight: 700 }}>
                {fmt(g.pnl)}
              </Td>
              <Td style={{ textAlign: "right", color: pnlColor(g.pnl_60s) }}>
                {fmt(g.pnl_60s)}
              </Td>
              <Td>
                {g.running ? (
                  <span className="ph-pos">● live</span>
                ) : g.stopped ? (
                  <span className="ph-neg">stopped</span>
                ) : g.winner ? (
                  <span className="ph-muted-2">{short(g.winner)} won</span>
                ) : (
                  <span className="ph-muted-2">ended</span>
                )}
              </Td>
              <Td style={{ textAlign: "right" }}>{g.fills}</Td>
              <Td style={{ textAlign: "right", color: pnlColor(g.avg_edge_c) }}>
                {g.avg_edge_c == null ? "—" : `${g.avg_edge_c.toFixed(1)}¢`}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

// ─── long-term trends ────────────────────────────────────────────────────
function Trends({ traded }: { traded: MakerGame[] }) {
  const rows = useMemo(() => {
    let cum = 0;
    return traded
      .filter((g) => g.fills > 0)
      .slice()
      .sort((a, b) => (a.game_t ?? 0) - (b.game_t ?? 0))
      .map((g, i) => {
        cum += g.pnl ?? 0;
        return {
          i,
          key: g.key,
          label: `${day(g.game_t)} ${matchup(g)}`,
          tick: day(g.game_t),
          pnl: Math.round((g.pnl ?? 0) * 100) / 100,
          cum: Math.round(cum * 100) / 100,
          edge: g.avg_edge_c,
          fills: g.fills,
        };
      });
  }, [traded]);
  if (rows.length === 0) return null;
  const max = Math.max(0, ...rows.map((r) => r.cum));
  const min = Math.min(0, ...rows.map((r) => r.cum));
  const split = max === min ? 0.5 : max / (max - min); // where the area gradient flips from green to red

  type Row = (typeof rows)[number];
  const tip = (props: unknown) => {
    const { active, payload } = props as {
      active?: boolean;
      payload?: { payload: Row }[];
    };
    const r = payload?.[0]?.payload;
    if (!active || !r) return null;
    return (
      <div className="mk-tip">
        <div style={{ fontWeight: 600 }}>{r.label}</div>
        <div>
          game <span style={{ color: pnlColor(r.pnl) }}>{fmt(r.pnl)}</span> ·
          running total{" "}
          <span style={{ color: pnlColor(r.cum) }}>{fmt(r.cum)}</span>
        </div>
        <div className="mk-tip-muted">
          {r.fills} fills · avg edge {r.edge ?? "—"}¢
        </div>
      </div>
    );
  };
  const lastCum = rows[rows.length - 1]!.cum;

  return (
    <div>
      <div className="mk-panel">
        <div className="mk-panel-title">
          <span>Running total, game by game</span>
          <span style={{ color: pnlColor(lastCum) }}>{fmt(lastCum)}</span>
        </div>
        <div style={{ height: 210 }}>
          <ResponsiveContainer>
            <AreaChart
              data={rows}
              margin={{ top: 6, right: 6, bottom: 0, left: -14 }}
            >
              <defs>
                <linearGradient id="mkCum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor={C.pos} stopOpacity={0.35} />
                  <stop offset={split} stopColor={C.pos} stopOpacity={0.05} />
                  <stop offset={split} stopColor={C.neg} stopOpacity={0.05} />
                  <stop offset={1} stopColor={C.neg} stopOpacity={0.35} />
                </linearGradient>
                <linearGradient id="mkCumLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={split} stopColor={C.pos} />
                  <stop offset={split} stopColor={C.neg} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis
                dataKey="i"
                {...AXIS}
                tickFormatter={(i: number) => rows[i]?.tick ?? ""}
                minTickGap={24}
              />
              <YAxis {...AXIS} tickFormatter={(v) => `$${v}`} width={52} />
              <ReferenceLine y={0} stroke="#4a5568" />
              <Tooltip content={tip} cursor={{ stroke: "#4a5568" }} />
              <Area
                type="linear"
                dataKey="cum"
                stroke="url(#mkCumLine)"
                strokeWidth={2}
                fill="url(#mkCum)"
                dot={{ r: 2.5, fill: "#1a1f2e", strokeWidth: 1.5 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── one game in detail ──────────────────────────────────────────────────
function GameDetail({ g, mode }: { g: MakerGame; mode: MakerMode }) {
  const q = useQuery<MakerGameDetail>({
    queryKey: qk.makerGame(mode, g.key),
    queryFn: () => fetchMakerGame(mode, g.key),
    refetchInterval: g.running ? 15_000 : false,
  });
  const [showAll, setShowAll] = useState(false);
  const det = q.data;

  const { points, buys, sells, t0, t1 } = useMemo(() => {
    const s = det?.series ?? [];
    const f = det?.fills ?? [];
    // keep the stretch where the game was priced (feeds go quiet for hours after a market closes)
    let last = s.length - 1;
    while (last > 0 && s[last]![1] == null && s[last]![2] == null) last--;
    const pts: PointRow[] = s.slice(0, last + 1).map(([t, pnl, k, a, b]) => ({
      t,
      pnl,
      price: k == null ? null : Math.round(k * 1000) / 10,
      a,
      b,
      fills: [],
    }));
    const fx = (x: MakerFill) => ({
      t: x.t,
      fill: Math.round(x.a_price * 1000) / 10,
      qty: x.qty,
      edge: x.edge_c,
      team: x.team,
      side: x.side,
      price: x.price,
    });
    const firstFill = f.length ? Math.min(...f.map((x) => x.t)) : null;
    const from = firstFill == null ? -Infinity : firstFill - 600;
    const shown = pts.filter((p) => p.t >= from);
    // Each fill rides on the nearest point of the price line, so hovering the line there shows it.
    for (const x of f) {
      let best: PointRow | undefined;
      for (const p of shown) if (!best || Math.abs(p.t - x.t) < Math.abs(best.t - x.t)) best = p;
      best?.fills.push(fx(x));
    }
    const ts = [...shown.map((p) => p.t), ...f.map((x) => x.t)];
    return {
      points: shown,
      buys: f.filter((x) => x.a_dir === "buy").map(fx),
      sells: f.filter((x) => x.a_dir === "sell").map(fx),
      t0: ts.length ? Math.min(...ts) : 0,
      t1: ts.length ? Math.max(...ts) : 1,
    };
  }, [det]);

  const fills = (det?.fills ?? []).slice().reverse();
  const xAxis = (
    <XAxis
      dataKey="t"
      type="number"
      domain={[t0, t1]}
      {...AXIS}
      tickFormatter={(t: number) => clock(t)}
      minTickGap={40}
      allowDataOverflow
    />
  );
  const result = g.running
    ? "in play"
    : g.winner
      ? `${g.winner} won${g.official ? "" : " (not yet official)"}`
      : "ended";

  return (
    <div className="mk-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
            {g.team_a} <span className="ph-muted-2">vs</span> {g.team_b}
          </div>
          <div className="mk-sub" style={{ marginTop: 3 }}>
            {day(g.game_t)} · {g.league.toUpperCase()} ·{" "}
            {g.running ? <span className="ph-pos">● in play</span> : result}
            {g.stopped && (
              <span className="ph-neg"> · stopped by loss cap</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{ fontSize: 24, fontWeight: 700, color: pnlColor(g.pnl) }}
          >
            {fmt(g.pnl)}
          </div>
          <div className="mk-sub">
            {g.settled != null
              ? g.official
                ? "final"
                : "final, pending settlement"
              : "marked to Kalshi"}
          </div>
        </div>
      </div>

      <div className="mk-stats" style={{ marginTop: 12 }}>
        <Stat
          label="Fills"
          value={`${g.fills} · ${Math.round(g.shares).toLocaleString()} sh`}
        />
        <Stat
          label="Avg edge / share"
          value={
            g.avg_edge_c == null
              ? "—"
              : `${g.avg_edge_c >= 0 ? "+" : ""}${g.avg_edge_c.toFixed(2)}¢`
          }
        />
        <Stat label={`Holding ${short(g.team_a)}`} value={sh(g.inv_a)} />
        <Stat label={`Holding ${short(g.team_b)}`} value={sh(g.inv_b)} />
        <Stat label={`Last price ${short(g.team_a)}`} value={cents(g.ref)} />
        <Stat
          label="Fill quality (60 s)"
          value={<span style={{ color: pnlColor(g.pnl_60s) }}>{fmt(g.pnl_60s)}</span>}
        />
      </div>

      {points.length > 1 ? (
        <>
          <div className="mk-chart-label">
            <span className="mk-key">
              <span className="mk-swatch" style={{ background: C.price }} />
              Kalshi price of {g.team_a}
            </span>
            <span className="mk-key">
              <span style={{ color: C.buy }}>▲</span>bot got more{" "}
              {short(g.team_a)}
            </span>
            <span className="mk-key">
              <span style={{ color: C.sell }}>▼</span>bot got more{" "}
              {short(g.team_b)}
            </span>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={points}
                syncId="mk-game"
                margin={{ top: 6, right: 6, bottom: 0, left: -14 }}
              >
                <CartesianGrid stroke={C.grid} vertical={false} />
                {xAxis}
                <YAxis
                  {...AXIS}
                  domain={[
                    (lo: number) => Math.max(0, Math.floor((lo - 4) / 5) * 5),
                    (hi: number) => Math.min(100, Math.ceil((hi + 4) / 5) * 5),
                  ]}
                  tickFormatter={(v) => `${v}¢`}
                  width={52}
                />
                <Tooltip
                  content={<GameTip teamA={g.team_a} teamB={g.team_b} />}
                  cursor={{ stroke: "#4a5568" }}
                />
                <Line
                  dataKey="price"
                  stroke={C.price}
                  strokeWidth={1.6}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                {/* fills as plain markers: a second data series would pin the hover box to one point */}
                {buys.map((x, i) => (
                  <ReferenceDot
                    key={`b${i}`}
                    x={x.t}
                    y={x.fill}
                    ifOverflow="extendDomain"
                    shape={(p: { cx?: number; cy?: number }) => <Tri cx={p.cx} cy={p.cy} up color={C.buy} />}
                  />
                ))}
                {sells.map((x, i) => (
                  <ReferenceDot
                    key={`s${i}`}
                    x={x.t}
                    y={x.fill}
                    ifOverflow="extendDomain"
                    shape={(p: { cx?: number; cy?: number }) => <Tri cx={p.cx} cy={p.cy} color={C.sell} />}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mk-chart-label">
            <span className="mk-key">
              <span className="mk-swatch" style={{ background: C.pos }} />
              P&L, marked to the Kalshi price (hover either chart for price, holdings and P&L)
            </span>
          </div>
          <div style={{ height: 150 }}>
            <ResponsiveContainer>
              <AreaChart
                data={points}
                syncId="mk-game"
                margin={{ top: 6, right: 6, bottom: 0, left: -14 }}
              >
                <defs>
                  <linearGradient id="mkGamePnl" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset={0}
                      stopColor={pnlColor(g.pnl)}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset={1}
                      stopColor={pnlColor(g.pnl)}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.grid} vertical={false} />
                {xAxis}
                <YAxis {...AXIS} tickFormatter={(v) => `$${v}`} width={52} />
                <ReferenceLine y={0} stroke="#4a5568" />
                <Tooltip
                  content={<GameTip teamA={g.team_a} teamB={g.team_b} />}
                  cursor={{ stroke: "#4a5568" }}
                />
                <Area
                  dataKey="pnl"
                  stroke={pnlColor(g.pnl)}
                  strokeWidth={2}
                  fill="url(#mkGamePnl)"
                  connectNulls
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </>
      ) : (
        <div className="mk-sub">
          {q.isLoading
            ? "Loading game…"
            : "No price history for this game yet."}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div className="mk-panel-title">
          <span>Fills · {fills.length}</span>
          {fills.length > 25 && (
            <button
              type="button"
              className="ph-chip"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? "Show latest 25" : `Show all ${fills.length}`}
            </button>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <Table className="mk-table">
            <THead>
              <Tr>
                <Th>Time</Th>
                <Th>Trade</Th>
                <Th>Price</Th>
                <Th>Edge</Th>
                <Th>Kalshi fair</Th>
                <Th>Shares</Th>
              </Tr>
            </THead>
            <TBody>
              {fills.length === 0 && <EmptyRow colSpan={6}>No fills</EmptyRow>}
              {(showAll ? fills : fills.slice(0, 25)).map((f, i) => (
                <Tr key={`${f.t}-${i}`}>
                  <Td className="ph-muted-2">{clockS(f.t)}</Td>
                  <Td>
                    <span
                      className={
                        f.side === "BUY" ? "ph-accent" : "ph-purple-soft"
                      }
                    >
                      {f.side === "BUY" ? "Buy" : "Sell"}
                    </span>{" "}
                    {f.team}
                  </Td>
                  <Td>{cents(f.price)}</Td>
                  <Td style={{ color: pnlColor(f.edge_c) }}>
                    {f.edge_c == null
                      ? "—"
                      : `${f.edge_c >= 0 ? "+" : ""}${f.edge_c.toFixed(1)}¢`}
                  </Td>
                  <Td className="ph-muted-2">{cents(f.fair)}</Td>
                  <Td>{sh(f.qty)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="mk-stat-label">{label}</div>
      <div className="mk-stat-value">{value}</div>
    </div>
  );
}

function Tri({
  cx,
  cy,
  color,
  up,
}: {
  cx?: number;
  cy?: number;
  color?: string;
  up?: boolean;
}) {
  if (cx == null || cy == null) return null;
  const s = 4.5;
  const pts = up
    ? `${cx},${cy - s} ${cx - s},${cy + s * 0.8} ${cx + s},${cy + s * 0.8}`
    : `${cx},${cy + s} ${cx - s},${cy - s * 0.8} ${cx + s},${cy - s * 0.8}`;
  return (
    <polygon
      points={pts}
      fill={color}
      fillOpacity={0.9}
      stroke="#0f131c"
      strokeWidth={0.6}
    />
  );
}

interface TipProps {
  active?: boolean;
  label?: number;
  payload?: {
    dataKey?: string;
    value?: number;
    payload?: Record<string, unknown>;
  }[];
}

interface FillMark {
  t: number;
  fill: number;
  qty: number;
  edge: number | null;
  team: string;
  side: string;
  price: number;
}
interface PointRow {
  t: number;
  price: number | null;
  pnl: number | null;
  a: number | null;
  b: number | null;
  fills: FillMark[];
}

// One hover box for both game charts: the moment's Kalshi price, what the bot held, its P&L, and the fill if the
// cursor is on one.
function GameTip({
  active,
  payload,
  label,
  teamA,
  teamB,
}: TipProps & { teamA: string; teamB: string }) {
  if (!active || !payload?.length) return null;
  const pt = payload.find((p) => p.dataKey === "price" || p.dataKey === "pnl")?.payload as
    | PointRow
    | undefined;
  return (
    <div className="mk-tip">
      <div className="mk-tip-muted">{clockS(pt?.t ?? label)}</div>
      {pt?.fills.map((fill, i) => (
        <div key={i} style={{ fontWeight: 600 }}>
          {fill.side === "BUY" ? "Bought" : "Sold"} {sh(fill.qty)} {fill.team} at {cents(fill.price)}
          {fill.edge != null && (
            <span style={{ color: pnlColor(fill.edge) }}>
              {" "}
              ({fill.edge >= 0 ? "+" : ""}
              {fill.edge.toFixed(1)}¢ vs Kalshi)
            </span>
          )}
        </div>
      ))}
      {pt && (
        <>
          {pt.price != null && (
            <div>
              Kalshi {short(teamA)} <b>{pt.price.toFixed(1)}¢</b>
            </div>
          )}
          <div>
            Holding {sh(pt.a ?? 0)} {short(teamA)} · {sh(pt.b ?? 0)} {short(teamB)}
          </div>
          {pt.pnl != null && (
            <div>
              P&L <b style={{ color: pnlColor(pt.pnl) }}>{fmt(pt.pnl)}</b>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── upcoming games ──────────────────────────────────────────────────────
const STATUS_STYLE: Record<MakerUpcomingGame["status"], string> = {
  "real money": "mk-pill mk-pill-live",
  paper: "mk-pill",
  "loaded, not selected": "mk-pill",
  "not loaded": "mk-pill mk-pill-dim",
};
const STATUS_LABEL: Record<MakerUpcomingGame["status"], string> = {
  "real money": "real money",
  paper: "paper",
  "loaded, not selected": "loaded · not on live list",
  "not loaded": "not loaded",
};
type UpView = "real" | "loaded" | "all";

function money(v: number | null) {
  if (v == null) return "—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

function when(t: number, now: number) {
  const d = new Date(t * 1000);
  const today = new Date(now * 1000);
  const tomorrow = new Date(now * 1000 + 86400_000);
  const dayName =
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === tomorrow.toDateString()
        ? "Tomorrow"
        : d.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
  return {
    dayName,
    time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

function Upcoming() {
  const q = useQuery<MakerUpcoming>({
    queryKey: qk.makerUpcoming,
    queryFn: fetchMakerUpcoming,
    refetchInterval: 60_000,
  });
  const [view, setView] = useState<UpView>("real");
  const games = q.data?.games ?? [];
  const real = games.filter((g) => g.status === "real money");
  const loaded = games.filter((g) => g.loaded || g.status === "real money");
  const shown = view === "real" ? real : view === "loaded" ? loaded : games;
  const realCount = real.length;
  const now = q.data?.now ?? Date.now() / 1000;

  // group by day so a busy Saturday reads as one block
  const groups: { day: string; rows: MakerUpcomingGame[] }[] = [];
  for (const g of shown) {
    const { dayName } = when(g.start_ts, now);
    const last = groups[groups.length - 1];
    if (last && last.day === dayName) last.rows.push(g);
    else groups.push({ day: dayName, rows: [g] });
  }

  return (
    <div className="mk-panel">
      <div className="mk-panel-title" style={{ alignItems: "center" }}>
        <span>
          Upcoming · next 48 h
          {q.data && (
            <span
              className="mk-sub"
              style={{
                textTransform: "none",
                letterSpacing: 0,
                fontWeight: 400,
                marginLeft: 8,
              }}
            >
              {realCount > 0
                ? `${realCount} with real money`
                : q.data.bot_live
                  ? "none on the real-money list yet"
                  : "bot is in paper mode"}
            </span>
          )}
        </span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(
            [
              ["real", `Real money · ${real.length}`],
              ["loaded", `Bot loaded · ${loaded.length}`],
              ["all", `All big games · ${games.length}`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              className="ph-chip"
              data-active={view === v}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      {shown.length === 0 ? (
        <div className="mk-sub">
          {q.isLoading
            ? "Loading…"
            : view === "real"
              ? "No real-money games in the next 48 hours. Use the other views to see what's coming."
              : "Nothing scheduled in the next 48 hours."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
          <Table className="mk-table">
            <THead>
              <Tr>
                <Th>Start</Th>
                <Th>Game · favourite first</Th>
                <Th>Kalshi volume</Th>
                <Th>Bot</Th>
              </Tr>
            </THead>
            <TBody>
              {groups.map((grp) => (
                <Fragment key={grp.day}>
                  <Tr>
                    <Td colSpan={4} className="mk-day-row">
                      {grp.day} · {grp.rows.length} game
                      {grp.rows.length === 1 ? "" : "s"}
                    </Td>
                  </Tr>
                  {grp.rows.map((g) => (
                    <Tr key={g.key}>
                      <Td
                        className="ph-muted-2"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {g.started ? (
                          <span className="ph-pos">● started</span>
                        ) : (
                          <span
                            title={
                              g.start_exact
                                ? undefined
                                : "estimated from Kalshi's expected end time"
                            }
                          >
                            {g.start_exact ? "" : "≈"}
                            {when(g.start_ts, now).time}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span style={{ color: "#e2e8f0" }}>{g.team_a}</span>
                        {g.fav_price != null && (
                          <span className="ph-muted-2">
                            {" "}
                            {Math.round(g.fav_price * 100)}¢
                          </span>
                        )}
                        <span className="ph-muted-2"> vs </span>
                        {g.team_b}{" "}
                        <span className="ph-badge">
                          {g.league.toUpperCase()}
                        </span>
                      </Td>
                      <Td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ minWidth: 44 }}>
                            {money(g.volume)}
                          </span>
                          <span className="mk-bar">
                            <span
                              style={{
                                width: `${Math.min(100, ((g.volume ?? 0) / 2e6) * 100)}%`,
                              }}
                            />
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className={STATUS_STYLE[g.status]}>
                          {STATUS_LABEL[g.status]}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </Fragment>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── account (real money on Polymarket) ──────────────────────────────────
function Account({ d }: { d?: MakerSummary }) {
  const a = d?.account ?? {};
  if (a.cash == null) return null;
  const pos = a.positions_value ?? 0;
  const won = a.unclaimed ?? 0;
  const total = a.cash + pos + won;
  const usd = (v: number) =>
    `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const age = a.t && d ? d.now - a.t : null;
  return (
    <div className="mk-panel">
      <div className="mk-panel-title">
        <span>Polymarket account</span>
        <span
          className="mk-sub"
          style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
        >
          {age == null ? "" : `as of ${ago(age)} ago`}
        </span>
      </div>
      <div className="mk-stats" style={{ margin: 0 }}>
        <Stat
          label="Total value"
          value={
            <span style={{ fontSize: 18, fontWeight: 700 }}>{usd(total)}</span>
          }
        />
        <Stat label="Cash (free to trade)" value={usd(a.cash)} />
        <Stat
          label={`Open positions · ${a.n_positions ?? 0}`}
          value={usd(pos)}
        />
        <Stat
          label="Winnings to claim"
          value={
            <span style={{ color: won > 0.5 ? "#f6e05e" : undefined }}>
              {usd(won)}
              {won > 0.5 && (
                <span className="mk-sub">
                  {" "}
                  · claim on Polymarket to free it up
                </span>
              )}
            </span>
          }
        />
      </div>
    </div>
  );
}
