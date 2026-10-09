"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import {
  Table,
  TBody,
  Th,
  THead,
  Tr,
  Td,
  EmptyRow,
} from "@/components/polyhedge/ui/Table";

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

const WARN_TEXT: Record<string, string> = {
  KALSHI_RESOLVES_LATER: "Kalshi pays out later",
  OFFICIAL_RESULT_TIMING_DIFFERS: "result timing differs",
  RESOLUTION_SOURCE_DIFFERS: "different result source",
  TIE_RULE_DIFFERS: "tie rule differs",
  CANCELLATION_RULE_DIFFERS: "cancellation rule differs",
  THIN_BOOK: "thin book",
};

const c = (p: number) => `${(p * 100).toFixed(1).replace(/\.0$/, "")}¢`;
const day = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export function RecommendedBets({
  onReview,
}: {
  onReview: (id: number) => void;
}) {
  const q = useQuery<RecResponse>({
    queryKey: qk.arbRecommended,
    queryFn: () => api.get<RecResponse>("/api/arb-recommended"),
    refetchInterval: 15_000,
  });
  const rows = q.data?.rows ?? [];
  return (
    <div style={{ padding: "0 12px 12px" }}>
      <p className="ph-muted-2" style={{ fontSize: 11, margin: "4px 0 8px" }}>
        Live gaps between Kalshi and Polymarket right now, after both
        venues&apos; fees: buying both legs costs less than the $1 one of them
        pays. Ranked by return per year for the time the money is locked. At
        least $1 profit and 10% a year.{" "}
        {q.data?.stale ? (
          <span className="ph-neg">
            Data is stale — the election watcher may be down.
          </span>
        ) : (
          q.data?.age_s != null && (
            <span>Updated {Math.round(q.data.age_s)} s ago.</span>
          )
        )}
      </p>
      <div style={{ overflowX: "auto" }}>
        <Table>
          <THead>
            <Tr>
              <Th>Buy both</Th>
              <Th>Cost / $1</Th>
              <Th>Contracts</Th>
              <Th>Profit</Th>
              <Th>Money back</Th>
              <Th>Per year</Th>
              <Th>Watch out for</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {q.isLoading && <EmptyRow colSpan={8}>Loading…</EmptyRow>}
            {!q.isLoading && rows.length === 0 && (
              <EmptyRow colSpan={8}>No gaps worth taking right now.</EmptyRow>
            )}
            {rows.map((r) => {
              const kSide = r.direction === "K-YES + P-NO" ? "YES" : "NO";
              const pSide = r.direction === "K-YES + P-NO" ? "NO" : "YES";
              return (
                <Tr key={r.pair}>
                  <Td>
                    <div>
                      Kalshi <strong>{kSide}</strong> {r.k_label} @ {c(r.k_px)}
                    </div>
                    <div className="ph-muted-2">
                      Polymarket <strong>{pSide}</strong> {r.p_label} @{" "}
                      {c(r.p_px)}
                    </div>
                    <div className="ph-muted" style={{ fontSize: 10 }}>
                      {r.k} · {r.p_slug}
                    </div>
                  </Td>
                  <Td>
                    {c(r.cost)} <span className="ph-pos">(+{c(r.edge)})</span>
                  </Td>
                  <Td>{Math.round(r.contracts)}</Td>
                  <Td className="ph-pos" style={{ fontWeight: 700 }}>
                    ${r.profit.toFixed(2)}
                  </Td>
                  <Td>{day(r.k_resolves)}</Td>
                  <Td>
                    {r.per_year != null
                      ? `${(r.per_year * 100).toFixed(0)}%`
                      : "—"}
                  </Td>
                  <Td style={{ maxWidth: 360, fontSize: 11 }}>
                    {r.note?.note && (
                      <div>
                        <span className="ph-warn">
                          {r.note.verdict ?? "note"}:
                        </span>{" "}
                        {r.note.note}
                      </div>
                    )}
                    {r.warns.length > 0 && (
                      <div className="ph-muted-2">
                        {r.warns.map((w) => WARN_TEXT[w] ?? w).join(" · ")}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {r.candidate_id != null ? (
                      <button
                        type="button"
                        className="ph-chip"
                        onClick={() => onReview(r.candidate_id!)}
                      >
                        {r.candidate_status === "approved"
                          ? "Approved · view"
                          : "Review"}
                      </button>
                    ) : (
                      <span className="ph-muted-2">not in queue</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
