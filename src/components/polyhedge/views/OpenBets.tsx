"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import { Section } from "@/components/polyhedge/ui/Section";
import {
  SummaryCard,
  SummaryGrid,
} from "@/components/polyhedge/SummaryCard";
import {
  Table,
  TBody,
  Th,
  THead,
  Tr,
  Td,
  EmptyRow,
} from "@/components/polyhedge/ui/Table";
import { SortHeader } from "@/components/polyhedge/ui/SortHeader";
import { SourceBadge } from "@/components/polyhedge/ui/Badge";
import { PnLBadge } from "@/components/polyhedge/PnLBadge";
import { BetFilterBar } from "@/components/polyhedge/BetFilterBar";
import {
  ago,
  clsForSign,
  fmt,
  fmt3,
  signedPct,
} from "@/lib/polyhedge/format";
import { useTableSort } from "@/lib/polyhedge/useTableSort";
import { useBetFilter } from "@/lib/polyhedge/useBetFilter";
import type {
  OpenBet,
  OpenBetsResponse,
  PipelineStats,
} from "@/lib/polyhedge/types";

const PIPELINE_ORDER = [
  "lead_lag",
  "manual_arbs",
  "temp_arbs",
  "rt_middles",
  "all",
] as const;
const PIPELINE_LABEL: Record<(typeof PIPELINE_ORDER)[number], string> = {
  lead_lag: "Sports",
  manual_arbs: "Manual Arbs",
  temp_arbs: "Weather",
  rt_middles: "RT Middles",
  all: "All Engines",
};

export function OpenBetsView() {
  const q = useQuery<OpenBetsResponse>({
    queryKey: qk.openBets,
    queryFn: () => api.get<OpenBetsResponse>("/api/open-bets"),
    refetchInterval: 60_000,
  });
  const allBets = q.data?.bets ?? [];
  const stats = q.data?.stats ?? {};

  // Portfolio totals computed from the unfiltered set so the summary is stable.
  const portfolio = useMemo(() => computePortfolio(allBets), [allBets]);

  // Filters apply to both detail tables. Source pnl uses current MTM.
  const filter = useBetFilter<OpenBet>(
    allBets,
    (b) => b.current_mtm_dollars,
  );
  const filteredBets = filter.rows;
  const arbBets = useMemo(
    () => filteredBets.filter((b) => b.source !== "lead_lag"),
    [filteredBets],
  );

  // Sort hooks for the two detail tables
  const allSort = useTableSort<OpenBet>(
    filteredBets,
    {
      source: (r) => r.source,
      label: (r) => r.label,
      instrument: (r) => r.instrument ?? "",
      contracts: (r) => r.contracts ?? null,
      cost: (r) => r.entry_cost_dollars ?? null,
      payout: (r) => r.expected_payout_dollars ?? null,
      expected_roi: (r) => r.expected_roi_pct ?? null,
      mtm_roi: (r) => r.current_mtm_roi_pct ?? null,
      mtm_d: (r) => r.current_mtm_dollars ?? null,
      opened: (r) => r.opened_ago_s ?? null,
    },
    { key: "mtm_roi", dir: "desc" },
  );
  const legSort = useTableSort<OpenBet>(
    arbBets,
    {
      source: (r) => r.source,
      label: (r) => r.label,
      contracts: (r) => r.contracts ?? null,
      k_side: (r) => r.kalshi_side ?? "",
      k_entry: (r) => r.kalshi_entry_price ?? null,
      k_mid: (r) => r.kalshi_current_mid ?? null,
      k_pnl: (r) => r.k_leg_pnl_dollars ?? null,
      p_side: (r) => r.poly_side ?? "",
      p_entry: (r) => r.poly_entry_price ?? null,
      p_mid: (r) => r.poly_current_mid ?? null,
      p_pnl: (r) => r.p_leg_pnl_dollars ?? null,
      mtm_d: (r) => r.current_mtm_dollars ?? null,
      mtm_pct: (r) => r.current_mtm_roi_pct ?? null,
    },
    { key: "mtm_d", dir: "desc" },
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SummaryGrid>
        <SummaryCard
          label="Total invested"
          value={"$" + portfolio.totalInvested.toFixed(2)}
          sub={`${allBets.length} bets`}
        />
        <SummaryCard
          label="Sell-now value"
          value={"$" + portfolio.totalSellNow.toFixed(2)}
          sub={`${portfolio.mtmCount} / ${allBets.length} live MTM`}
        />
        <SummaryCard
          label="Unrealized PnL"
          value={fmt(portfolio.unrealized)}
          valueClass={clsForSign(portfolio.unrealized)}
          sub={signedPct(portfolio.unrealizedPct, 2) + " of invested"}
        />
        <SummaryCard
          label="Settle value"
          value={"$" + portfolio.totalSettleValue.toFixed(2)}
          valueClass={clsForSign(portfolio.settleDelta)}
          sub={
            (portfolio.settleDelta >= 0 ? "+" : "") +
            "$" +
            portfolio.settleDelta.toFixed(2) +
            ` (${signedPct(portfolio.settleDeltaPct, 2)}) vs invested`
          }
        />
      </SummaryGrid>

      <Section title={`Per-pipeline open positions · ${allBets.length} open`}>
        <Table>
          <THead>
            <Tr>
              <Th>Pipeline</Th>
              <Th>Open</Th>
              <Th>Cost basis</Th>
              <Th>Current MTM</Th>
              <Th>Unrealized %</Th>
              <Th>MTM coverage</Th>
            </Tr>
          </THead>
          <TBody>
            {PIPELINE_ORDER.map((key) => {
              const s = (stats[key] ?? {}) as PipelineStats;
              const isAll = key === "all";
              return (
                <Tr key={key} className={isAll ? "ph-row-all" : ""}>
                  <Td className="ph-accent" style={{ fontWeight: 600 }}>
                    {PIPELINE_LABEL[key]}
                  </Td>
                  <Td>{s.open_count ?? 0}</Td>
                  <Td>
                    {s.cost_basis != null
                      ? "$" + s.cost_basis.toFixed(2)
                      : "—"}
                  </Td>
                  <Td className={clsForSign(s.current_mtm)}>
                    {fmt(s.current_mtm ?? null)}
                  </Td>
                  <Td className={clsForSign(s.unrealized_pnl_pct)}>
                    {signedPct(s.unrealized_pnl_pct ?? null, 2)}
                  </Td>
                  <Td className="ph-muted" style={{ fontSize: 10 }}>
                    {s.mtm_known_count != null && s.open_count
                      ? `${s.mtm_known_count} / ${s.open_count}`
                      : "—"}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Section>

      <Section title="All open positions">
        <BetFilterBar
          state={filter.state}
          set={filter.set}
          toggleSource={filter.toggleSource}
          visible={filteredBets.length}
          total={allBets.length}
        />
        <Table>
          <THead>
            <Tr>
              <SortHeader {...allSort.bind("source")} />
              <SortHeader {...allSort.bind("label")}>Label</SortHeader>
              <SortHeader {...allSort.bind("instrument")}>Instrument</SortHeader>
              <SortHeader {...allSort.bind("contracts")}>Contracts</SortHeader>
              <SortHeader {...allSort.bind("cost")}>Cost</SortHeader>
              <SortHeader {...allSort.bind("payout")}>Expected payout</SortHeader>
              <SortHeader {...allSort.bind("expected_roi")} className="ph-hidden-mobile">
                Expected ROI
              </SortHeader>
              <SortHeader {...allSort.bind("mtm_roi")}>MTM ROI</SortHeader>
              <SortHeader {...allSort.bind("mtm_d")} className="ph-hidden-mobile">
                MTM $
              </SortHeader>
              <SortHeader {...allSort.bind("opened")}>Opened</SortHeader>
            </Tr>
          </THead>
          <TBody>
            {allSort.rows.length === 0 ? (
              <EmptyRow colSpan={10}>
                {allBets.length === 0
                  ? "No open bets across any engine"
                  : "No bets match current filters"}
              </EmptyRow>
            ) : (
              allSort.rows.map((b, i) => (
                <Tr key={(b.label ?? "row") + i}>
                  <Td>
                    <SourceBadge source={b.source} />
                  </Td>
                  <Td>{b.label ?? "—"}</Td>
                  <Td className="ph-muted">{b.instrument ?? ""}</Td>
                  <Td>{b.contracts ?? "—"}</Td>
                  <Td>
                    {b.entry_cost_dollars != null
                      ? "$" + b.entry_cost_dollars.toFixed(2)
                      : "—"}
                  </Td>
                  <Td>
                    {b.expected_payout_dollars != null
                      ? "$" + b.expected_payout_dollars.toFixed(2)
                      : "—"}
                  </Td>
                  <Td className="ph-muted ph-hidden-mobile">
                    {b.expected_roi_pct != null
                      ? b.expected_roi_pct.toFixed(2) + "%"
                      : "—"}
                  </Td>
                  <Td className={clsForSign(b.current_mtm_roi_pct)}>
                    {b.current_mtm_roi_pct != null
                      ? b.current_mtm_roi_pct.toFixed(2) + "%"
                      : "—"}
                  </Td>
                  <Td
                    className={`${clsForSign(b.current_mtm_dollars)} ph-hidden-mobile`}
                  >
                    {b.current_mtm_dollars != null
                      ? fmt(b.current_mtm_dollars)
                      : "—"}
                  </Td>
                  <Td className="ph-muted">{ago(b.opened_ago_s)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </Section>

      <Section title="Arb positions · per-leg breakdown">
        <Table>
          <THead>
            <Tr>
              <SortHeader {...legSort.bind("source")} />
              <SortHeader {...legSort.bind("label")}>Label</SortHeader>
              <SortHeader {...legSort.bind("contracts")}>Contracts</SortHeader>
              <SortHeader {...legSort.bind("k_side")} className="ph-hidden-mobile">
                K side
              </SortHeader>
              <SortHeader {...legSort.bind("k_entry")}>K entry</SortHeader>
              <SortHeader {...legSort.bind("k_mid")}>K mid</SortHeader>
              <SortHeader {...legSort.bind("k_pnl")}>K PnL</SortHeader>
              <SortHeader {...legSort.bind("p_side")} className="ph-hidden-mobile">
                P side
              </SortHeader>
              <SortHeader {...legSort.bind("p_entry")}>P entry</SortHeader>
              <SortHeader {...legSort.bind("p_mid")}>P mid</SortHeader>
              <SortHeader {...legSort.bind("p_pnl")}>P PnL</SortHeader>
              <SortHeader {...legSort.bind("mtm_d")}>Combined MTM</SortHeader>
              <SortHeader {...legSort.bind("mtm_pct")}>%</SortHeader>
            </Tr>
          </THead>
          <TBody>
            {legSort.rows.length === 0 ? (
              <EmptyRow colSpan={13}>No open arb bets</EmptyRow>
            ) : (
              legSort.rows.map((b, i) => (
                <Tr key={(b.label ?? "row") + i}>
                  <Td>
                    <SourceBadge source={b.source} />
                  </Td>
                  <Td>{b.label ?? "—"}</Td>
                  <Td>{b.contracts ?? "—"}</Td>
                  <Td className="ph-muted ph-hidden-mobile">
                    {b.kalshi_side ?? "—"}
                  </Td>
                  <Td>{fmt3(b.kalshi_entry_price)}</Td>
                  <Td>{fmt3(b.kalshi_current_mid)}</Td>
                  <Td>
                    <PnLBadge value={b.k_leg_pnl_dollars ?? null} />
                  </Td>
                  <Td className="ph-muted ph-hidden-mobile">
                    {b.poly_side ?? "—"}
                  </Td>
                  <Td>{fmt3(b.poly_entry_price)}</Td>
                  <Td>{fmt3(b.poly_current_mid)}</Td>
                  <Td>
                    <PnLBadge value={b.p_leg_pnl_dollars ?? null} />
                  </Td>
                  <Td>
                    <PnLBadge value={b.current_mtm_dollars ?? null} />
                  </Td>
                  <Td>
                    <PnLBadge
                      value={b.current_mtm_roi_pct ?? null}
                      format="percent"
                    />
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </Section>
    </div>
  );
}

function computePortfolio(bets: OpenBetsResponse["bets"]) {
  let totalInvested = 0;
  let totalSettleValue = 0;
  let totalSellNow = 0;
  let mtmCount = 0;
  for (const b of bets) {
    const inv = b.entry_cost_dollars ?? 0;
    totalInvested += inv;
    totalSettleValue +=
      b.expected_payout_dollars != null ? b.expected_payout_dollars : inv;
    if (b.current_mtm_dollars != null) {
      totalSellNow += inv + b.current_mtm_dollars;
      mtmCount += 1;
    } else {
      totalSellNow += inv;
    }
  }
  const unrealized = totalSellNow - totalInvested;
  const unrealizedPct =
    totalInvested > 0 ? (unrealized / totalInvested) * 100 : 0;
  const settleDelta = totalSettleValue - totalInvested;
  const settleDeltaPct =
    totalInvested > 0 ? (settleDelta / totalInvested) * 100 : 0;
  return {
    totalInvested,
    totalSettleValue,
    totalSellNow,
    mtmCount,
    unrealized,
    unrealizedPct,
    settleDelta,
    settleDeltaPct,
  };
}
