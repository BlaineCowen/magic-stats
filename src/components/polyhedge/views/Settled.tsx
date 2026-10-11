"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { clsForSign, fmt } from "@/lib/polyhedge/format";
import { useTableSort } from "@/lib/polyhedge/useTableSort";
import { useBetFilter } from "@/lib/polyhedge/useBetFilter";
import type {
  SettledBet,
  SettledBetsResponse,
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

export function SettledView() {
  const q = useQuery<SettledBetsResponse>({
    queryKey: qk.settledBets(200),
    queryFn: () =>
      api.get<SettledBetsResponse>("/api/settled-bets", { limit: 200 }),
    refetchInterval: 60_000,
  });
  const data = q.data;
  const bets = data?.bets ?? [];
  const totals = data?.totals ?? {};
  const grand = data?.grand_total_realized_pnl_dollars ?? 0;

  // Filter (PnL accessor = realized_pnl_dollars)
  const filter = useBetFilter<SettledBet>(bets, (b) => b.realized_pnl_dollars);
  const filteredBets = filter.rows;

  const sort = useTableSort<SettledBet>(
    filteredBets,
    {
      source: (r) => r.source,
      label: (r) => r.label,
      instrument: (r) => r.instrument ?? "",
      contracts: (r) => r.contracts ?? null,
      cost: (r) => r.cost ?? null,
      realized: (r) => r.realized_pnl_dollars ?? null,
      roi: (r) => r.roi_pct ?? null,
      settled_at: (r) => r.settled_at ?? "",
    },
    { key: "settled_at", dir: "desc" },
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SummaryGrid>
        <SummaryCard
          label="Grand total realized"
          value={fmt(grand)}
          valueClass={clsForSign(grand)}
          sub={bets.length + " shown"}
        />
        {(["lead_lag", "manual_arbs", "temp_arbs", "rt_middles"] as const).map(
          (src) => {
            const t =
              totals[src] ?? {
                count: 0,
                win_count: 0,
                pct: 0,
                realized_pnl: 0,
              };
            return (
              <SummaryCard
                key={src}
                label={PIPELINE_LABEL[src]}
                value={fmt(t.realized_pnl ?? 0)}
                valueClass={clsForSign(t.realized_pnl ?? 0)}
                sub={`${t.count} bets · ${t.pct != null ? t.pct.toFixed(1) + "%" : "—"} win`}
              />
            );
          },
        )}
      </SummaryGrid>

      <Section title="Per-pipeline summary">
        <Table>
          <THead>
            <Tr>
              <Th>Pipeline</Th>
              <Th>Settled</Th>
              <Th>Win %</Th>
              <Th>Realized PnL</Th>
            </Tr>
          </THead>
          <TBody>
            {PIPELINE_ORDER.map((key) => {
              const t =
                totals[key] ?? {
                  count: 0,
                  win_count: 0,
                  pct: 0,
                  realized_pnl: 0,
                };
              const isAll = key === "all";
              return (
                <Tr key={key} className={isAll ? "ph-row-all" : ""}>
                  <Td className="ph-accent" style={{ fontWeight: 600 }}>
                    {PIPELINE_LABEL[key]}
                  </Td>
                  <Td>{t.count ?? 0}</Td>
                  <Td>{t.pct != null ? t.pct.toFixed(1) + "%" : "—"}</Td>
                  <Td className={clsForSign(t.realized_pnl ?? null)}>
                    {fmt(t.realized_pnl ?? null)}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Section>

      <Section title={`Settled bet history · ${filteredBets.length} bets`}>
        <BetFilterBar
          state={filter.state}
          set={filter.set}
          toggleSource={filter.toggleSource}
          visible={filteredBets.length}
          total={bets.length}
        />
        <Table>
          <THead>
            <Tr>
              <Th />
              <SortHeader {...sort.bind("source")}>Source</SortHeader>
              <SortHeader {...sort.bind("label")}>Label</SortHeader>
              <SortHeader {...sort.bind("instrument")}>Instrument</SortHeader>
              <SortHeader {...sort.bind("contracts")}>Contracts</SortHeader>
              <SortHeader {...sort.bind("cost")}>Cost</SortHeader>
              <SortHeader {...sort.bind("realized")}>Realized</SortHeader>
              <SortHeader {...sort.bind("roi")}>ROI</SortHeader>
              <SortHeader {...sort.bind("settled_at")}>Settled at</SortHeader>
            </Tr>
          </THead>
          <TBody>
            {q.isLoading && <EmptyRow colSpan={9}>Loading…</EmptyRow>}
            {!q.isLoading && sort.rows.length === 0 && (
              <EmptyRow colSpan={9}>
                {bets.length === 0
                  ? "No settled bets yet"
                  : "No bets match current filters"}
              </EmptyRow>
            )}
            {sort.rows.map((b, i) => (
              <SettledRow key={(b.label ?? "row") + i} b={b} />
            ))}
          </TBody>
        </Table>
      </Section>
    </div>
  );
}

function SettledRow({ b }: { b: SettledBet }) {
  const [open, setOpen] = useState(false);
  const hasLegs = (b.legs ?? []).length > 0;
  return (
    <>
      <Tr
        onClick={() => hasLegs && setOpen((o) => !o)}
        style={hasLegs ? { cursor: "pointer" } : undefined}
      >
        <Td className="ph-muted" style={{ width: 18 }}>
          {hasLegs ? (open ? "▼" : "▶") : ""}
        </Td>
        <Td>
          <SourceBadge source={b.source} />
        </Td>
        <Td>{b.label ?? "—"}</Td>
        <Td className="ph-muted">{b.instrument ?? ""}</Td>
        <Td>{b.contracts ?? "—"}</Td>
        <Td>{b.cost != null ? "$" + b.cost.toFixed(2) : "—"}</Td>
        <Td>
          <PnLBadge value={b.realized_pnl_dollars ?? null} />
        </Td>
        <Td>
          <PnLBadge value={b.roi_pct ?? null} format="percent" />
        </Td>
        <Td className="ph-muted" style={{ fontSize: 10 }}>
          {(b.settled_at ?? "").slice(0, 16)}
        </Td>
      </Tr>
      {open && hasLegs && (
        <tr>
          <td colSpan={9} className="ph-bg-surface-3" style={{ padding: 10 }}>
            <Table>
              <THead>
                <Tr>
                  <Th>Instrument</Th>
                  <Th>Side</Th>
                  <Th>Entry</Th>
                  <Th>Exit</Th>
                  <Th>Leg PnL</Th>
                </Tr>
              </THead>
              <TBody>
                {(b.legs ?? []).map((l, i) => (
                  <Tr key={(l.instrument ?? "leg") + i}>
                    <Td>{l.instrument ?? "—"}</Td>
                    <Td>{l.side ?? "—"}</Td>
                    <Td>{l.entry != null ? l.entry.toFixed(3) : "—"}</Td>
                    <Td>{l.exit != null ? l.exit.toFixed(3) : "—"}</Td>
                    <Td>
                      <PnLBadge value={l.pnl ?? null} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </td>
        </tr>
      )}
    </>
  );
}
