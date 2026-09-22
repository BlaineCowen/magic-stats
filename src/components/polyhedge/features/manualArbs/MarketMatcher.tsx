"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/polyhedge/ui/Button";
import { cn } from "@/components/polyhedge/cn";
import { dollars } from "@/lib/polyhedge/format";
import type {
  KalshiScanMarket,
  ManualArbScanResponse,
  ManualArbPreflightResponse,
  PolyScanMarket,
} from "@/lib/polyhedge/types";
import {
  useManualArbPreflight,
  useManualArbSaveBidirectional,
} from "./hooks";
import { MatchConfirmModal } from "./MatchConfirmModal";

interface Props {
  scan: ManualArbScanResponse;
  urls: { kalshi_url: string; poly_url: string };
}

export function MarketMatcher({ scan, urls }: Props) {
  const [selKTicker, setSelKTicker] = useState<string | null>(null);
  const [selPCondId, setSelPCondId] = useState<string | null>(null);
  const [preflightResult, setPreflightResult] =
    useState<ManualArbPreflightResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const preflight = useManualArbPreflight();
  const save = useManualArbSaveBidirectional();

  const polyById = useMemo(() => {
    const m = new Map<string, PolyScanMarket>();
    for (const p of scan.poly_markets) m.set(p.condition_id, p);
    return m;
  }, [scan]);
  const kalshiByTicker = useMemo(() => {
    const m = new Map<string, KalshiScanMarket>();
    for (const k of scan.kalshi_markets) m.set(k.ticker, k);
    return m;
  }, [scan]);

  const ready = Boolean(selKTicker && selPCondId);

  async function runPreflight() {
    if (!selKTicker || !selPCondId) return;
    setSaveError(null);
    setPreflightResult(null);
    setModalOpen(true);
    try {
      const r = await preflight.mutateAsync({
        kalshi_url: urls.kalshi_url,
        poly_url: urls.poly_url,
        kalshi_market_ticker: selKTicker,
        poly_condition_id: selPCondId,
      });
      setPreflightResult(r);
    } catch (e) {
      setSaveError((e as Error).message);
      setModalOpen(false);
    }
  }

  async function confirmSave() {
    if (!selKTicker || !selPCondId || !preflightResult) return;
    const k = kalshiByTicker.get(selKTicker);
    const p = polyById.get(selPCondId);
    if (!k || !p) return;
    const label = `${k.title || k.ticker} / ${
      p.group_item_title || p.question || ""
    }`.slice(0, 120);
    try {
      await save.mutateAsync({
        kalshi_url: urls.kalshi_url,
        poly_url: urls.poly_url,
        kalshi_market_ticker: selKTicker,
        poly_condition_id: selPCondId,
        label,
      });
      setModalOpen(false);
      setSelKTicker(null);
      setSelPCondId(null);
      setPreflightResult(null);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }

  return (
    <div
      style={{
        padding: "0 10px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {saveError && !modalOpen && (
        <div className="ph-neg" style={{ fontSize: 11 }}>{saveError}</div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <Column
          title="Kalshi"
          markets={[...scan.kalshi_markets]
            .sort((a, b) => (b.yes_ask_dollars ?? 0) - (a.yes_ask_dollars ?? 0))
            .map((m) => ({
              id: m.ticker,
              title: m.title || m.ticker,
              sub: m.ticker,
              yes: m.yes_ask_dollars,
              no: m.no_ask_dollars,
              disabledReason: null,
            }))}
          selectedId={selKTicker}
          onPick={setSelKTicker}
        />
        <Column
          title="Polymarket"
          markets={[...scan.poly_markets]
            // Sort by tradeable ask, not last_price (avoid stale Gamma).
            .sort(
              (a, b) =>
                (b.yes_ask_dollars ?? b.yes_last_price ?? 0) -
                (a.yes_ask_dollars ?? a.yes_last_price ?? 0),
            )
            .map((m) => {
              const yes = m.yes_ask_dollars ?? m.yes_last_price;
              const no = m.no_ask_dollars ?? m.no_last_price;
              const spread = m.yes_spread_dollars ?? null;
              const wideSpread = spread != null && spread > 0.2;
              let disabled: string | null = null;
              if ((m.seconds_delay ?? 0) > 0) {
                disabled = `BLOCKED · ${m.seconds_delay}s live delay`;
              } else if (wideSpread) {
                disabled = `WIDE SPREAD · $${spread!.toFixed(2)} — thin book, prices unreliable`;
              }
              return {
                id: m.condition_id,
                title: m.group_item_title || m.question || m.condition_id,
                sub: (m.condition_id ?? "").slice(0, 14) + "…",
                yes,
                no,
                disabledReason: disabled,
              };
            })}
          selectedId={selPCondId}
          onPick={setSelPCondId}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          onClick={runPreflight}
          disabled={!ready || preflight.isPending}
        >
          {preflight.isPending ? "Checking…" : "Match →"}
        </Button>
      </div>

      <MatchConfirmModal
        open={modalOpen}
        loading={preflight.isPending}
        preflight={preflightResult}
        onConfirm={confirmSave}
        onCancel={() => setModalOpen(false)}
        saving={save.isPending}
        saveError={saveError}
      />
    </div>
  );
}

interface ColumnProps {
  title: string;
  markets: Array<{
    id: string;
    title: string;
    sub: string;
    yes?: number | null;
    no?: number | null;
    disabledReason?: string | null;
  }>;
  selectedId: string | null;
  onPick: (id: string) => void;
}

function Column({ title, markets, selectedId, onPick }: ColumnProps) {
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
      <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
        {markets.length === 0 && (
          <div className="ph-muted" style={{ fontSize: 11, padding: 8 }}>
            No markets
          </div>
        )}
        {markets.map((m) => {
          const blocked = Boolean(m.disabledReason);
          const isSel = m.id === selectedId;
          return (
            <div
              key={m.id}
              className={cn("ph-pick-card", isSel && "ph-selected")}
              style={
                blocked ? { opacity: 0.55, cursor: "not-allowed" } : undefined
              }
              onClick={() => {
                if (!blocked) onPick(m.id);
              }}
              title={m.disabledReason ?? undefined}
            >
              <div className="ph-pick-title">
                {m.title}
                {blocked && (
                  <span
                    className="ph-neg"
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      marginLeft: 6,
                      padding: "1px 5px",
                      border: "1px solid currentColor",
                      borderRadius: 3,
                    }}
                  >
                    {m.disabledReason}
                  </span>
                )}
                {isSel && !blocked && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#9f7aea",
                      fontWeight: 700,
                      marginLeft: 6,
                    }}
                  >
                    ✓ SELECTED
                  </span>
                )}
              </div>
              <div className="ph-pick-meta">
                <span className="ph-muted">{m.sub}</span>
                <span className="ph-muted">·</span>
                <span>YES {dollars(m.yes ?? null)}</span>
                <span className="ph-muted">·</span>
                <span>NO {dollars(m.no ?? null)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
