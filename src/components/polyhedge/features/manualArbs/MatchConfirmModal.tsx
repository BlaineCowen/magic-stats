"use client";

import { Dialog, DialogContent } from "@/components/polyhedge/ui/Dialog";
import { Button } from "@/components/polyhedge/ui/Button";
import type { ManualArbPreflightResponse } from "@/lib/polyhedge/types";

interface Props {
  open: boolean;
  loading: boolean;
  preflight: ManualArbPreflightResponse | null;
  onConfirm: () => void;
  onCancel: () => void;
  saving?: boolean;
  saveError?: string | null;
}

export function MatchConfirmModal({
  open,
  loading,
  preflight,
  onConfirm,
  onCancel,
  saving,
  saveError,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent title="Confirm match">
        {loading && (
          <div style={{ padding: 16, fontSize: 12 }} className="ph-muted">
            Validating match…
          </div>
        )}
        {!loading && preflight && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, minWidth: 480 }}>
            {preflight.blocked ? (
              <div className="ph-neg" style={{ fontSize: 12, fontWeight: 600 }}>
                ❌ Cannot create pair: {preflight.block_reason}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, display: "grid", gridTemplateColumns: "auto 1fr", gap: 4 }}>
                  <span className="ph-muted">K-YES + P-NO:</span>
                  <span>${preflight.combined_k_yes_p_no?.toFixed(3) ?? "—"}</span>
                  <span className="ph-muted">K-NO + P-YES:</span>
                  <span>${preflight.combined_k_no_p_yes?.toFixed(3) ?? "—"}</span>
                </div>

                {preflight.warn && (
                  <>
                    <div className="ph-warn-strong" style={{ fontSize: 12, fontWeight: 600 }}>
                      ⚠ {preflight.warn_reason}
                    </div>
                    <div style={{ fontSize: 11, borderTop: "1px solid #2d3748", paddingTop: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        Kalshi — {preflight.kalshi.ticker}
                      </div>
                      <div className="ph-muted" style={{ marginBottom: 2 }}>
                        {preflight.kalshi.title}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        {preflight.kalshi.rules_primary}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, borderTop: "1px solid #2d3748", paddingTop: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        Polymarket — {preflight.poly.group_item_title || preflight.poly.question}
                      </div>
                      <div className="ph-muted" style={{ marginBottom: 2 }}>
                        {preflight.poly.question}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        {preflight.poly.description}
                      </div>
                    </div>
                    <div className="ph-muted" style={{ fontSize: 10 }}>
                      Read both carefully — confirm only if they refer to the same event.
                    </div>
                  </>
                )}

                {saveError && (
                  <div className="ph-neg" style={{ fontSize: 11 }}>{saveError}</div>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={preflight.blocked || saving}
              >
                {saving ? "Saving…" : preflight.warn ? "Confirm anyway" : "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
