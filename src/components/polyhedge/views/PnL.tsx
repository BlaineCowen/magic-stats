"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPnlSummary, fetchPnlFills } from "@/lib/polyhedge/pnl";
import type { PnlSummary, PnlFillsResponse } from "@/lib/polyhedge/pnl";
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
import { PnLBadge } from "@/components/polyhedge/PnLBadge";
import { dollars } from "@/lib/polyhedge/format";

const STRATEGY: Record<string, [string, string]> = {
  maker: ["Maker bot", "partial: counts Kalshi-settled tickers only; the Maker tab has the bot's full ledger"],
  manual_arb: ["Manual arbs", "paired Kalshi + Polymarket bets"],
  rt: ["RT maker", "Rotten Tomatoes resting orders"],
  unattributed: ["Untracked", "hand trades and bets placed before tracking"],
};

export function PnLView() {
  const summary = useQuery<PnlSummary>({
    queryKey: qk.pnlSummary,
    queryFn: fetchPnlSummary,
    refetchInterval: 60_000,
  });
  const fills = useQuery<PnlFillsResponse>({
    queryKey: qk.pnlFills,
    queryFn: fetchPnlFills,
    refetchInterval: 60_000,
  });

  const s = summary.data;
  const fillRows = fills.data?.fills ?? [];
  const byStrategy = s?.by_strategy ?? [];
  const balances = s ? Object.entries(s.balances) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SummaryGrid>
        <SummaryCard
          label="Realized P&L (settled)"
          value={<PnLBadge value={s?.realized ?? null} bold />}
        />
        <SummaryCard
          label="Unrealized P&L (open positions)"
          value={<PnLBadge value={s?.unrealized ?? null} bold />}
        />
        {balances.map(([exchange, b]) => (
          <SummaryCard
            key={exchange}
            label={`${exchange === "polymarket" ? "Polymarket" : exchange === "kalshi" ? "Kalshi" : exchange} cash`}
            value={dollars(b.available_dollars)}
            sub={
              b.locked_dollars
                ? exchange === "polymarket"
                  ? `+ ${dollars(b.locked_dollars)} in positions & unclaimed winnings`
                  : `${dollars(b.locked_dollars)} locked`
                : undefined
            }
          />
        ))}
      </SummaryGrid>

      <Section
        title="Settled P&L by strategy"
        right={s?.last_sync ? `synced ${new Date(s.last_sync).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : undefined}
        collapsible={false}
      >
        <SummaryGrid>
          {summary.isLoading && <div className="ph-ov-note">Loading…</div>}
          {byStrategy.map((r) => (
            <SummaryCard
              key={r.strategy}
              label={STRATEGY[r.strategy]?.[0] ?? r.strategy}
              value={<PnLBadge value={r.realized ?? null} bold />}
              sub={STRATEGY[r.strategy]?.[1]}
            />
          ))}
        </SummaryGrid>
      </Section>

      <Section title={`Kalshi fills · latest ${fillRows.length}`} defaultCollapsed>
        <Table>
          <THead>
            <Tr>
              <Th>Time</Th>
              <Th>Ticker</Th>
              <Th>Side</Th>
              <Th>Action</Th>
              <Th>Qty</Th>
              <Th>Price</Th>
              <Th>Fee</Th>
              <Th>Strategy</Th>
            </Tr>
          </THead>
          <TBody>
            {fills.isLoading && <EmptyRow colSpan={8}>Loading…</EmptyRow>}
            {!fills.isLoading && fillRows.length === 0 && (
              <EmptyRow colSpan={8}>No fills yet</EmptyRow>
            )}
            {fillRows.map((f) => (
              <Tr key={f.trade_id}>
                <Td className="ph-muted-2">
                  {f.created_ts
                    ? new Date(f.created_ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                    : "—"}
                </Td>
                <Td className="ph-mono ph-text-2">{f.ticker}</Td>
                <Td>{f.side}</Td>
                <Td>{f.action}</Td>
                <Td>{f.count}</Td>
                <Td>{dollars(f.price)}</Td>
                <Td>{dollars(f.fee_dollars)}</Td>
                <Td>{STRATEGY[f.strategy]?.[0] ?? f.strategy}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>
    </div>
  );
}
