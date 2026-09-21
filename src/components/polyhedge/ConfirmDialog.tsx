"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/polyhedge/ui/Dialog";
import { Button } from "@/components/polyhedge/ui/Button";

interface Props {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent title={title} description={description}>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <DialogClose asChild>
            <Button variant="ghost">{cancelLabel}</Button>
          </DialogClose>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
