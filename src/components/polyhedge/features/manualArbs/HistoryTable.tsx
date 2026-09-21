"use client";

import {
  Table,
  TBody,
  THead,
  Tr,
  Td,
  EmptyRow,
} from "@/components/polyhedge/ui/Table";
import { SortHeader } from "@/components/polyhedge/ui/SortHeader";
import { PnLBadge } from "@/components/polyhedge/PnLBadge";
import { pct } from "@/lib/polyhedge/format";
import { useTableSort } from "@/lib/polyhedge/useTableSort";
import type { HistoryRow } from "@/lib/polyhedge/types";
import { useManualArbsHistory } from "./hooks";

export function HistoryTable() {
  const { data, isLoading } = useManualArbsHistory();
  const rows: HistoryRow[] = data?.history ?? [];
  const sort = useTableSort<HistoryRow>(
    rows,
    {
      label: (r) => r.pair_label ?? r.label ?? "",
      settled: (r) => r.settled_count ?? null,
      win: (r) => r.win_pct ?? null,
      cost: (r) => r.cost ?? null,
      realized: (r) => r.realized_pnl ?? null,
      roi: (r) => r.roi_pct ?? null,
    },
    { key: "realized", dir: "desc" },
  );
  return (
    <Table>
      <THead>
        <Tr>
          <SortHeader {...sort.bind("label")}>Pair</SortHeader>
          <SortHeader {...sort.bind("settled")}>Settled</SortHeader>
          <SortHeader {...sort.bind("win")}>Win %</SortHeader>
          <SortHeader {...sort.bind("cost")}>Cost</SortHeader>
          <SortHeader {...sort.bind("realized")}>Realized</SortHeader>
          <SortHeader {...sort.bind("roi")}>ROI</SortHeader>
        </Tr>
      </THead>
      <TBody>
        {isLoading && <EmptyRow colSpan={6}>Loading…</EmptyRow>}
        {!isLoading && sort.rows.length === 0 && (
          <EmptyRow colSpan={6}>No settled history yet</EmptyRow>
        )}
        {sort.rows.map((r, i) => (
          <Tr key={(r.pair_label ?? r.label ?? "row") + i}>
            <Td style={{ fontWeight: 600 }}>
              {r.pair_label ?? r.label ?? "—"}
            </Td>
            <Td>{r.settled_count ?? 0}</Td>
            <Td>{pct(r.win_pct ?? null)}</Td>
            <Td className="ph-muted">
              {r.cost != null ? "$" + r.cost.toFixed(2) : "—"}
            </Td>
            <Td>
              <PnLBadge value={r.realized_pnl ?? null} />
            </Td>
            <Td>
              <PnLBadge value={r.roi_pct ?? null} format="percent" />
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
