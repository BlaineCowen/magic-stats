"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import type {
  BacktestResponse,
  BetsSummary,
  LiveGame,
  RecentBet,
} from "@/lib/polyhedge/types";
import { Section } from "@/components/polyhedge/ui/Section";
import {
  SummaryCard,
  SummaryGrid,
} from "@/components/polyhedge/SummaryCard";
import {
  Table,
  TBody,
  THead,
  Tr,
  Td,
  EmptyRow,
} from "@/components/polyhedge/ui/Table";
import { SortHeader } from "@/components/polyhedge/ui/SortHeader";
import { Badge } from "@/components/polyhedge/ui/Badge";
import { PnLBadge } from "@/components/polyhedge/PnLBadge";
import { useTableSort } from "@/lib/polyhedge/useTableSort";
import {
  ago,
  clsForSign,
  fmt,
  pct,
  formatRunAt,
  statusClass,
} from "@/lib/polyhedge/format";

export function LiveSportsView() {
  const games = useQuery<LiveGame[]>({
    queryKey: qk.games,
    queryFn: () => api.get<LiveGame[]>("/api/games"),
    refetchInterval: 5_000,
  });
  const bets = useQuery<BetsSummary>({
    queryKey: qk.bets,
    queryFn: () => api.get<BetsSummary>("/api/bets"),
    refetchInterval: 5_000,
  });
  const recent = useQuery<RecentBet[]>({
    queryKey: qk.betsRecent(50),
    queryFn: () =>
      api.get<RecentBet[]>("/api/bets/recent", { limit: 50 }),
    refetchInterval: 5_000,
  });
  const backtest = useQuery<BacktestResponse>({
    queryKey: qk.betsBacktest,
    queryFn: () => api.get<BacktestResponse>("/api/bets/backtest"),
    refetchInterval: 5_000,
    retry: 0,
  });

  const today = bets.data?.today ?? {};
  const active = bets.data?.active ?? [];
  const bt = backtest.data ?? null;

  // Backtest by sport — flatten dict to array so we can sort it.
  type SportRow = { sport: string; n: number; win_rate: number; avg_pnl: number; net_pnl: number };
  const sportRows: SportRow[] = useMemo(() => {
    const s = bt?.sports ?? {};
    return Object.entries(s).map(([sport, v]) => ({ sport, ...v }));
  }, [bt]);
  const sportSort = useTableSort<SportRow>(
    sportRows,
    {
      sport: (r) => r.sport,
      n: (r) => r.n,
      win_rate: (r) => r.win_rate,
      avg_pnl: (r) => r.avg_pnl,
      net_pnl: (r) => r.net_pnl,
    },
    { key: "sport", dir: "asc" },
  );

  // Top wins/losses derived from backtest.recent (already sliced)
  const recentList = bt?.recent ?? [];
  const sorted = [...recentList].sort(
    (a, b) => (b.realized_pnl ?? 0) - (a.realized_pnl ?? 0),
  );
  const topWins = sorted.filter((b) => (b.realized_pnl ?? 0) > 0).slice(0, 5);
  const topLosses = sorted
    .filter((b) => (b.realized_pnl ?? 0) <= 0)
    .slice(-5)
    .reverse();

  // Live games sort
  const gamesData = games.data ?? [];
  const gamesSort = useTableSort<LiveGame>(
    gamesData,
    {
      outcome: (r) => r.outcome,
      kalshi_mid: (r) => r.kalshi_mid ?? null,
      poly_mid: (r) => r.poly_mid ?? null,
      delta: (r) => r.delta ?? null,
      last_kalshi_s: (r) => r.last_kalshi_s ?? null,
      last_poly_s: (r) => r.last_poly_s ?? null,
    },
    { key: "delta", dir: "desc" },
  );

  // Recent bets sort (only non-skipped)
  const activeBets = useMemo(
    () => (recent.data ?? []).filter(
      (b) => b.status !== "skipped" && b.status !== "abandoned",
    ),
    [recent.data],
  );
  const betsSort = useTableSort<RecentBet>(
    activeBets,
    {
      outcome: (r) => r.outcome,
      signal: (r) => r.signal_pct ?? null,
      entry: (r) => r.entry_ask ?? null,
      exit: (r) => r.exit_mid ?? null,
      realized: (r) => r.realized_pnl ?? null,
      status: (r) => r.status,
    },
    { key: "status", dir: "asc" },
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SummaryGrid>
        <SummaryCard
          label="Today PnL"
          value={fmt(today.total_pnl ?? null)}
          valueClass={clsForSign(today.total_pnl ?? null)}
          sub={`${today.settled ?? 0} settled · ${today.skipped ?? 0} skipped`}
        />
        <SummaryCard
          label="Win rate"
          value={pct(today.win_rate ?? null)}
          sub={`avg ${fmt(today.avg_pnl ?? null)} / trade`}
        />
        <SummaryCard
          label="Open"
          value={active.length}
          sub={active.map((b) => b.outcome).join(", ") || "none open"}
        />
        <SummaryCard
          label="Backtest PnL"
          value={bt?.total ? fmt(bt.total.net_pnl) : "—"}
          valueClass={bt?.total ? clsForSign(bt.total.net_pnl) : "ph-text"}
          sub={
            bt?.total && bt.total.n > 0
              ? `${bt.total.n} trades · ${pct(bt.total.win_rate)} win`
              : "run backtest_lead_lag.py --write-db"
          }
        />
      </SummaryGrid>

      <Section
        title="Backtest by sport"
        variant="backtest"
        right={formatRunAt(bt?.run_at) ?? undefined}
      >
        <Table>
          <THead>
            <Tr>
              <SortHeader {...sportSort.bind("sport")}>Sport</SortHeader>
              <SortHeader {...sportSort.bind("n")}>N</SortHeader>
              <SortHeader {...sportSort.bind("win_rate")}>Win %</SortHeader>
              <SortHeader {...sportSort.bind("avg_pnl")}>Avg</SortHeader>
              <SortHeader {...sportSort.bind("net_pnl")}>Net</SortHeader>
            </Tr>
          </THead>
          <TBody>
            {sportSort.rows.length === 0 ? (
              <EmptyRow colSpan={5}>
                No backtest data — run: python backtest_lead_lag.py --write-db
              </EmptyRow>
            ) : (
              sportSort.rows.map((sp) => {
                const winCls =
                  sp.win_rate >= 45
                    ? "ph-pos"
                    : sp.win_rate >= 35
                      ? "ph-warn"
                      : "ph-neg";
                return (
                  <Tr key={sp.sport}>
                    <Td>
                      <strong>{sp.sport}</strong>
                    </Td>
                    <Td>{sp.n}</Td>
                    <Td className={winCls}>{pct(sp.win_rate)}</Td>
                    <Td className={clsForSign(sp.avg_pnl)}>
                      {fmt(sp.avg_pnl)}
                    </Td>
                    <Td className={clsForSign(sp.net_pnl)}>
                      {fmt(sp.net_pnl)}
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </Section>

      <div className="ph-two-col">
        <Section title="Top backtest wins" variant="backtest">
          <HighlightTable rows={topWins} kind="win" />
        </Section>
        <Section title="Top backtest losses" variant="backtest">
          <HighlightTable rows={topLosses} kind="loss" />
        </Section>
      </div>

      <Section title="Live games">
        <Table>
          <THead>
            <Tr>
              <SortHeader {...gamesSort.bind("outcome")}>Outcome</SortHeader>
              <SortHeader {...gamesSort.bind("kalshi_mid")}>Kalshi mid</SortHeader>
              <SortHeader {...gamesSort.bind("poly_mid")}>Poly mid</SortHeader>
              <SortHeader {...gamesSort.bind("delta")}>Δ</SortHeader>
              <SortHeader {...gamesSort.bind("last_kalshi_s")} className="ph-hidden-mobile">
                K updated
              </SortHeader>
              <SortHeader {...gamesSort.bind("last_poly_s")} className="ph-hidden-mobile">
                P updated
              </SortHeader>
            </Tr>
          </THead>
          <TBody>
            {gamesSort.rows.length === 0 ? (
              <EmptyRow colSpan={6}>No games today</EmptyRow>
            ) : (
              gamesSort.rows.map((g, i) => {
                const dc =
                  (g.delta ?? 0) > 0.005
                    ? "ph-pos"
                    : (g.delta ?? 0) < -0.005
                      ? "ph-neg"
                      : "ph-muted";
                return (
                  <Tr key={g.outcome + i}>
                    <Td>
                      <strong>{g.outcome}</strong>{" "}
                      <Badge>{g.sport ?? "—"}</Badge>
                    </Td>
                    <Td>
                      {g.kalshi_mid != null ? (
                        g.kalshi_mid.toFixed(3)
                      ) : (
                        <span className="ph-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      {g.poly_mid != null ? (
                        g.poly_mid.toFixed(3)
                      ) : (
                        <span className="ph-muted">—</span>
                      )}
                    </Td>
                    <Td className={dc}>
                      {g.delta != null
                        ? (g.delta >= 0 ? "+" : "") + g.delta.toFixed(3)
                        : "—"}
                    </Td>
                    <Td className="ph-hidden-mobile ph-muted">
                      {ago(g.last_kalshi_s)}
                    </Td>
                    <Td className="ph-hidden-mobile ph-muted">
                      {ago(g.last_poly_s)}
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </Section>

      <Section title="Recent live bets">
        <Table>
          <THead>
            <Tr>
              <SortHeader {...betsSort.bind("outcome")}>Outcome</SortHeader>
              <SortHeader {...betsSort.bind("signal")}>Signal</SortHeader>
              <SortHeader {...betsSort.bind("entry")} className="ph-hidden-mobile">
                Entry
              </SortHeader>
              <SortHeader {...betsSort.bind("exit")} className="ph-hidden-mobile">
                Exit
              </SortHeader>
              <SortHeader {...betsSort.bind("realized")}>Realized</SortHeader>
              <SortHeader {...betsSort.bind("status")}>Status</SortHeader>
            </Tr>
          </THead>
          <TBody>
            {betsSort.rows.length === 0 ? (
              <EmptyRow colSpan={6}>No executed bets yet</EmptyRow>
            ) : (
              betsSort.rows.map((b, i) => (
                <Tr key={b.outcome + i}>
                  <Td>
                    <strong>{b.outcome}</strong>{" "}
                    <Badge>{b.sport ?? "—"}</Badge>
                  </Td>
                  <Td>
                    {b.signal_pct != null
                      ? (b.signal_pct * 100).toFixed(0) + "%"
                      : "—"}
                  </Td>
                  <Td className="ph-hidden-mobile">
                    {b.entry_ask != null ? b.entry_ask.toFixed(3) : "—"}
                  </Td>
                  <Td className="ph-hidden-mobile">
                    {b.exit_mid != null ? b.exit_mid.toFixed(3) : "—"}
                  </Td>
                  <Td>
                    <PnLBadge value={b.realized_pnl ?? null} />
                  </Td>
                  <Td className={statusClass(b.status)}>{b.status}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </Section>
    </div>
  );
}

type Highlight = NonNullable<NonNullable<BacktestResponse>["recent"]>[number];

function HighlightTable({
  rows,
  kind,
}: {
  rows: Highlight[];
  kind: "win" | "loss";
}) {
  const sort = useTableSort<Highlight>(
    rows,
    {
      outcome: (r) => r.outcome ?? "",
      pnl: (r) => r.realized_pnl ?? null,
      spread: (r) => r.spread ?? null,
      date: (r) => r.game_date ?? "",
    },
    { key: "pnl", dir: kind === "win" ? "desc" : "asc" },
  );
  return (
    <Table>
      <THead>
        <Tr>
          <SortHeader {...sort.bind("outcome")}>Outcome</SortHeader>
          <SortHeader {...sort.bind("pnl")}>PnL</SortHeader>
          <SortHeader {...sort.bind("spread")}>Spread</SortHeader>
          <SortHeader {...sort.bind("date")} className="ph-hidden-mobile">
            Date
          </SortHeader>
        </Tr>
      </THead>
      <TBody>
        {sort.rows.length === 0 && (
          <EmptyRow colSpan={4}>No backtest data</EmptyRow>
        )}
        {sort.rows.map((b, i) => (
          <Tr key={(b.outcome ?? "row") + i}>
            <Td
              style={{
                borderLeft: `2px solid ${kind === "win" ? "#48bb78" : "#fc8181"}`,
              }}
            >
              <strong>{b.outcome}</strong> <Badge>{b.sport ?? "—"}</Badge>
            </Td>
            <Td className={kind === "win" ? "ph-pos" : "ph-neg"}>
              {fmt(b.realized_pnl ?? null)}
            </Td>
            <Td className="ph-muted">
              {b.spread != null
                ? (b.spread * 100).toFixed(1) + "¢"
                : "—"}
            </Td>
            <Td className="ph-hidden-mobile ph-muted">
              {b.game_date ?? "—"}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
