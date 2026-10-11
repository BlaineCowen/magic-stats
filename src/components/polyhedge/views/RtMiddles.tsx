"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import { Section } from "@/components/polyhedge/ui/Section";
import {
  Table,
  TBody,
  THead,
  Tr,
  Td,
  EmptyRow,
} from "@/components/polyhedge/ui/Table";
import { SortHeader } from "@/components/polyhedge/ui/SortHeader";
import { Badge, SideBadge } from "@/components/polyhedge/ui/Badge";
import { PnLBadge } from "@/components/polyhedge/PnLBadge";
import {
  SummaryCard,
  SummaryGrid,
} from "@/components/polyhedge/SummaryCard";
import {
  combinedCostClass,
  fmt,
} from "@/lib/polyhedge/format";
import { cn } from "@/components/polyhedge/cn";
import { useTableSort } from "@/lib/polyhedge/useTableSort";
import type {
  RtBet,
  RtBetsResponse,
  RtMovie,
  RtOpportunity,
} from "@/lib/polyhedge/types";

export function RtMiddlesView() {
  const movies = useQuery<{ movies: RtMovie[] }>({
    queryKey: qk.rtMovies,
    queryFn: () => api.get("/api/rt-middles/movies"),
    refetchInterval: 60_000,
  });
  const live = useQuery<{ opportunities: RtOpportunity[] }>({
    queryKey: qk.rtLive,
    queryFn: () => api.get("/api/rt-middles/live"),
    refetchInterval: 15_000,
  });
  const bets = useQuery<RtBetsResponse>({
    queryKey: qk.rtBets,
    queryFn: () => api.get("/api/rt-middles/bets"),
    refetchInterval: 15_000,
  });

  const sum = bets.data?.summary ?? {};
  const out = bets.data?.outcomes ?? {};

  // Live Opportunities sort
  const liveData = live.data?.opportunities ?? [];
  const liveSort = useTableSort<RtOpportunity>(
    liveData,
    {
      title: (r) => r.title,
      k_leg: (r) => `${r.k_ticker} ${r.k_side} ${r.k_boundary}`,
      k_price: (r) => r.k_price,
      p_leg: (r) => `${r.p_side} ${r.p_boundary}`,
      p_price: (r) => r.p_price,
      combined: (r) => r.combined,
      floor: (r) => r.guaranteed_floor ?? null,
      bonus: (r) => r.bonus_zone_low ?? null,
      avail: (r) => r.max_contracts ?? null,
      profit: (r) => r.potential_profit_dollars ?? null,
    },
    { key: "floor", dir: "desc" },
  );

  // Bets sort
  const betsData = bets.data?.bets ?? [];
  const betsSort = useTableSort<RtBet>(
    betsData,
    {
      title: (r) => r.title ?? "",
      k_leg: (r) => `${r.k_ticker} ${r.k_side} ${r.k_boundary}`,
      p_leg: (r) => `${r.p_side} ${r.p_boundary}`,
      combined: (r) => r.combined_cost ?? null,
      floor: (r) => r.guaranteed_floor ?? null,
      contracts: (r) => r.contracts ?? null,
      mtm: (r) => r.current_mtm_dollars ?? null,
      bonus: (r) => r.bonus_zone_low ?? null,
      pnl: (r) => r.realized_pnl_dollars ?? null,
      status: (r) => r.status,
      detected_at: (r) => r.detected_at ?? "",
    },
    { key: "detected_at", dir: "desc" },
  );

  // Movies sort
  const moviesData = movies.data?.movies ?? [];
  const moviesSort = useTableSort<RtMovie>(
    moviesData,
    {
      title: (r) => r.title,
      kalshi_event_ticker: (r) => r.kalshi_event_ticker,
      poly_event_slug: (r) => r.poly_event_slug,
      k_buckets: (r) => r.k_buckets,
      p_buckets: (r) => r.p_buckets,
      discovered_at: (r) => r.discovered_at ?? "",
    },
    { key: "discovered_at", dir: "desc" },
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SummaryGrid>
        <SummaryCard label="Open" value={sum.open ?? 0} />
        <SummaryCard label="Settled" value={sum.settled ?? 0} />
        <SummaryCard
          label="Win rate"
          value={sum.win_rate != null ? sum.win_rate + "%" : "—"}
        />
        <SummaryCard
          label="Total PnL"
          value={fmt(sum.total_pnl ?? null)}
          valueClass={(sum.total_pnl ?? 0) >= 0 ? "ph-pos" : "ph-neg"}
          sub={
            sum.avg_pnl != null
              ? `avg ${fmt(sum.avg_pnl)} / bet`
              : undefined
          }
        />
      </SummaryGrid>

      {(sum.settled ?? 0) > 0 && (
        <div className="ph-text-2" style={{ fontSize: 11, padding: "0 4px" }}>
          <span className="ph-pos">Both won: {out.both_won ?? 0}</span>
          <span className="ph-muted"> | </span>
          <span className="ph-pos">K only: {out.k_only_won ?? 0}</span>
          <span className="ph-muted"> | </span>
          <span className="ph-pos">P only: {out.p_only_won ?? 0}</span>
          <span className="ph-muted"> | </span>
          <span className="ph-neg">Both lost: {out.both_lost ?? 0}</span>
        </div>
      )}

      <Section
        title={`Live Opportunities (${liveData.length} combos)`}
        variant="rt"
      >
        <Table>
          <THead>
            <Tr>
              <SortHeader {...liveSort.bind("title")}>Movie</SortHeader>
              <SortHeader {...liveSort.bind("k_leg")}>K leg</SortHeader>
              <SortHeader {...liveSort.bind("k_price")}>K $</SortHeader>
              <SortHeader {...liveSort.bind("p_leg")}>P leg</SortHeader>
              <SortHeader {...liveSort.bind("p_price")}>P $</SortHeader>
              <SortHeader {...liveSort.bind("combined")}>Combined</SortHeader>
              <SortHeader {...liveSort.bind("floor")}>Floor</SortHeader>
              <SortHeader {...liveSort.bind("bonus")}>Bonus zone</SortHeader>
              <SortHeader {...liveSort.bind("avail")}>Avail</SortHeader>
              <SortHeader {...liveSort.bind("profit")}>Profit</SortHeader>
            </Tr>
          </THead>
          <TBody>
            {liveSort.rows.length === 0 ? (
              <EmptyRow colSpan={10}>
                No price data yet — waiting for WebSocket ticks
              </EmptyRow>
            ) : (
              liveSort.rows.map((o, i) => (
                <LiveRow key={o.title + i} o={o} />
              ))
            )}
          </TBody>
        </Table>
      </Section>

      <Section title="Open & Recent Bets" variant="rt">
        <Table>
          <THead>
            <Tr>
              <SortHeader {...betsSort.bind("title")}>Title</SortHeader>
              <SortHeader {...betsSort.bind("k_leg")}>K leg</SortHeader>
              <SortHeader {...betsSort.bind("p_leg")}>P leg</SortHeader>
              <SortHeader {...betsSort.bind("combined")}>Combined</SortHeader>
              <SortHeader {...betsSort.bind("floor")}>Floor</SortHeader>
              <SortHeader {...betsSort.bind("contracts")}>Contracts</SortHeader>
              <SortHeader {...betsSort.bind("mtm")}>MTM</SortHeader>
              <SortHeader {...betsSort.bind("bonus")}>Bonus</SortHeader>
              <SortHeader {...betsSort.bind("pnl")}>PnL</SortHeader>
              <SortHeader {...betsSort.bind("status")}>Status</SortHeader>
              <SortHeader {...betsSort.bind("detected_at")}>Detected</SortHeader>
            </Tr>
          </THead>
          <TBody>
            {betsSort.rows.length === 0 ? (
              <EmptyRow colSpan={11}>No paper bets yet</EmptyRow>
            ) : (
              betsSort.rows.map((b) => <BetRow key={b.id} b={b} />)
            )}
          </TBody>
        </Table>
      </Section>

      <Section
        title={`Discovered Movies (${moviesData.length})`}
        variant="rt"
        defaultCollapsed
      >
        <Table>
          <THead>
            <Tr>
              <SortHeader {...moviesSort.bind("title")}>Title</SortHeader>
              <SortHeader {...moviesSort.bind("kalshi_event_ticker")}>
                Kalshi event
              </SortHeader>
              <SortHeader {...moviesSort.bind("poly_event_slug")}>
                Poly slug
              </SortHeader>
              <SortHeader {...moviesSort.bind("k_buckets")}>K buckets</SortHeader>
              <SortHeader {...moviesSort.bind("p_buckets")}>P buckets</SortHeader>
              <SortHeader {...moviesSort.bind("discovered_at")}>
                Discovered
              </SortHeader>
            </Tr>
          </THead>
          <TBody>
            {moviesSort.rows.length === 0 ? (
              <EmptyRow colSpan={6}>
                No movies matched yet — engine runs discovery on startup then
                every 24h
              </EmptyRow>
            ) : (
              moviesSort.rows.map((m, i) => (
                <Tr key={m.title + i}>
                  <Td>
                    <strong>{m.title}</strong>
                  </Td>
                  <Td className="ph-muted" style={{ fontSize: 10 }}>
                    {m.kalshi_event_ticker}
                  </Td>
                  <Td className="ph-muted" style={{ fontSize: 10 }}>
                    {m.poly_event_slug}
                  </Td>
                  <Td style={{ textAlign: "center" }}>{m.k_buckets}</Td>
                  <Td style={{ textAlign: "center" }}>{m.p_buckets}</Td>
                  <Td className="ph-muted" style={{ fontSize: 10 }}>
                    {(m.discovered_at ?? "").slice(0, 10)}
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

function LiveRow({ o }: { o: RtOpportunity }) {
  const isGuaranteed = o.is_guaranteed === true;
  const floor = o.guaranteed_floor ?? null;
  const profitable = floor != null && floor > 0;
  const close = floor != null && floor >= -0.05;
  const bonus =
    o.bonus_zone_low != null
      ? `${o.bonus_zone_low}–${o.bonus_zone_high}`
      : "—";
  return (
    <Tr className={cn(profitable && "ph-row-profit")}>
      <Td>
        <strong>{o.title}</strong>
      </Td>
      <Td style={{ fontSize: 10 }}>
        {o.k_ticker} <SideBadge side={o.k_side} /> &gt;{o.k_boundary}
      </Td>
      <Td>{o.k_price.toFixed(3)}</Td>
      <Td style={{ fontSize: 10 }}>
        <SideBadge side={o.p_side} /> {o.p_boundary}+
      </Td>
      <Td>{o.p_price.toFixed(3)}</Td>
      <Td className={isGuaranteed ? combinedCostClass(o.combined) : "ph-muted"}>
        {o.combined.toFixed(3)}
      </Td>
      <Td>
        {!isGuaranteed ? (
          <span
            className="ph-muted"
            title="Not a valid middle: gap exists where neither leg wins"
          >
            no coverage
          </span>
        ) : profitable ? (
          <span className="ph-pos" style={{ fontWeight: 700 }}>
            +{(floor! * 100).toFixed(1)}¢ ✓
          </span>
        ) : close ? (
          <span className="ph-warn">{(floor! * 100).toFixed(1)}¢</span>
        ) : (
          <span className="ph-muted">{(floor! * 100).toFixed(1)}¢</span>
        )}
      </Td>
      <Td className="ph-muted">{bonus}</Td>
      <Td style={{ textAlign: "center" }}>{o.max_contracts ?? "—"}</Td>
      <Td>
        {o.potential_profit_dollars != null ? (
          <span className="ph-pos" style={{ fontWeight: 600 }}>
            ${o.potential_profit_dollars.toFixed(2)}
          </span>
        ) : (
          "—"
        )}
      </Td>
    </Tr>
  );
}

function BetRow({ b }: { b: RtBet }) {
  const isVoided = b.status === "voided";
  const isSettled = b.status === "settled";
  const bonus =
    b.bonus_zone_low != null
      ? `${b.bonus_zone_low}–${b.bonus_zone_high}`
      : "—";

  let mtm: React.ReactNode = "—";
  if (!isVoided && !isSettled && b.current_mtm_dollars != null) {
    const mtmD = b.current_mtm_dollars;
    const col =
      mtmD > 0 ? "ph-pos" : mtmD > -0.1 ? "ph-warn" : "ph-neg";
    const pctSuffix =
      b.current_mtm_pct != null
        ? ` (${b.current_mtm_pct >= 0 ? "+" : ""}${b.current_mtm_pct.toFixed(1)}%)`
        : "";
    mtm = (
      <span className={col} style={{ fontWeight: 600 }}>
        {mtmD >= 0 ? "+" : ""}
        {mtmD.toFixed(2)}
        {pctSuffix}
      </span>
    );
  }

  let outcome: React.ReactNode = "—";
  if (isSettled) {
    outcome = (
      <>
        K:<LegResult r={b.k_result} /> P:<LegResult r={b.p_result} />
      </>
    );
  } else if (!isVoided) {
    outcome = <span className="ph-muted">open</span>;
  }

  const floorStr = isVoided ? (
    <span className="ph-muted" title="No coverage — voided">
      invalid
    </span>
  ) : (
    <span className="ph-pos">
      +{((b.guaranteed_floor ?? 0) * 100).toFixed(1)}¢
    </span>
  );

  return (
    <Tr style={isVoided ? { opacity: 0.5 } : undefined}>
      <Td>{b.title || ""}</Td>
      <Td style={{ fontSize: 10 }}>
        {b.k_ticker} {b.k_side}&gt;{b.k_boundary}
      </Td>
      <Td style={{ fontSize: 10 }}>
        {b.p_side} {b.p_boundary}+
      </Td>
      <Td>{(b.combined_cost ?? 0).toFixed(3)}</Td>
      <Td>{floorStr}</Td>
      <Td style={{ textAlign: "center" }}>{b.contracts ?? 1}</Td>
      <Td>{mtm}</Td>
      <Td className="ph-muted">{bonus}</Td>
      <Td>
        <PnLBadge value={b.realized_pnl_dollars ?? null} />
      </Td>
      <Td>
        <Badge>{b.status}</Badge>
      </Td>
      <Td className="ph-muted" style={{ fontSize: 10 }}>
        {(b.detected_at ?? "").slice(0, 16)}
      </Td>
    </Tr>
  );
}

function LegResult({ r }: { r?: string }) {
  if (r === "won") return <span className="ph-pos">✓</span>;
  if (r === "lost") return <span className="ph-neg">✗</span>;
  return <span className="ph-warn">?</span>;
}
