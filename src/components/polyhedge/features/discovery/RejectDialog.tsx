"use client";

import { useState } from "react";
import { Dialog, DialogClose, DialogContent } from "@/components/polyhedge/ui/Dialog";
import { Button } from "@/components/polyhedge/ui/Button";
import { Input } from "@/components/polyhedge/ui/Input";
import type { ArbRejectReason } from "@/lib/polyhedge/types";
import { arbErrorMessage, useArbReject } from "./hooks";

const REASONS: { id: ArbRejectReason; label: string }[] = [
  { id: "rules_differ", label: "Resolution rules differ" },
  { id: "different_event", label: "Different event" },
  { id: "outcome_mismatch", label: "Outcomes don't match" },
  { id: "live_delay", label: "Live-event delay" },
  { id: "thin_market", label: "Market too thin" },
  { id: "not_interesting", label: "Not worth it" },
  { id: "other", label: "Other" },
];

export function RejectDialog({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ArbRejectReason>("rules_differ");
  const [note, setNote] = useState("");
  const reject = useArbReject(id);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Reject…
      </Button>
      <DialogContent title="Reject this candidate?">
        <select
          className="ph-input"
          value={reason}
          onChange={(e) => setReason(e.target.value as ArbRejectReason)}
          style={{ width: "100%" }}
        >
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          style={{ width: "100%", marginTop: 8 }}
        />
        {reject.error && <p className="ph-neg">{arbErrorMessage(reject.error)}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={reject.isPending}
            onClick={() =>
              reject.mutate({ reason_code: reason, note }, { onSuccess: () => setOpen(false) })
            }
          >
            Reject
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
