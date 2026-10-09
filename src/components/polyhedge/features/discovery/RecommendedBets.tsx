"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import { Button } from "@/components/polyhedge/ui/Button";
import { Dialog, DialogClose, DialogContent } from "@/components/polyhedge/ui/Dialog";

interface Rec {
  pair: string;
  k: string;
  k_label: string;
  p_slug: string;
  p_label: string;
  direction: "K-YES + P-NO" | "K-NO + P-YES";
  k_px: number;
  p_px: number;
  cost: number;
  edge: number;
  contracts: number;
  profit: number;
  locked_days: number | null;
  per_year: number | null;
  open_s: number;
  confirmed: boolean;
  k_resolves: string | null;
  warns: string[];
  candidate_id: number | null;
  candidate_status: string | null;
  note: { verdict?: string; note?: string } | null;
}

interface RecResponse {
  rows: Rec[];
  stale: boolean;
  as_of: number | null;
  age_s?: number;
}

interface PlaceRow {
  id: number;
  created_at: number;
  candidate_id: number;
  direction: string;
  contracts_req: number;
  quoted_cost: number;
  status: "pending" | "running" | "filled" | "refused" | "failed" | "rolled_back" | "expired";
  message: string | null;
  contracts_filled: number | null;
  total_cost: number | null;
  bet_id: number | null;
  source: "click" | "auto" | null;
}

interface PlaceStatus {
  rows: PlaceRow[];
  per_click: number;
  per_day: number;
  spent_24h: number;
  left_24h: number;
  tolerance: number;
  auto: {
    enabled: boolean;
    min_profit: number;
    min_per_year: number;
    min_edge: number;
    max_edge: number;
    pair_cap: number;
  };
}

const WARN_TEXT: Record<string, string> = {
  KALSHI_RESOLVES_LATER: "Kalshi pays out later",
  OFFICIAL_RESULT_TIMING_DIFFERS: "result timing differs",
  RESOLUTION_SOURCE_DIFFERS: "different result source",
  TIE_RULE_DIFFERS: "tie rule differs",
  CANCELLATION_RULE_DIFFERS: "cancellation rule differs",
  THIN_BOOK: "thin book",
};

const STATUS_TEXT: Record<PlaceRow["status"], string> = {
  pending: "Waiting for the engine…",
  running: "Placing…",
  filled: "Placed",
  refused: "Not placed",
  failed: "Failed",
  rolled_back: "Undone",
  expired: "Expired",
};

const placeKey = ["ph", "arb", "place"] as const;
const c = (p: number) => `${(p * 100).toFixed(1).replace(/\.0$/, "")}¢`;
const usd = (x: number) => `$${x.toFixed(2)}`;
const day = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : "—";
const sides = (r: Rec) =>
  r.direction === "K-YES + P-NO" ? { k: "YES", p: "NO" } : { k: "NO", p: "YES" };
const inFlight = (s: PlaceRow["status"]) => s === "pending" || s === "running";

/** Rules-vetting verdict: "ok" pairs are the only ones auto-betting will touch. */
function VerdictTag({ v }: { v?: string }) {
  return v === "ok" ? (
    <span className="ph-pos" style={{ fontWeight: 700 }}>vetted ✓</span>
  ) : (
    <span className="ph-warn">{v ?? "note"}:</span>
  );
}

/** Auto-betting status line with a pause / resume switch. */
function AutoBar({ st }: { st: PlaceStatus }) {
  const qc = useQueryClient();
  const a = st.auto;
  const m = useMutation({
    mutationFn: (enabled: boolean) => api.post("/api/arb-recommended/auto", { enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: placeKey }),
  });
  return (
    <div className={`rb-auto ${a.enabled ? "rb-auto-on" : ""}`}>
      <div>
        <strong className={a.enabled ? "ph-pos" : "ph-warn"}>
          Auto-betting {a.enabled ? "ON" : "PAUSED"}
        </strong>
        <div className="ph-muted-2">
          Bets by itself only on vetted pairs (rules read side by side and marked OK), when a gap is
          confirmed and makes at least {usd(a.min_profit)}, {(a.min_per_year * 100).toFixed(0)}% a year and{" "}
          {c(a.min_edge)}–{c(a.max_edge)} per $1. At most {usd(a.pair_cap)} per pair, within the limits above.
          Everything else is shown for you to check and click.
        </div>
      </div>
      <Button
        type="button"
        variant={a.enabled ? "ghost" : "primary"}
        disabled={m.isPending}
        onClick={() => m.mutate(!a.enabled)}
      >
        {a.enabled ? "Pause" : "Resume"}
      </Button>
    </div>
  );
}

function usePlaceStatus(fast: boolean) {
  return useQuery<PlaceStatus>({
    queryKey: placeKey,
    queryFn: () => api.get<PlaceStatus>("/api/arb-recommended/place"),
    refetchInterval: fast ? 1500 : 15_000,
  });
}

/** Confirm dialog: pick a size within the limits, then queue it and follow it to the end. */
function PlaceDialog({ r, limits, onClose }: { r: Rec; limits: PlaceStatus; onClose: () => void }) {
  const qc = useQueryClient();
  const worstPer = r.cost + limits.tolerance;
  const maxN = Math.max(
    0,
    Math.min(
      Math.floor(r.contracts),
      Math.floor(limits.per_click / worstPer),
      Math.floor(limits.left_24h / worstPer),
    ),
  );
  const [n, setN] = useState(maxN);
  const [reqId, setReqId] = useState<number | null>(null);
  const status = usePlaceStatus(reqId != null);
  const mine = status.data?.rows.find((x) => x.id === reqId);
  const done = mine != null && !inFlight(mine.status);
  useEffect(() => {
    if (done) void qc.invalidateQueries({ queryKey: qk.arbRecommended });
  }, [done, qc]);
  const m = useMutation({
    mutationFn: () =>
      api.post<{ id: number }>("/api/arb-recommended/place", {
        candidate_id: r.candidate_id,
        direction: r.direction,
        contracts: n,
        quoted_cost: r.cost,
      }),
    onSuccess: (d) => {
      setReqId(d.id);
      void qc.invalidateQueries({ queryKey: placeKey });
    },
  });
  const s = sides(r);
  const valid = Number.isInteger(n) && n >= 1 && n <= maxN;
  const errText = m.error ? m.error.message.replace(/^\{"detail":"|"\}$/g, "") : null;

  return (
    <DialogContent
      title="Place this bet with real money"
      description="Both legs are bought at once. If Polymarket does not fill, the Kalshi leg is sold back."
    >
      <div className="rb-legs">
        <div>
          <span className="rb-venue">Kalshi</span> buy <strong>{s.k}</strong> {r.k_label} @ {c(r.k_px)}
        </div>
        <div>
          <span className="rb-venue">Polymarket</span> buy <strong>{s.p}</strong> {r.p_label} @ {c(r.p_px)}
        </div>
      </div>

      {reqId == null ? (
        <>
          <label className="rb-field">
            <span>Contracts (max {maxN})</span>
            <input
              className="ph-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxN}
              value={Number.isNaN(n) ? "" : n}
              onChange={(e) => setN(parseInt(e.target.value, 10))}
            />
          </label>
          <dl className="rb-dl">
            <dt>Cost now</dt>
            <dd>{valid ? usd(n * r.cost) : "—"} <span className="ph-muted-2">({c(r.cost)} each, fees in)</span></dd>
            <dt>At most</dt>
            <dd>{valid ? usd(n * worstPer) : "—"} <span className="ph-muted-2">(refused above {c(worstPer)} each)</span></dd>
            <dt>Pays back</dt>
            <dd>{valid ? usd(n) : "—"} on {day(r.k_resolves)}</dd>
            <dt>Profit</dt>
            <dd className="ph-pos">{valid ? usd(n * r.edge) : "—"}</dd>
            <dt>Limits</dt>
            <dd className="ph-muted-2">
              {usd(limits.per_click)} a bet · {usd(limits.left_24h)} of {usd(limits.per_day)} left today
            </dd>
          </dl>
          {r.note?.note && (
            <p className="rb-note">
              <VerdictTag v={r.note.verdict} /> {r.note.note}
            </p>
          )}
          {maxN < 1 && <p className="ph-neg">Not enough of today&apos;s limit left for one contract.</p>}
          {errText && <p className="ph-neg">{errText}</p>}
          <div className="rb-actions">
            <DialogClose asChild>
              <Button variant="ghost" type="button">Cancel</Button>
            </DialogClose>
            <Button type="button" disabled={!valid || m.isPending} onClick={() => m.mutate()}>
              {m.isPending ? "Sending…" : valid ? `Buy ${n} for ${usd(n * r.cost)}` : "Buy"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={`rb-result ${mine?.status === "filled" ? "ph-pos" : done ? "ph-neg" : ""}`}>
            <strong>{mine ? STATUS_TEXT[mine.status] : "Queued…"}</strong>
            {mine?.message ? ` — ${mine.message}` : ""}
          </p>
          {mine?.status === "filled" && mine.total_cost != null && (
            <p>
              {mine.contracts_filled} contracts for {usd(mine.total_cost)}; pays {usd(mine.contracts_filled ?? 0)}.
            </p>
          )}
          <div className="rb-actions">
            <Button type="button" variant={done ? "primary" : "ghost"} onClick={onClose}>
              {done ? "Done" : "Close (keeps running)"}
            </Button>
          </div>
        </>
      )}
    </DialogContent>
  );
}

function Card({ r, onPlace, onReview, canPlace }: {
  r: Rec;
  onPlace: () => void;
  onReview: () => void;
  canPlace: boolean;
}) {
  const s = sides(r);
  return (
    <div className="rb-card">
      <div className="rb-top">
        <span className="rb-profit ph-pos">{usd(r.profit)}</span>
        <span className="ph-muted-2">
          {r.per_year != null ? `${(r.per_year * 100).toFixed(0)}% a year` : ""} · back {day(r.k_resolves)}
        </span>
      </div>
      <div className="rb-legs">
        <div>
          <span className="rb-venue">Kalshi</span> <strong>{s.k}</strong> {r.k_label} @ {c(r.k_px)}
        </div>
        <div>
          <span className="rb-venue">Polymarket</span> <strong>{s.p}</strong> {r.p_label} @ {c(r.p_px)}
        </div>
      </div>
      <div className="rb-meta">
        {c(r.cost)} per $1 (+{c(r.edge)}) · {Math.round(r.contracts)} contracts available
      </div>
      {(Boolean(r.note?.note) || r.warns.length > 0) && (
        <div className="rb-note">
          {r.note?.note && (
            <div>
              <VerdictTag v={r.note.verdict} /> {r.note.note}
            </div>
          )}
          {r.warns.length > 0 && (
            <div className="ph-muted-2">{r.warns.map((w) => WARN_TEXT[w] ?? w).join(" · ")}</div>
          )}
        </div>
      )}
      <div className="rb-actions">
        {r.candidate_id != null ? (
          <>
            <Button type="button" variant="ghost" onClick={onReview}>
              {r.candidate_status === "approved" ? "Rules ✓" : "Check rules"}
            </Button>
            <Button type="button" disabled={!canPlace} onClick={onPlace}>Place bet</Button>
          </>
        ) : (
          <span className="ph-muted-2">Not in the Discovery queue yet, so it can&apos;t be placed here.</span>
        )}
      </div>
      <div className="ph-muted" style={{ fontSize: 10, wordBreak: "break-all" }}>
        {r.k} · {r.p_slug}
      </div>
    </div>
  );
}

export function RecommendedBets({ onReview }: { onReview: (id: number) => void }) {
  const q = useQuery<RecResponse>({
    queryKey: qk.arbRecommended,
    queryFn: () => api.get<RecResponse>("/api/arb-recommended"),
    refetchInterval: 15_000,
  });
  const [placing, setPlacing] = useState<Rec | null>(null);
  const status = usePlaceStatus(false);
  const rows = q.data?.rows ?? [];
  const busy = status.data?.rows.some((x) => inFlight(x.status)) ?? false;
  const recent = (status.data?.rows ?? []).slice(0, 5);

  return (
    <div className="rb-wrap">
      <p className="ph-muted-2 rb-intro">
        Live gaps between Kalshi and Polymarket after both venues&apos; fees: buying both legs costs less than
        the $1 one of them pays. At least $5 profit and 30% a year.{" "}
        {q.data?.stale ? (
          <span className="ph-neg">Data is stale — the election watcher may be down.</span>
        ) : (
          q.data?.age_s != null && <span>Updated {Math.round(q.data.age_s)} s ago.</span>
        )}
        {status.data && (
          <span>
            {" "}
            Limits: {usd(status.data.per_click)} a bet, {usd(status.data.left_24h)} of{" "}
            {usd(status.data.per_day)} left today.
          </span>
        )}
      </p>
      {status.data?.auto && <AutoBar st={status.data} />}
      {q.isLoading && <p className="ph-muted-2">Loading…</p>}
      {!q.isLoading && rows.length === 0 && <p className="ph-muted-2">No gaps worth taking right now.</p>}
      <div className="rb-grid">
        {rows.map((r) => (
          <Card
            key={r.pair}
            r={r}
            canPlace={!busy && status.data != null}
            onPlace={() => setPlacing(r)}
            onReview={() => onReview(r.candidate_id!)}
          />
        ))}
      </div>
      {recent.length > 0 && (
        <div className="rb-recent">
          <div className="ph-muted-2">Recent bets</div>
          {recent.map((x) => (
            <div key={x.id} className="rb-recent-row">
              <span className={x.status === "filled" ? "ph-pos" : inFlight(x.status) ? "ph-warn" : "ph-neg"}>
                {STATUS_TEXT[x.status]}
              </span>{" "}
              {x.source === "auto" && <span className="ph-badge ph-badge-warn">auto</span>}{" "}
              <span className="ph-muted-2">
                {new Date(x.created_at * 1000).toLocaleString([], {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </span>{" "}
              {x.message}
            </div>
          ))}
        </div>
      )}
      <Dialog open={placing != null} onOpenChange={(o) => !o && setPlacing(null)}>
        {placing && status.data && (
          <PlaceDialog r={placing} limits={status.data} onClose={() => setPlacing(null)} />
        )}
      </Dialog>
    </div>
  );
}
