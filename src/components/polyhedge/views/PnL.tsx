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
          label="Realized P&L"
          value={<PnLBadge value={s?.realized ?? null} bold />}
        />
        <SummaryCard
          label="Unrealized P&L"
          value={<PnLBadge value={s?.unrealized ?? null} bold />}
        />
        {balances.map(([exchange, b]) => (
          <SummaryCard
            key={exchange}
            label={`${exchange} balance`}
            value={dollars(b.available_dollars)}
            sub={
              b.locked_dollars
                ? `${dollars(b.locked_dollars)} locked`
                : undefined
            }
          />
        ))}
        <SummaryCard
          label="Last sync"
          value={s?.last_sync ? s.last_sync.slice(0, 16) : "—"}
        />
      </SummaryGrid>

      <Section title="By strategy">
        <Table>
          <THead>
            <Tr>
              <Th>Strategy</Th>
              <Th>Realized</Th>
            </Tr>
          </THead>
          <TBody>
            {summary.isLoading && <EmptyRow colSpan={2}>Loading…</EmptyRow>}
            {!summary.isLoading && byStrategy.length === 0 && (
              <EmptyRow colSpan={2}>No realized P&L yet</EmptyRow>
            )}
            {byStrategy.map((r) => (
              <Tr key={r.strategy}>
                <Td className="ph-accent" style={{ fontWeight: 600 }}>
                  {r.strategy}
                </Td>
                <Td>
                  <PnLBadge value={r.realized ?? null} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section title={`Fills ledger · ${fillRows.length} fills`}>
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
                <Td className="ph-muted" style={{ fontSize: 10 }}>
                  {(f.created_ts ?? "").slice(0, 16)}
                </Td>
                <Td className="ph-muted">{f.ticker}</Td>
                <Td>{f.side}</Td>
                <Td>{f.action}</Td>
                <Td>{f.count}</Td>
                <Td>{dollars(f.price)}</Td>
                <Td>{dollars(f.fee_dollars)}</Td>
                <Td>{f.strategy}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>
    </div>
  );
}
