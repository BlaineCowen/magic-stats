"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Section } from "@/components/polyhedge/ui/Section";
import { Input } from "@/components/polyhedge/ui/Input";
import { Button } from "@/components/polyhedge/ui/Button";
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
import { Badge } from "@/components/polyhedge/ui/Badge";
import { ConfirmDialog } from "@/components/polyhedge/ConfirmDialog";
import { PnLBadge } from "@/components/polyhedge/PnLBadge";
import { cn } from "@/components/polyhedge/cn";
import { dollars, tempRange } from "@/lib/polyhedge/format";
import { useTableSort } from "@/lib/polyhedge/useTableSort";
import { api } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import type {
  HistoryResponse,
  TempArbCombo,
  TempArbPair,
  TempArbScanResponse,
  TempArbsListResponse,
  HistoryRow,
} from "@/lib/polyhedge/types";

function useTempArbsList() {
  return useQuery<TempArbsListResponse>({
    queryKey: qk.tempArbsList,
    queryFn: () => api.get<TempArbsListResponse>("/api/temp-arbs/list"),
    refetchInterval: 10_000,
  });
}
function useTempArbsHistory() {
  return useQuery<HistoryResponse>({
    queryKey: qk.tempArbsHistory,
    queryFn: () => api.get<HistoryResponse>("/api/temp-arbs/history"),
    refetchInterval: 60_000,
  });
}
function useTempArbScan() {
  return useMutation({
    mutationFn: (body: { kalshi_url: string; poly_url: string }) =>
      api.post<TempArbScanResponse>("/api/temp-arbs/scan", body),
  });
}
function useTempArbSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      label: string;
      kalshi_url: string;
      poly_url: string;
    }) =>
      api.post<{ id: number; ok?: boolean; city?: string }>(
        "/api/temp-arbs/save",
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tempArbsList }),
  });
}
function useTempArbDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/temp-arbs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tempArbsList }),
  });
}

export function WeatherView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Section title="Weather (Temp) Arbs · Scan & Save" variant="weather">
        <ScanPanel />
      </Section>
      <Section title="Active Pairs" variant="weather">
        <ActiveTempArbs />
      </Section>
      <Section title="Settled History" variant="weather" defaultCollapsed>
        <HistoryPanel />
      </Section>
    </div>
  );
}

function ScanPanel() {
  const [kUrl, setKUrl] = useState("");
  const [pUrl, setPUrl] = useState("");
  const [label, setLabel] = useState("");
  const [scanResult, setScanResult] = useState<TempArbScanResponse | null>(
    null,
  );
  const scan = useTempArbScan();
  const save = useTempArbSave();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleScan() {
    setErrMsg(null);
    setSavedMsg(null);
    try {
      const r = await scan.mutateAsync({
        kalshi_url: kUrl.trim(),
        poly_url: pUrl.trim(),
      });
      setScanResult(r);
    } catch (e) {
      setErrMsg("Scan failed: " + (e as Error).message);
    }
  }

  async function handleSave() {
    if (!label.trim()) {
      setErrMsg("Label required");
      return;
    }
    setErrMsg(null);
    try {
      const r = await save.mutateAsync({
        label: label.trim(),
        kalshi_url: kUrl.trim(),
        poly_url: pUrl.trim(),
      });
      setSavedMsg(
        `Saved pair #${r.id}${r.city ? ` (${r.city})` : ""} — backfill running in background.`,
      );
      setLabel("");
      setKUrl("");
      setPUrl("");
      setScanResult(null);
    } catch (e) {
      setErrMsg("Save failed: " + (e as Error).message);
    }
  }

  return (
    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 8,
        }}
      >
        <Input
          placeholder="Kalshi temp series URL"
          value={kUrl}
          onChange={(e) => setKUrl(e.target.value)}
        />
        <Input
          placeholder="Polymarket temp event URL"
          value={pUrl}
          onChange={(e) => setPUrl(e.target.value)}
        />
        <Button
          onClick={handleScan}
          disabled={scan.isPending || !kUrl.trim() || !pUrl.trim()}
        >
          {scan.isPending ? "Scanning…" : "Scan"}
        </Button>
      </div>
      {errMsg && (
        <div className="ph-neg" style={{ fontSize: 11 }}>
          {errMsg}
        </div>
      )}
      {savedMsg && (
        <div className="ph-pos" style={{ fontSize: 11 }}>
          {savedMsg}
        </div>
      )}
      {scanResult && (
        <div
          style={{
            borderTop: "1px solid #2d3748",
            paddingTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11 }}>
            <span style={{ fontWeight: 600 }}>{scanResult.city_name}</span>{" "}
            <span className="ph-muted-2">on {scanResult.event_date}</span>{" "}
            <span className="ph-muted">
              · {scanResult.kalshi_markets.length} K ×{" "}
              {scanResult.poly_markets.length} P buckets
            </span>{" "}
            {scanResult.same_station ? (
              <span className="ph-pos">
                🟢 SAME STATION (only bucket-boundary risk)
              </span>
            ) : (
              <span className="ph-warn">
                Stations: {scanResult.kalshi_station_label} vs{" "}
                {scanResult.poly_station_label}
              </span>
            )}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <BucketColumn
              title="Kalshi buckets"
              markets={scanResult.kalshi_markets}
              kind="kalshi"
            />
            <BucketColumn
              title="Polymarket buckets"
              markets={scanResult.poly_markets}
              kind="poly"
            />
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <Input
              placeholder="Pair label (required)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{ maxWidth: 360 }}
            />
            <Button
              onClick={handleSave}
              disabled={save.isPending || !label.trim()}
            >
              {save.isPending ? "Saving…" : "Save & start backfill"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BucketColumn({
  title,
  markets,
  kind,
}: {
  title: string;
  markets: Array<{
    ticker?: string;
    condition_id?: string;
    title?: string | null;
    group_item_title?: string | null;
    question?: string | null;
    yes_ask_dollars?: number | null;
    no_ask_dollars?: number | null;
    yes_last_price?: number | null;
    no_last_price?: number | null;
  }>;
  kind: "kalshi" | "poly";
}) {
  return (
    <div>
      <h4
        className="ph-muted-2"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
          padding: "6px 0",
          margin: 0,
        }}
      >
        {title}
      </h4>
      <div style={{ maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
        {markets.length === 0 && (
          <div className="ph-muted" style={{ fontSize: 11, padding: 8 }}>
            No buckets parsed
          </div>
        )}
        {markets.map((m, i) => {
          const id = kind === "kalshi" ? m.ticker : m.condition_id;
          const label =
            kind === "kalshi"
              ? m.title || m.ticker
              : m.group_item_title ||
                m.question ||
                (m.condition_id ?? "").slice(0, 18);
          const yes =
            kind === "kalshi" ? m.yes_ask_dollars : m.yes_last_price;
          const no = kind === "kalshi" ? m.no_ask_dollars : m.no_last_price;
          return (
            <div
              key={(id ?? "") + i}
              className="ph-pick-card"
              style={{ cursor: "default" }}
            >
              <div className="ph-pick-title">{label}</div>
              <div className="ph-pick-meta">
                <span className="ph-muted">
                  {(id ?? "").slice(0, 18)}…
                </span>
                <span className="ph-muted">·</span>
                <span>YES {dollars(yes ?? null)}</span>
                <span className="ph-muted">·</span>
                <span>NO {dollars(no ?? null)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sort accessors: combo-level columns reduce across each parent's top_combos
// to a representative value (max for ROI/payout, min for cost), so sorting at
// the parent level still surfaces the best combo for that field.
function maxOf<T>(arr: T[], pick: (x: T) => number | null | undefined): number | null {
  let best: number | null = null;
  for (const x of arr) {
    const v = pick(x);
    if (v == null) continue;
    if (best == null || v > best) best = v;
  }
  return best;
}
function minOf<T>(arr: T[], pick: (x: T) => number | null | undefined): number | null {
  let best: number | null = null;
  for (const x of arr) {
    const v = pick(x);
    if (v == null) continue;
    if (best == null || v < best) best = v;
  }
  return best;
}

function ActiveTempArbs() {
  const { data, isLoading } = useTempArbsList();
  const del = useTempArbDelete();
  const pairs = data?.pairs ?? [];
  const sort = useTableSort<TempArbPair>(
    pairs,
    {
      label: (r) => r.label,
      avail: (r) => maxOf(r.top_combos ?? [], (c) => c.current_max_contracts),
      kalshi_p: (r) => minOf(r.top_combos ?? [], (c) => c.current_kalshi_price),
      poly_p: (r) => minOf(r.top_combos ?? [], (c) => c.current_poly_price),
      combined: (r) => minOf(r.top_combos ?? [], (c) => c.current_combined_cost),
      min_payout: (r) => maxOf(r.top_combos ?? [], (c) => c.current_ev_payout),
      max_payout: (r) => maxOf(r.top_combos ?? [], (c) => c.alpha),
      roi: (r) => maxOf(r.top_combos ?? [], (c) => c.current_ev_roi_pct),
      trigger: (r) =>
        (r.top_combos ?? []).some((c) => c.trigger_state === "open")
          ? "open"
          : "closed",
      realized: (r) => r.realized_pnl_dollars ?? null,
    },
    { key: "roi", dir: "desc" },
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
        {pairs.length} active pair{pairs.length === 1 ? "" : "s"}
      </div>
      <Table>
        <THead>
          <Tr>
            <SortHeader {...sort.bind("label")}>Pair</SortHeader>
            <Th>K range</Th>
            <Th>P range</Th>
            <Th>Sides</Th>
            <SortHeader {...sort.bind("avail")}>Avail</SortHeader>
            <SortHeader {...sort.bind("kalshi_p")}>K $</SortHeader>
            <SortHeader {...sort.bind("poly_p")}>P $</SortHeader>
            <SortHeader {...sort.bind("combined")}>Combined</SortHeader>
            <SortHeader {...sort.bind("min_payout")}>Min payout</SortHeader>
            <SortHeader {...sort.bind("max_payout")}>Max payout</SortHeader>
            <SortHeader {...sort.bind("roi")}>Guaranteed ROI</SortHeader>
            <SortHeader {...sort.bind("trigger")}>Trigger</SortHeader>
            <SortHeader {...sort.bind("realized")}>Realized</SortHeader>
            <th />
          </Tr>
        </THead>
        <TBody>
          {isLoading && <EmptyRow colSpan={14}>Loading…</EmptyRow>}
          {!isLoading && sort.rows.length === 0 && (
            <EmptyRow colSpan={14}>
              No active pairs — paste two URLs above to start tracking
            </EmptyRow>
          )}
          {sort.rows.map((p) => (
            <PairBlock
              key={p.id}
              pair={p}
              onDelete={() => del.mutateAsync(p.id)}
            />
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function PairBlock({
  pair,
  onDelete,
}: {
  pair: TempArbPair;
  onDelete: () => Promise<void>;
}) {
  const bf = pair.backfill_status ?? "pending";
  return (
    <>
      <Tr style={{ fontWeight: 600 }}>
        <Td colSpan={9}>
          <strong>{pair.label}</strong>
          <span className="ph-muted-2">
            {" "}
            · {pair.city_key} · {pair.event_date}
          </span>
          <span className={cn("ph-bf", `ph-bf-${bf}`)} style={{ marginLeft: 8 }}>
            {bf}
            {pair.backfill_n_pairs != null && ` n=${pair.backfill_n_pairs}`}
          </span>
          <span className="ph-muted" style={{ marginLeft: 8 }}>
            {pair.n_combos ?? 0} combos
          </span>
        </Td>
        <Td colSpan={3} />
        <Td>
          <PnLBadge value={pair.realized_pnl_dollars ?? null} />
        </Td>
        <Td>
          <ConfirmDialog
            title={`Stop monitoring temp-arb pair #${pair.id}?`}
            confirmLabel="Stop monitoring"
            onConfirm={onDelete}
            trigger={
              <Button variant="danger" aria-label="Delete pair">
                ✕
              </Button>
            }
          />
        </Td>
      </Tr>
      {(pair.top_combos ?? []).map((c, i) => (
        <ComboRow key={i} c={c} />
      ))}
    </>
  );
}

function ComboRow({ c }: { c: TempArbCombo }) {
  const guarCls =
    c.current_ev_roi_pct == null
      ? "ph-muted"
      : c.current_ev_roi_pct >= 1
        ? "ph-pos"
        : c.current_ev_roi_pct >= 0
          ? "ph-warn"
          : "ph-neg";
  const stateCls = c.trigger_state === "open" ? "ph-pos" : "ph-muted";
  return (
    <Tr>
      <Td className="ph-muted" style={{ paddingLeft: 24 }}>
        ↳ combo
      </Td>
      <Td>{tempRange(c.kalshi_low, c.kalshi_high)}</Td>
      <Td>{tempRange(c.poly_low, c.poly_high)}</Td>
      <Td>
        <Badge>
          {c.kalshi_side}/{c.poly_side}
        </Badge>
      </Td>
      <Td>
        {c.current_max_contracts ?? <span className="ph-muted">—</span>}
      </Td>
      <Td>
        {c.current_kalshi_price != null
          ? "$" + c.current_kalshi_price.toFixed(3)
          : "—"}
      </Td>
      <Td>
        {c.current_poly_price != null
          ? "$" + c.current_poly_price.toFixed(3)
          : "—"}
      </Td>
      <Td>
        {c.current_combined_cost != null
          ? "$" + c.current_combined_cost.toFixed(2)
          : "—"}
      </Td>
      <Td className="ph-muted">
        {c.current_ev_payout != null
          ? "$" + c.current_ev_payout.toFixed(2)
          : "—"}
      </Td>
      <Td className="ph-muted">
        {c.alpha != null ? "$" + c.alpha.toFixed(2) : "—"}
      </Td>
      <Td className={guarCls}>
        {c.current_ev_roi_pct != null
          ? c.current_ev_roi_pct.toFixed(2) + "%"
          : "—"}
      </Td>
      <Td className={stateCls}>{c.trigger_state ?? "—"}</Td>
      <Td colSpan={2} />
    </Tr>
  );
}

function HistoryPanel() {
  const { data, isLoading } = useTempArbsHistory();
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
            <Td>{r.pair_label ?? r.label ?? "—"}</Td>
            <Td>{r.settled_count ?? 0}</Td>
            <Td>
              {r.win_pct != null ? r.win_pct.toFixed(1) + "%" : "—"}
            </Td>
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
