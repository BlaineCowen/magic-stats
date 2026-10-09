"use client";

import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/polyhedge/ui/Button";
import { EmptyRow, TBody, THead, Td, Th, Table, Tr } from "@/components/polyhedge/ui/Table";
import { SortHeader } from "@/components/polyhedge/ui/SortHeader";
import { useTableSort, type Accessors } from "@/lib/polyhedge/useTableSort";
import type { ArbCandidateRow } from "@/lib/polyhedge/types";
import { ApproveButton } from "./ApproveButton";
import { SeverityBadge } from "./badges";
import { fmtAgo, fmtPct } from "./format";
import { arbErrorMessage, useArbApproveEvent } from "./hooks";

const SEV_RANK: Record<string, number> = { BLOCK: 3, WARN: 2, INFO: 1, NONE: 0 };

const ACCESSORS: Accessors<ArbCandidateRow> = {
  severity: (r) => SEV_RANK[r.max_severity ?? "NONE"] ?? 0,
  outcome: (r) => r.kalshi_outcome_label ?? "",
  method: (r) => r.outcome_match_method ?? "",
  warns: (r) => r.warn_count ?? 0,
  edge: (r) => r.edge_roi_pct,
  depth: (r) => r.edge_contracts,
  delay: (r) => r.poly_seconds_delay ?? 0,
  seen: (r) => r.first_seen_at,
};
const COLS = 10;
const MAX_BATCH = 200;

/** Two clicks, no typing: "Approve N ready" → "Confirm N?". */
function EventApproveButton({ rows }: { rows: ArbCandidateRow[] }) {
  const ready = rows.filter((r) => r.status === "pending" && !r.block_count).slice(0, MAX_BATCH);
  const [confirming, setConfirming] = useState(false);
  const m = useArbApproveEvent();
  if (ready.length === 0) return null;
  const first = ready[0];
  return (
    <span style={{ marginLeft: 12, display: "inline-flex", gap: 8, alignItems: "center" }}>
      <Button
        variant={confirming ? "primary" : "ghost"}
        disabled={m.isPending || first == null}
        onClick={(e) => {
          e.stopPropagation();
          if (!confirming) {
            setConfirming(true);
            window.setTimeout(() => setConfirming(false), 4000);
            return;
          }
          setConfirming(false);
          if (first == null) return;
          m.mutate({
            items: ready.map((r) => ({ id: r.id, rules_hash: r.rules_hash })),
            check_version: first.check_version,
            note: "",
          });
        }}
      >
        {m.isPending
          ? `Approving ${ready.length}…`
          : confirming
            ? `Confirm ${ready.length} (disarmed)?`
            : `Approve ${ready.length} ready`}
      </Button>
      {m.data && (
        <span className={m.data.approved === ready.length ? "ph-pos" : "ph-warn"}>
          {m.data.approved} approved
          {m.data.results.some((x) => !x.ok)
            ? ` · ${m.data.results.filter((x) => !x.ok).length} refused (see rows)`
            : ""}
        </span>
      )}
      {m.error && <span className="ph-neg">{arbErrorMessage(m.error)}</span>}
    </span>
  );
}

/** Candidates grouped by Kalshi event (one F1 event ≈ 20 driver candidates). */
export function CandidateQueueTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ArbCandidateRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const sort = useTableSort(rows, ACCESSORS, { key: "severity", dir: "asc" });
  // ~1,300 candidates across ~90 events: show events, open one at a time.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const selectedEvent = rows.find((r) => r.id === selectedId)?.kalshi_event_ticker;
  const isOpen = (event: string) => expanded.has(event) || event === selectedEvent;
  const toggle = (event: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  const groups = useMemo(() => {
    const m = new Map<string, ArbCandidateRow[]>();
    for (const r of sort.rows) {
      const list = m.get(r.kalshi_event_ticker);
      if (list) list.push(r);
      else m.set(r.kalshi_event_ticker, [r]);
    }
    return [...m.entries()];
  }, [sort.rows]);

  return (
    <Table>
      <THead>
        <Tr>
          <SortHeader {...sort.bind("severity")}>Severity</SortHeader>
          <SortHeader {...sort.bind("outcome")}>Kalshi ↔ Polymarket outcome</SortHeader>
          <SortHeader {...sort.bind("method")}>Match</SortHeader>
          <SortHeader {...sort.bind("warns")}>Blocks / Warns</SortHeader>
          <SortHeader {...sort.bind("edge")}>Edge ROI</SortHeader>
          <SortHeader {...sort.bind("depth")}>Depth</SortHeader>
          <SortHeader {...sort.bind("delay")}>Poly delay</SortHeader>
          <Th>Status</Th>
          <SortHeader {...sort.bind("seen")}>First seen</SortHeader>
          <Th />
        </Tr>
      </THead>
      <TBody>
        {groups.length === 0 ? (
          <EmptyRow colSpan={COLS}>No candidates match these filters.</EmptyRow>
        ) : (
          groups.map(([event, list]) => (
            <Fragment key={event}>
              <tr
                className="ph-group-row"
                onClick={() => toggle(event)}
                style={{ cursor: "pointer" }}
              >
                <td colSpan={COLS}>
                  <span style={{ width: 12, display: "inline-block" }}>
                    {isOpen(event) ? "▼" : "▶"}
                  </span>
                  {list[0]?.kalshi_event_title ?? event}{" "}
                  <span className="ph-muted-2">
                    · {event} ↔ {list[0]?.poly_event_title ?? "?"} ·{" "}
                    {list.filter((r) => r.status === "pending" && !r.block_count).length} ready
                    of {list.length}
                  </span>
                  <EventApproveButton rows={list} />
                </td>
              </tr>
              {isOpen(event) &&
                list.map((r) => (
                <Tr
                  key={r.id}
                  className={r.id === selectedId ? "ph-row-selected" : undefined}
                  onClick={() => onSelect(r.id)}
                  style={{ cursor: "pointer" }}
                >
                  <Td>
                    <SeverityBadge severity={r.max_severity} />
                  </Td>
                  <Td>
                    {r.kalshi_outcome_label} <span className="ph-muted-2">↔</span>{" "}
                    {r.poly_outcome_label}
                  </Td>
                  <Td>{r.outcome_match_method}</Td>
                  <Td title={r.warn_codes.length > 0 ? r.warn_codes.join(", ") : undefined}>
                    <span className={r.block_count ? "ph-neg" : "ph-muted-2"}>
                      {r.block_count ?? 0}
                    </span>
                    {" / "}
                    <span className={r.warn_count ? "ph-warn" : "ph-muted-2"}>
                      {r.warn_count ?? 0}
                    </span>
                  </Td>
                  <Td>{fmtPct(r.edge_roi_pct)}</Td>
                  <Td>{r.edge_contracts ?? "—"}</Td>
                  <Td className={r.poly_seconds_delay ? "ph-neg" : undefined}>
                    {r.poly_seconds_delay ? `${r.poly_seconds_delay}s` : "—"}
                  </Td>
                  <Td className={r.status === "stale" ? "ph-neg" : undefined}>
                    {r.status}
                    {r.rules_changed_since_review ? " · rules changed" : ""}
                  </Td>
                  <Td className="ph-muted-2">{fmtAgo(r.first_seen_at)}</Td>
                  <Td>
                    <ApproveButton row={r} compact />
                  </Td>
                </Tr>
                ))}
            </Fragment>
          ))
        )}
      </TBody>
    </Table>
  );
}
