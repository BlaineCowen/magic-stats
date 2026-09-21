"use client";

import { useMemo, useState } from "react";
import { Section } from "@/components/polyhedge/ui/Section";
import { CandidateFilters } from "@/components/polyhedge/features/discovery/CandidateFilters";
import { CandidateQueueTable } from "@/components/polyhedge/features/discovery/CandidateQueueTable";
import { CandidateReviewPanel } from "@/components/polyhedge/features/discovery/CandidateReviewPanel";
import { fmtAgo } from "@/components/polyhedge/features/discovery/format";
import {
  arbErrorMessage,
  useArbCandidates,
  useArbSummary,
} from "@/components/polyhedge/features/discovery/hooks";
import type { ArbFilters, ArbSummary } from "@/lib/polyhedge/types";

function SummaryStrip({ s }: { s: ArbSummary | undefined }) {
  if (!s) return null;
  const run = s.last_run;
  return (
    <span>
      {s.counts.pending} pending ·{" "}
      <span className={s.counts.stale > 0 ? "ph-neg" : undefined}>{s.counts.stale} stale</span> ·
      approvals {s.approvals_today}/{s.max_approvals_per_day}
      {!s.approvals_enabled && <span className="ph-neg"> (DISABLED)</span>} · mode{" "}
      {s.promote_mode} · last scan {run?.finished_at ? fmtAgo(run.finished_at) : "never"}
      {run && !run.complete ? <span className="ph-warn"> (incomplete)</span> : null}
    </span>
  );
}

export function DiscoveryView() {
  const [filters, setFilters] = useState<ArbFilters>({
    status: "pending",
    series: "",
    hideBlocked: true,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const summary = useArbSummary();
  const list = useArbCandidates(filters);
  const rows = useMemo(() => list.data?.candidates ?? [], [list.data]);
  // After approving in the panel, jump to the next ready outcome in the list.
  function advance(message: string) {
    setNotice(message);
    const at = rows.findIndex((r) => r.id === selected);
    const next = rows.slice(at + 1).find((r) => r.status === "pending" && !r.block_count);
    setSelected(next?.id ?? null);
  }
  const seriesOptions = useMemo(
    () => [...new Set(rows.map((r) => r.series_ticker))].sort(),
    [rows],
  );

  return (
    <>
      {selected != null && (
        <Section title={`Review candidate #${selected}`} collapsible={false}>
          <CandidateReviewPanel key={selected} id={selected} onApproved={advance} />
        </Section>
      )}
      <Section
        title="Discovery — proposed Kalshi ↔ Polymarket pairs"
        right={<SummaryStrip s={summary.data} />}
        collapsible={false}
      >
        <p className="ph-muted-2" style={{ padding: "0 12px", fontSize: 11 }}>
          The scanner only proposes. Approving creates two <strong>disarmed</strong> pairs that
          collect paper bets; arming for real money stays a separate step in Manual Arbs.
          Blocked candidates (live delay, event started, already paired…) can’t be approved.
        </p>
        {notice && (
          <p className="ph-pos" style={{ padding: "0 12px" }}>
            {notice}
          </p>
        )}
        <CandidateFilters value={filters} onChange={setFilters} seriesOptions={seriesOptions} />
        {list.error && <p className="ph-neg">{arbErrorMessage(list.error)}</p>}
        <CandidateQueueTable rows={rows} selectedId={selected} onSelect={setSelected} />
      </Section>
    </>
  );
}
