"use client";

import { Button } from "@/components/polyhedge/ui/Button";
import type { ArbCandidateRow } from "@/lib/polyhedge/types";
import { arbErrorMessage, useArbApprove } from "./hooks";

type Approvable = Pick<
  ArbCandidateRow,
  "id" | "rules_hash" | "check_version" | "block_count" | "status"
>;

/**
 * One click, no typing. Safe because the result is two DISARMED pairs (paper
 * only) and the server still re-fetches both venues live and refuses on any
 * blocking problem or if the rules changed since this row was loaded.
 */
export function ApproveButton({
  row,
  compact = false,
  onApproved,
}: {
  row: Approvable;
  compact?: boolean;
  onApproved?: (message: string) => void;
}) {
  const approve = useArbApprove(row.id);
  const ready = row.status === "pending" && !row.block_count;
  const error = approve.error ? arbErrorMessage(approve.error) : null;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <Button
        variant={compact ? "toggle" : "primary"}
        disabled={!ready || approve.isPending || approve.isSuccess}
        title={ready ? "Create 2 disarmed pairs (paper only)" : "Blocked or not pending"}
        onClick={(e) => {
          e.stopPropagation();
          approve.mutate(
            { rules_hash: row.rules_hash, check_version: row.check_version, note: "" },
            {
              onSuccess: (r) =>
                onApproved?.(
                  r.pair_ids.length > 0
                    ? `Approved #${row.id}: disarmed pairs ${r.pair_ids.join(", ")}.`
                    : `Approved #${row.id} (verify only).`,
                ),
            },
          );
        }}
      >
        {approve.isPending ? "…" : approve.isSuccess ? "✓" : compact ? "Approve" : "Approve (disarmed)"}
      </Button>
      {error && (
        <span className="ph-neg" title={error} style={{ fontSize: 11 }}>
          {compact ? "refused" : error}
        </span>
      )}
    </span>
  );
}
