import type { ArbCoverage, ArbEdge } from "@/lib/polyhedge/types";
import { fmtPct } from "./format";

export function CoveragePanel({ coverage }: { coverage: ArbCoverage }) {
  const uk = coverage.unmatched_kalshi ?? [];
  const up = coverage.unmatched_poly ?? [];
  const other = coverage.poly_other ?? [];
  return (
    <div>
      <h4>Outcome coverage (whole event)</h4>
      {uk.length === 0 && up.length === 0 ? (
        <p className="ph-pos">Every outcome has a counterpart on the other venue.</p>
      ) : (
        <>
          <p className="ph-warn">Kalshi-only: {uk.length > 0 ? uk.join(", ") : "none"}</p>
          <p className="ph-warn">Polymarket-only: {up.length > 0 ? up.join(", ") : "none"}</p>
        </>
      )}
      {other.length > 0 && (
        <p className="ph-muted-2">Never paired (residual buckets): {other.join(", ")}</p>
      )}
    </div>
  );
}

export function EdgeSnapshot({ edge }: { edge: ArbEdge }) {
  return (
    <div>
      <h4>Edge snapshot (at scan time, after Kalshi fees)</h4>
      {edge.error ? (
        <p className="ph-neg">Edge unavailable: {edge.error}</p>
      ) : edge.contracts == null ? (
        <p className="ph-muted-2">Not computed (blocked, or top of book above $1.02).</p>
      ) : (
        <p>
          {edge.best_direction ?? "no direction"} · {edge.contracts} contracts · ROI{" "}
          {fmtPct(edge.roi_pct)}
          <span className="ph-muted-2"> — Polymarket fees not included</span>
        </p>
      )}
    </div>
  );
}
