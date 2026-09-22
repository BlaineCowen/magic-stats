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
import { SideBadge } from "@/components/polyhedge/ui/Badge";
import { Button } from "@/components/polyhedge/ui/Button";
import { ConfirmDialog } from "@/components/polyhedge/ConfirmDialog";
import { PnLBadge } from "@/components/polyhedge/PnLBadge";
import {
  clsForSign,
  combinedCostClass,
  daysToClose,
} from "@/lib/polyhedge/format";
import { useTableSort } from "@/lib/polyhedge/useTableSort";
import type { ManualArbPair } from "@/lib/polyhedge/types";
import {
  useManualArbAutoExecute,
  useManualArbDelete,
  useManualArbsList,
} from "./hooks";
import { cn } from "@/components/polyhedge/cn";

// Pre-compute derived fields used both for sorting and rendering.
type Row = ManualArbPair & {
  _combined: number | null;
  _profit$: number | null;
  _mtm: number | null;
  _event_key: string | null;
};

function enrich(p: ManualArbPair): Row {
  const st = p.state ?? {};
  const combined =
    st.kalshi_best_ask != null && st.poly_best_ask != null
      ? st.kalshi_best_ask + st.poly_best_ask
      : null;
  const avail = st.current_max_contracts ?? null;
  const profit =
    avail != null && combined != null && combined < 1.0
      ? avail * (1.0 - combined)
      : null;
  const openBet = (p.recent_bets ?? []).find((b) => b.status === "open");
  return {
    ...p,
    _combined: combined,
    _profit$: profit,
    _mtm: openBet?.current_mtm_roi_pct ?? null,
    _event_key: deriveEventKey({
      kalshiTicker: p.kalshi_market_ticker,
      kalshiEventUrl: p.kalshi_event_url,
      polyEventUrl: p.poly_event_url,
    }),
  };
}

export function ActivePairsTable() {
  const { data, isLoading, isError } = useManualArbsList();
  const del = useManualArbDelete();
  const toggle = useManualArbAutoExecute();
  const enriched: Row[] = (data?.pairs ?? []).map(enrich);

  const sort = useTableSort<Row>(
    enriched,
    {
      label: (r) => r.label,
      event: (r) => r._event_key ?? "",
      kalshi_ask: (r) => r.state?.kalshi_best_ask ?? null,
      poly_ask: (r) => r.state?.poly_best_ask ?? null,
      combined: (r) => r._combined,
      floor: (r) => r.state?.current_roi_pct ?? null,
      profit: (r) => r._profit$,
      annual: (r) => r.state?.current_annualized_roi_pct ?? null,
      days: (r) => r.state?.days_to_close ?? null,
      avail: (r) => r.state?.current_max_contracts ?? null,
      mtm: (r) => r._mtm,
      trigger: (r) => r.state?.trigger_state ?? null,
      bets: (r) => (r.open_bet_count ?? 0) * 1000 + (r.settled_bet_count ?? 0),
      realized: (r) => r.realized_pnl_dollars ?? null,
    },
    { key: "profit", dir: "desc" },
  );

  return (
    <div>
      <div
        className="ph-muted-2"
        style={{
          padding: "6px 12px",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {enriched.length} active pair{enriched.length === 1 ? "" : "s"}
      </div>
      <Table>
        <THead>
          <Tr>
            <th />
            <th>Arm</th>
            <SortHeader {...sort.bind("label")}>Pair</SortHeader>
            <SortHeader {...sort.bind("kalshi_ask")}>K Ask</SortHeader>
            <SortHeader {...sort.bind("poly_ask")}>P Ask</SortHeader>
            <SortHeader {...sort.bind("combined")}>Combined</SortHeader>
            <SortHeader {...sort.bind("floor")}>Floor</SortHeader>
            <SortHeader {...sort.bind("profit")}>Profit</SortHeader>
            <SortHeader {...sort.bind("annual")}>Ann. ROI</SortHeader>
            <SortHeader {...sort.bind("days")}>Days</SortHeader>
            <SortHeader {...sort.bind("avail")}>Avail</SortHeader>
            <SortHeader {...sort.bind("mtm")}>MTM</SortHeader>
            <SortHeader {...sort.bind("trigger")}>Trigger</SortHeader>
            <SortHeader {...sort.bind("bets")}>Bets</SortHeader>
            <SortHeader {...sort.bind("realized")}>Realized</SortHeader>
          </Tr>
        </THead>
        <TBody>
          {isLoading && <EmptyRow colSpan={15}>Loading…</EmptyRow>}
          {isError && (
            <EmptyRow colSpan={15}>Failed to load active pairs</EmptyRow>
          )}
          {!isLoading && !isError && sort.rows.length === 0 && (
            <EmptyRow colSpan={15}>
              No active pairs — paste two URLs above and start matching
            </EmptyRow>
          )}
          {sort.rows.map((p) => (
            <PairRow
              key={p.id}
              row={p}
              togglePending={toggle.isPending}
              onToggleAutoExecute={(enabled) =>
                toggle.mutate({ id: p.id, enabled })
              }
              onDelete={async () => {
                await del.mutateAsync(p.id);
              }}
            />
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function PairRow({
  row: p,
  onDelete,
  onToggleAutoExecute,
  togglePending,
}: {
  row: Row;
  onDelete: () => Promise<void>;
  onToggleAutoExecute: (enabled: boolean) => void;
  togglePending: boolean;
}) {
  const armed = Boolean(p.auto_execute);
  const st = p.state ?? {};
  const combined = p._combined;
  const floor = st.current_roi_pct ?? null;
  const profitable = floor != null && floor > 0;
  const avail = st.current_max_contracts ?? null;
  const profitDollars = p._profit$;
  const annual = st.current_annualized_roi_pct ?? null;
  const trig = st.trigger_state ?? "—";
  const trigClass = trig === "open" ? "ph-pos" : "ph-muted";
  const days = st.days_to_close ?? null;
  const openBet = (p.recent_bets ?? []).find((b) => b.status === "open");
  const mtm = openBet?.current_mtm_roi_pct ?? null;
  const target = openBet?.target_exit_roi_pct ?? null;
  const mtmCls =
    mtm == null
      ? "ph-muted"
      : target != null && mtm >= target
        ? "ph-pos"
        : mtm >= 0
          ? "ph-warn"
          : "ph-neg";
  const mtmStr =
    mtm != null
      ? (mtm >= 0 ? "+" : "") +
        mtm.toFixed(1) +
        "%" +
        (target != null ? ` / ${target.toFixed(0)}%` : "")
      : "—";

  return (
    <Tr className={cn(profitable && "ph-row-profit")}>
      <Td style={{ textAlign: "center" }}>
        <ConfirmDialog
          title={`Stop monitoring pair #${p.id}?`}
          description={`Delete the pair "${p.label}". Open bets attached to it will also be removed.`}
          confirmLabel="Stop monitoring"
          onConfirm={onDelete}
          trigger={
            <Button variant="danger" aria-label="Delete pair">
              ✕
            </Button>
          }
        />
      </Td>
      <Td style={{ textAlign: "center" }}>
        <Button
          variant="toggle"
          active={armed}
          disabled={togglePending}
          aria-label={armed ? "Disarm auto-execute" : "Arm auto-execute"}
          aria-pressed={armed}
          onClick={() => onToggleAutoExecute(!armed)}
        >
          {armed ? "ON" : "OFF"}
        </Button>
      </Td>
      <Td>
        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <EventChip
            kalshiTicker={p.kalshi_market_ticker}
            kalshiEventUrl={p.kalshi_event_url}
            polyEventUrl={p.poly_event_url}
          />
          <span>{p.label}</span>
        </div>
        <div
          className="ph-muted-2"
          style={{
            fontSize: 10,
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span>K</span>
          <SideBadge side={p.kalshi_side} />
          <span className="ph-muted" title={p.kalshi_market_ticker}>
            {shortTicker(p.kalshi_market_ticker)}
          </span>
          <span className="ph-muted">·</span>
          <span>P</span>
          <SideBadge side={p.poly_side} />
          <span className="ph-muted">
            {p.poly_outcome_label && p.poly_outcome_label.length > 20
              ? p.poly_outcome_label.slice(0, 20) + "…"
              : p.poly_outcome_label}
          </span>
        </div>
      </Td>
      <Td className="ph-muted">
        <AskCell price={st.kalshi_best_ask} observedAt={st.kalshi_best_ask_at} />
      </Td>
      <Td className="ph-muted">
        <AskCell price={st.poly_best_ask} observedAt={st.poly_best_ask_at} />
      </Td>
      <Td className={combinedCostClass(combined)}>
        {combined != null ? combined.toFixed(3) : "—"}
      </Td>
      <Td>
        {floor == null ? (
          <span className="ph-muted">—</span>
        ) : profitable ? (
          <span className="ph-pos" style={{ fontWeight: 700 }}>
            +{floor.toFixed(1)}¢
          </span>
        ) : (
          <span className="ph-muted">{floor.toFixed(1)}¢</span>
        )}
      </Td>
      <Td>
        {profitDollars != null ? (
          <span className="ph-pos" style={{ fontWeight: 700 }}>
            ${profitDollars.toFixed(2)}
          </span>
        ) : (
          <span className="ph-muted">—</span>
        )}
      </Td>
      <Td className={clsForSign(annual)}>
        {annual != null ? annual.toFixed(0) + "%" : "—"}
      </Td>
      <Td className="ph-muted">{daysToClose(days)}</Td>
      <Td style={{ textAlign: "center" }}>
        {avail != null ? avail : <span className="ph-muted">0</span>}
      </Td>
      <Td className={mtmCls}>{mtmStr}</Td>
      <Td className={trigClass}>{trig}</Td>
      <Td>
        {(p.open_bet_count ?? 0) > 0 ? (
          <>
            <span className="ph-pos">{p.open_bet_count} open</span>
            {(p.settled_bet_count ?? 0) > 0 && (
              <span className="ph-muted"> · {p.settled_bet_count}</span>
            )}
          </>
        ) : (p.settled_bet_count ?? 0) > 0 ? (
          <span className="ph-muted">{p.settled_bet_count} settled</span>
        ) : (
          <span className="ph-muted">—</span>
        )}
      </Td>
      <Td>
        <PnLBadge value={p.realized_pnl_dollars ?? null} />
      </Td>
    </Tr>
  );
}

function shortTicker(t?: string) {
  if (!t) return "";
  return t.replace(
    /^(KXBALANCEPOWERCOMBO|KXNHL|KXMLB|KXNBA|KXNFL)/i,
    (m) => m.slice(0, 4) + "…",
  );
}

/**
 * Derive a short, human-readable event key so the user can tell two pairs
 * with the same candidate label apart when they're bound to different
 * underlying questions (e.g., "Robert F. Kennedy Jr." appears in both
 * KXTRUMPADMINLEAVE-26DEC31-* and KXPRESNOMR-28-* — without this chip the
 * dashboard rows look identical).
 *
 * Preference order:
 *   1. Kalshi event slug from the pasted URL (most authoritative)
 *   2. Polymarket event slug
 *   3. Kalshi ticker prefix (everything before the last `-CANDIDATESUFFIX`)
 */
function deriveEventKey(args: {
  kalshiTicker?: string;
  kalshiEventUrl?: string | null;
  polyEventUrl?: string | null;
}): string | null {
  const ku = args.kalshiEventUrl ?? undefined;
  if (ku) {
    // Kalshi: https://kalshi.com/markets/<series>/<title>/<ticker>
    const m = ku.match(/\/markets\/([^/?#]+)/i);
    if (m && m[1]) return m[1].toUpperCase().slice(0, 24);
  }
  const pu = args.polyEventUrl ?? undefined;
  if (pu) {
    // Polymarket: https://polymarket.com/event/<slug>
    const m = pu.match(/\/event\/([^/?#]+)/i);
    if (m && m[1]) return m[1].replace(/-/g, " ").slice(0, 28);
  }
  const t = args.kalshiTicker ?? "";
  if (!t) return null;
  // Drop the trailing `-CANDIDATESUFFIX`, leaving e.g. `KXPRESNOMR-28` or
  // `KXTRUMPADMINLEAVE-26DEC31`. This is the same event key two sibling
  // sub-markets share.
  const parts = t.split("-");
  if (parts.length <= 1) return t;
  return parts.slice(0, -1).join("-");
}

function EventChip(props: {
  kalshiTicker?: string;
  kalshiEventUrl?: string | null;
  polyEventUrl?: string | null;
}) {
  const key = deriveEventKey(props);
  if (!key) return null;
  return (
    <span
      title={
        props.kalshiEventUrl ??
        props.polyEventUrl ??
        props.kalshiTicker ??
        key
      }
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "1px 5px",
        border: "1px solid #4a5568",
        borderRadius: 3,
        color: "#a0aec0",
        whiteSpace: "nowrap",
      }}
    >
      {key}
    </span>
  );
}

/**
 * Renders an order-book ask price, with a small age tag when the price is
 * stale (last observed > 30s ago — typically because the live book is
 * one-sided or empty). Engine writes `*_best_ask_at` as unix seconds when
 * each ask was last observed live.
 */
function AskCell({
  price,
  observedAt,
}: {
  price?: number | null;
  observedAt?: number | null;
}) {
  if (price == null) return <>—</>;
  const ageS =
    observedAt != null ? Date.now() / 1000 - observedAt : null;
  const stale = ageS != null && ageS > 30;
  return (
    <span title={stale ? `last observed ${ageStr(ageS!)} ago` : "live"}>
      {price.toFixed(3)}
      {stale && (
        <span
          className="ph-muted"
          style={{ marginLeft: 4, fontSize: 9, fontStyle: "italic" }}
        >
          {ageStr(ageS!)}
        </span>
      )}
    </span>
  );
}

function ageStr(s: number): string {
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${(s / 60).toFixed(0)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}
