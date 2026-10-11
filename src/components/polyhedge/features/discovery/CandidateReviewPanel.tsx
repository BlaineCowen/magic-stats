"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/polyhedge/ui/Button";
import { ApproveButton } from "./ApproveButton";
import { CoveragePanel, EdgeSnapshot } from "./CoverageAndEdge";
import { FieldCompare } from "./FieldCompare";
import { FlagList } from "./FlagList";
import { HighlightedRules } from "./HighlightedRules";
import { RejectDialog } from "./RejectDialog";
import { fmtAgo } from "./format";
import { arbErrorMessage, useArbCandidate, useArbRecheck, useArbReopen } from "./hooks";

export function CandidateReviewPanel({
  id,
  onApproved,
}: {
  id: number;
  onApproved: (message: string) => void;
}) {
  const q = useArbCandidate(id);
  const recheck = useArbRecheck(id);
  const reopen = useArbReopen(id);
  const top = useRef<HTMLDivElement>(null);

  // The queue is long; bring the panel to the reader rather than the reverse.
  useEffect(() => {
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);

  if (q.isLoading) return <p className="ph-muted-2">Loading candidate…</p>;
  if (q.error || !q.data) return <p className="ph-neg">{arbErrorMessage(q.error)}</p>;

  const d = q.data;
  const k = d.snapshot.kalshi;
  const p = d.snapshot.poly;
  const serverTexts = d.highlights.kalshi_text != null && d.highlights.poly_text != null;
  const kText =
    d.highlights.kalshi_text ??
    [k.rules_primary, k.rules_secondary, k.early_close_condition].filter(Boolean).join("\n\n");
  const pText =
    d.highlights.poly_text ?? [p.description, p.resolution_source].filter(Boolean).join("\n\n");

  return (
    <div style={{ padding: "8px 12px" }} ref={top}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong>{d.kalshi_outcome_label}</strong>{" "}
          <span className="ph-muted-2">
            {d.series_ticker} · candidate #{d.id} · {d.status}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="ph-muted-2">
            Loaded {fmtAgo(d.last_viewed_at)} — text stays frozen while you review
          </span>
          <Button variant="ghost" disabled={recheck.isPending} onClick={() => recheck.mutate()}>
            {recheck.isPending ? "Rechecking…" : "Recheck live"}
          </Button>
        </div>
      </div>

      {d.status === "stale" && (
        <p className="ph-neg">
          STALE — the rules changed after approval, or live-event delay appeared. Promoted pairs{" "}
          {d.promoted_pair_ids.length > 0 ? d.promoted_pair_ids.join(", ") : "—"} must stay
          disarmed. Reopen to review again.
        </p>
      )}
      {d.rules_changed_since_review ? (
        <p className="ph-warn">Rules changed on a venue since this was last reviewed.</p>
      ) : null}
      {recheck.error && <p className="ph-neg">{arbErrorMessage(recheck.error)}</p>}
      {reopen.error && <p className="ph-neg">{arbErrorMessage(reopen.error)}</p>}

      <div className="ph-review-actions">
        {d.status === "pending" && <ApproveButton row={d} onApproved={onApproved} />}
        {(d.status === "pending" || d.status === "stale") && <RejectDialog id={d.id} />}
        {(d.status === "rejected" || d.status === "stale") && (
          <Button variant="ghost" disabled={reopen.isPending} onClick={() => reopen.mutate()}>
            Reopen for review
          </Button>
        )}
        <span className="ph-muted-2" style={{ fontSize: 11 }}>
          Approving jumps to the next ready outcome.
        </span>
      </div>

      <h4>Side by side</h4>
      <FieldCompare k={k} p={p} />

      <div className="ph-review-cols" style={{ marginTop: 12 }}>
        <div>
          <h4>
            Kalshi rules{" "}
            {k.event_url && (
              <a href={k.event_url} target="_blank" rel="noreferrer">
                ↗
              </a>
            )}
          </h4>
          <HighlightedRules text={kText} spans={serverTexts ? d.highlights.kalshi : []} />
        </div>
        <div>
          <h4>
            Polymarket description{" "}
            {p.event_url && (
              <a href={p.event_url} target="_blank" rel="noreferrer">
                ↗
              </a>
            )}
          </h4>
          <HighlightedRules text={pText} spans={serverTexts ? d.highlights.poly : []} />
        </div>
      </div>
      <p className="ph-muted-2" style={{ fontSize: 11 }}>
        Legend: <mark className="ph-hl-risk">risk term</mark>{" "}
        <mark className="ph-hl-risk ph-hl-onesided">only on one venue</mark>{" "}
        <mark className="ph-hl-date">date</mark> <mark className="ph-hl-num">time zone</mark>
      </p>

      <h4>Automated checks</h4>
      <FlagList flags={d.flags} />

      <div className="ph-review-cols" style={{ marginTop: 12 }}>
        <CoveragePanel coverage={d.coverage} />
        <EdgeSnapshot edge={d.edge} />
      </div>

      <details style={{ marginTop: 16 }}>
        <summary className="ph-muted-2">Audit trail ({d.audit.length})</summary>
        <table className="ph-compare">
          <tbody>
            {d.audit.map((a) => (
              <tr key={a.id}>
                <th>{a.ts}</th>
                <td>
                  {a.action} <span className="ph-muted-2">({a.actor})</span>
                </td>
                <td className="ph-muted-2">{JSON.stringify(a.detail)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
