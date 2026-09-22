import type { ReactNode } from "react";
import { cn } from "@/components/polyhedge/cn";

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClass?: string;
}

export function SummaryCard({ label, value, sub, valueClass }: Props) {
  return (
    <div className="ph-card">
      <div className="ph-card-label">{label}</div>
      <div className={cn("ph-card-value", valueClass)}>{value}</div>
      {sub && <div className="ph-card-sub">{sub}</div>}
    </div>
  );
}

export function SummaryGrid({ children }: { children: ReactNode }) {
  return <div className="ph-summary-grid">{children}</div>;
}
