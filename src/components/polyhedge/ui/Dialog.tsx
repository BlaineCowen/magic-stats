"use client";

import * as RDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

export function DialogContent({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description?: ReactNode;
}) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="ph-overlay" />
      <RDialog.Content className="ph-dialog">
        <RDialog.Title asChild>
          <h3>{title}</h3>
        </RDialog.Title>
        {description && (
          <RDialog.Description asChild>
            <p>{description}</p>
          </RDialog.Description>
        )}
        {children}
      </RDialog.Content>
    </RDialog.Portal>
  );
}
